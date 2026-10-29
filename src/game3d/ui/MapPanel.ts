/**
 * The woods map screen (v2.10): a hand-drawn parchment map on a canvas with landmarks, the hero (gold dot + arrow) and a pulsing
 * star on the current goal. The land is drawn once per size from the same height function the world uses, then the hero and goal are
 * drawn over it each frame while the map is open. All pixels are drawn by code (no image files).
 */
import { TEXT, type Lang, type Strings } from '../data/woodsText';
import { HOUSES } from '../systems/layout3d';
import type { Vec2 } from '../systems/movement3d';
import { WILDS_TEXT, type WildsLandmarkKind } from '../data/wildsText';
import { visibleChests, visibleWildsMarks } from '../systems/wildsMap';
import { EXPLORE_CELL, EXPLORE_HALF, EXPLORE_N, exploredAt, type WildsState } from '../systems/wildsQuest';
import { ZONES } from '../systems/expansion';
import { MIRROR, PATHS } from '../systems/expansionShape';
import { LANDMARKS, MAP_EXTENT, headingArrow, toMap, type LandmarkKind } from '../systems/mapView';
import { POND, RUINS, TRAIL, VILLAGE, WORLD_RADIUS, heightAt } from '../systems/worldShape';
import { icon } from './icons';
import { HOLLOW_TEXT } from '../data/hollowText';
import { FLOOR } from '../systems/hollowLayout';
import { HOLLOW_LANDMARKS, HOLLOW_MAP, litGlowcaps, readTablets, toHollowMap, SECRET_MARK, type HollowLandmarkKind } from '../systems/hollowMap';
import { ECHO_COLORS, ECHO_SPOTS } from '../systems/hollowLayout';
import { ECHO_HEX } from '../render/HollowWorld';
import type { HollowState } from '../systems/hollowQuest';
import { secretOpen } from '../systems/hollowQuest';
import { SHORE_TEXT } from '../data/shoreText';
import { BUOYS, BUOY_SPOTS, GROUND, type BuoyId } from '../systems/shoreLayout';
import { SHORE_LANDMARKS, SHORE_MAP, readBottles, toShoreMap, type ShoreLandmarkKind } from '../systems/shoreMap';
import type { ShoreState } from '../systems/shoreQuest';
import { BUOY_HEX } from '../render/ShoreWorld';
export type MapArea = 'woods' | 'hollow' | 'shore';

/** Where each name sits next to its picture (in `u` units, 1u = size/500 px) so neighbouring names in the village corner do not overlap. */
const LABEL_AT: Record<LandmarkKind, readonly [number, number, CanvasTextAlign]> = {
  village: [0, 40, 'center'], ruins: [0, -26, 'center'], pond: [0, 24, 'center'], camp: [-16, -4, 'right'],
  tree: [0, 26, 'center'], fairy: [-16, 0, 'right'], stone: [16, 0, 'left'], gate: [-14, 20, 'right'],
};

const ZONES_TOTAL = ZONES.length;
export interface MapFrame { x: number; z: number; heading: number; targets: readonly Vec2[]; hollow?: HollowState; shore?: ShoreState; wilds?: WildsState }

export class MapPanel {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement; private readonly ctx: CanvasRenderingContext2D;
  private readonly base = document.createElement('canvas');
  private area: MapArea = 'woods'; private lang: Lang;
  private readonly fog = document.createElement('canvas'); private fogKey = '';
  private s: Strings; private open_ = false; private baseSize = 0; private frame: MapFrame = { x: 0, z: 0, heading: 0, targets: [] };
  private title!: HTMLElement; private youLab!: HTMLElement; private goalLab!: HTMLElement; private hint!: HTMLElement; private closeBtn!: HTMLButtonElement;

  constructor(parent: HTMLElement, lang: Lang, private readonly onClose: () => void) {
    this.s = TEXT[lang]; this.lang = lang;
    this.root = document.createElement('div'); this.root.className = 'mq-overlay mq-map-overlay'; this.root.style.display = 'none'; parent.appendChild(this.root);
    const card = document.createElement('div'); card.className = 'mq-panel mq-card mq-map-card'; this.root.appendChild(card);
    const head = document.createElement('div'); head.className = 'mq-map-head'; card.appendChild(head);
    this.title = document.createElement('h2'); head.appendChild(this.title);
    this.closeBtn = document.createElement('button'); this.closeBtn.type = 'button'; this.closeBtn.className = 'mq-chip mq-map-close'; head.appendChild(this.closeBtn);
    this.canvas = document.createElement('canvas'); this.canvas.className = 'mq-map-canvas'; card.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const legend = document.createElement('div'); legend.className = 'mq-map-legend'; card.appendChild(legend);
    const you = document.createElement('span'); you.innerHTML = '<i class="mq-map-dot"></i>'; this.youLab = document.createElement('b'); you.appendChild(this.youLab); legend.appendChild(you);
    const goal = document.createElement('span'); goal.innerHTML = `<i class="mq-map-star">${icon('star', 16)}</i>`; this.goalLab = document.createElement('b'); goal.appendChild(this.goalLab); legend.appendChild(goal);
    this.hint = document.createElement('p'); this.hint.className = 'mq-map-hint'; card.appendChild(this.hint);
    this.root.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === this.root) this.onClose(); });
    this.closeBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.onClose(); });
    this.relabel();
  }

  get isOpen(): boolean { return this.open_; }
  setLang(l: Lang): void { this.s = TEXT[l]; this.lang = l; this.relabel(); this.baseSize = 0; }
  /** Which map to draw: the woods, or the Crystal Hollow while the hero is inside it. */
  setArea(a: MapArea): void { if (a === this.area) return; this.area = a; this.relabel(); this.baseSize = 0; }
  private project(x: number, z: number, size: number): { px: number; py: number } { return this.area === 'hollow' ? toHollowMap(x, z, size) : this.area === 'shore' ? toShoreMap(x, z, size) : toMap(x, z, size); }
  private relabel(): void {
    const m = this.s.map; this.title.textContent = this.area === 'hollow' ? HOLLOW_TEXT[this.lang].mapTitle : this.area === 'shore' ? SHORE_TEXT[this.lang].mapTitle : m.title; this.youLab.textContent = ` ${m.you}`; this.goalLab.textContent = ` ${m.goal}`; this.hint.textContent = m.hint;
    this.closeBtn.innerHTML = `${icon('close', 20)}<span></span>`; (this.closeBtn.lastElementChild as HTMLElement).textContent = m.close;
  }
  show(): void { this.open_ = true; this.root.style.display = 'flex'; this.layout(); }
  hide(): void { this.open_ = false; this.root.style.display = 'none'; }
  update(f: MapFrame, time: number): void { this.frame = f; if (this.open_) this.draw(time); }

  private layout(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1), css = Math.max(180, Math.round(this.canvas.clientWidth || 300)), size = Math.round(css * dpr);
    if (size !== this.baseSize || this.canvas.width !== size) { this.canvas.width = this.canvas.height = size; this.base.width = this.base.height = size; this.baseSize = size; this.paintLand(size, dpr); }
  }

  /** The still part of the map: parchment, land shaded by height, pond, village, ruins, trail, houses, landmark pictures and names. */
  private paintLand(size: number, dpr: number): void {
    if (this.area === 'hollow') { this.paintHollow(size, dpr); return; }
    if (this.area === 'shore') { this.paintShore(size, dpr); return; }
    const c = this.base.getContext('2d')!; c.clearRect(0, 0, size, size);
    const k = size / 2 / MAP_EXTENT, u = size / 500, mid = size / 2;
    c.fillStyle = '#ecd9ab'; c.fillRect(0, 0, size, size);
    c.save(); c.beginPath(); c.arc(mid, mid, WORLD_RADIUS * k, 0, Math.PI * 2); c.clip();
    const N = 112, cell = (WORLD_RADIUS * 2) / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const wx = -WORLD_RADIUS + (i + 0.5) * cell, wz = -WORLD_RADIUS + (j + 0.5) * cell, h = heightAt(wx, wz), t = Math.max(0, Math.min(1, h / 7));
      const r = Math.round(150 - 70 * t), g = Math.round(205 - 70 * t), b = Math.round(105 - 45 * t);
      c.fillStyle = `rgb(${r},${g},${b})`; const p = toMap(wx - cell / 2, wz - cell / 2, size); c.fillRect(p.px, p.py, cell * k + 1, cell * k + 1);
    }
    const zone = (z: { x: number; z: number; r: number }, col: string): void => { const p = toMap(z.x, z.z, size); c.fillStyle = col; c.beginPath(); c.arc(p.px, p.py, z.r * k, 0, Math.PI * 2); c.fill(); };
    zone(VILLAGE, 'rgba(226,196,140,.85)'); zone(RUINS, 'rgba(180,176,160,.85)');
    const pp = toMap(POND.x, POND.z, size); c.fillStyle = '#5aa9ee'; c.strokeStyle = '#2f6fb0'; c.lineWidth = 2 * u; c.beginPath(); c.ellipse(pp.px, pp.py, POND.r * k * 1.2, POND.r * k, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#f3dfae'; c.lineWidth = 5 * u; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    TRAIL.forEach((t, i) => { const p = toMap(t.x, t.z, size); if (i) c.lineTo(p.px, p.py); else c.moveTo(p.px, p.py); }); c.stroke();
    // v2.31: the new trails and Mirror Pond (the fog layer hides whatever the hero has not seen yet)
    c.strokeStyle = '#f3dfae'; c.lineWidth = 3.6 * u; for (const pa of PATHS) { c.beginPath(); pa.pts.forEach((t, i) => { const p = toMap(t.x, t.z, size); if (i) c.lineTo(p.px, p.py); else c.moveTo(p.px, p.py); }); c.stroke(); }
    { const mp = toMap(MIRROR.x, MIRROR.z, size); c.fillStyle = '#5aa9ee'; c.strokeStyle = '#2f6fb0'; c.lineWidth = 2 * u; c.beginPath(); c.arc(mp.px, mp.py, MIRROR.r * k, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#c8b57a'; c.beginPath(); c.arc(mp.px, mp.py, MIRROR.island * k, 0, Math.PI * 2); c.fill(); }
    for (const h of HOUSES) { const p = toMap(h.x, h.z, size), s = Math.max(5 * u, h.r * k * 0.9); c.save(); c.translate(p.px, p.py); c.rotate(-h.rot); c.fillStyle = '#c0764a'; c.strokeStyle = '#3b2414'; c.lineWidth = 1.6 * u; c.fillRect(-s / 2, -s / 2, s, s); c.strokeRect(-s / 2, -s / 2, s, s); c.restore(); }
    c.restore();
    c.strokeStyle = '#3b2414'; c.lineWidth = 4 * u; c.beginPath(); c.arc(mid, mid, WORLD_RADIUS * k, 0, Math.PI * 2); c.stroke();
    // landmark pictures and names
    const fs = Math.max(11 * dpr, size * 0.036); c.font = `700 ${fs}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const l of LANDMARKS) {
      const p = toMap(l.x, l.z, size); this.glyph(c, l.kind, p.px, p.py, u);
      const [dx, dy, align] = LABEL_AT[l.kind]; const text = this.s.map.labels[l.kind]; const tx = p.px + dx * u, ty = p.py + dy * u;
      c.textAlign = align; c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(255,248,225,.95)'; c.lineJoin = 'round'; c.strokeText(text, tx, ty); c.fillStyle = '#3b2414'; c.fillText(text, tx, ty);
    }
  }

  /** The coast: sea, then every piece of ground (the ones that depend on the tide or the puzzle drawn in a paler sand so the child can see they come and go), landmarks and names. */
  private paintShore(size: number, dpr: number): void {
    const c = this.base.getContext('2d')!; c.clearRect(0, 0, size, size);
    const k = size / 2 / SHORE_MAP.half, u = size / 500;
    c.fillStyle = '#7ec4d8'; c.fillRect(0, 0, size, size);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5 * u; for (let i = 0; i < 40; i++) { const x = ((i * 97) % 100) / 100 * size, y = ((i * 61) % 100) / 100 * size; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8 * u, y - 4 * u, x + 16 * u, y); c.stroke(); }
    const pass = (grow: number, style: (gate: string) => string): void => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const g of GROUND) {
        const f = g.shape; c.fillStyle = style(g.gate); c.strokeStyle = style(g.gate);
        if (f.kind === 'disc') { const p = toShoreMap(f.x, f.z, size); c.beginPath(); c.arc(p.px, p.py, (f.r + grow) * k, 0, Math.PI * 2); c.fill(); } else {
          const a = toShoreMap(f.a.x, f.a.z, size), b = toShoreMap(f.b.x, f.b.z, size); c.lineWidth = (f.r + grow) * 2 * k; c.beginPath(); c.moveTo(a.px, a.py); c.lineTo(b.px, b.py); c.stroke();
        }
      }
    };
    pass(0.8, () => '#3b2414'); pass(0, gate => (gate === 'always' ? '#ecd9a8' : gate === 'causeway' ? '#cfcfd8' : '#f6ecc8'));
    const fs = Math.max(11 * dpr, size * 0.034); c.font = `700 ${fs}px system-ui, sans-serif`; c.textBaseline = 'middle';
    for (const l of SHORE_LANDMARKS) {
      const p = toShoreMap(l.x, l.z, size); this.shoreGlyph(c, l.kind, p.px, p.py, u);
      const text = SHORE_TEXT[this.lang].labels[l.kind]; c.textAlign = 'center'; c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(255,248,225,.95)'; c.lineJoin = 'round';
      const ty = p.py + (l.kind === 'village' || l.kind === 'island' ? 22 * u : -20 * u); c.strokeText(text, p.px, ty); c.fillStyle = '#3b2414'; c.fillText(text, p.px, ty);
    }
  }
  private shoreGlyph(c: CanvasRenderingContext2D, kind: ShoreLandmarkKind, x: number, y: number, u: number): void {
    c.save(); c.translate(x, y); c.lineWidth = 1.8 * u; c.strokeStyle = '#3b2414'; c.lineJoin = 'round';
    switch (kind) {
      case 'village': c.fillStyle = '#fff4d6'; c.fillRect(-8 * u, -1 * u, 16 * u, 9 * u); c.strokeRect(-8 * u, -1 * u, 16 * u, 9 * u); c.fillStyle = '#3f84a0'; c.beginPath(); c.moveTo(0, -9 * u); c.lineTo(10 * u, -1 * u); c.lineTo(-10 * u, -1 * u); c.closePath(); c.fill(); c.stroke(); break;
      case 'island': c.fillStyle = '#f6f0e0'; c.beginPath(); c.moveTo(-4 * u, 9 * u); c.lineTo(-2.4 * u, -7 * u); c.lineTo(2.4 * u, -7 * u); c.lineTo(4 * u, 9 * u); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#d8483a'; c.fillRect(-3.2 * u, -1 * u, 6.4 * u, 4 * u); c.fillStyle = '#ffe066'; c.beginPath(); c.arc(0, -10 * u, 3.4 * u, 0, Math.PI * 2); c.fill(); c.stroke(); break;
      case 'flats': c.fillStyle = '#3aa8b0'; c.beginPath(); c.ellipse(0, 0, 10 * u, 6 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke(); break;
      case 'wreck': c.strokeStyle = '#3b2414'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(-9 * u, 4 * u); c.quadraticCurveTo(0, 12 * u, 9 * u, 4 * u); c.moveTo(0, 6 * u); c.lineTo(0, -9 * u); c.moveTo(0, -8 * u); c.lineTo(7 * u, -2 * u); c.lineTo(0, -2 * u); c.stroke(); break;
      case 'cave': c.fillStyle = '#3a4258'; c.beginPath(); c.arc(0, 4 * u, 8 * u, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); break;
      case 'beach': c.strokeStyle = '#3b2414'; c.lineWidth = 4 * u; c.beginPath(); c.arc(0, 2 * u, 7 * u, Math.PI, 0); c.moveTo(-7 * u, 2 * u); c.lineTo(-7 * u, 8 * u); c.moveTo(7 * u, 2 * u); c.lineTo(7 * u, 8 * u); c.stroke(); c.strokeStyle = '#bfe4ff'; c.lineWidth = 2 * u; c.stroke(); break;
    }
    c.restore();
  }
  /** Over the still shore map: the three bell-buoys as coloured bells (always, so the child can plan the walk), and message bottles once read. */
  private drawShoreMarks(c: CanvasRenderingContext2D, size: number, u: number): void {
    c.save(); c.lineWidth = 1.6 * u; c.strokeStyle = '#3b2414';
    for (const id of BUOYS as readonly BuoyId[]) { const p = toShoreMap(BUOY_SPOTS[id].x, BUOY_SPOTS[id].z, size); c.fillStyle = '#' + BUOY_HEX[id].toString(16).padStart(6, '0'); c.beginPath(); c.arc(p.px, p.py - 2 * u, 6 * u, Math.PI, 0); c.lineTo(p.px + 6 * u, p.py + 4 * u); c.lineTo(p.px - 6 * u, p.py + 4 * u); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(p.px, p.py + 6 * u, 1.8 * u, 0, Math.PI * 2); c.fill(); c.stroke(); }
    const ss = this.frame.shore;
    if (ss) for (const b of readBottles(ss)) { const p = toShoreMap(b.x, b.z, size); c.fillStyle = '#bfeaff'; c.beginPath(); c.arc(p.px, p.py, 4 * u, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.restore();
  }

  /** The cave: every chamber and tunnel as pale floor with a dark outline, the landmarks, and the Echo Crystals as coloured dots. */
  private paintHollow(size: number, dpr: number): void {
    const c = this.base.getContext('2d')!; c.clearRect(0, 0, size, size);
    const k = size / 2 / HOLLOW_MAP.half, u = size / 500;
    c.fillStyle = '#d9c593'; c.fillRect(0, 0, size, size); c.fillStyle = 'rgba(70,56,100,.55)'; c.fillRect(0, 0, size, size);
    const pass = (grow: number, style: string): void => {
      c.fillStyle = style; c.strokeStyle = style; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const f of FLOOR) {
        if (f.kind === 'disc') { const p = toHollowMap(f.x, f.z, size); c.beginPath(); c.arc(p.px, p.py, (f.r + grow) * k, 0, Math.PI * 2); c.fill(); } else {
          const a = toHollowMap(f.a.x, f.a.z, size), b = toHollowMap(f.b.x, f.b.z, size); c.lineWidth = (f.r + grow) * 2 * k; c.beginPath(); c.moveTo(a.px, a.py); c.lineTo(b.px, b.py); c.stroke();
        }
      }
    };
    pass(0.7, '#2a2350'); pass(0, '#efe0b8');
    const fs = Math.max(11 * dpr, size * 0.034); c.font = `700 ${fs}px system-ui, sans-serif`; c.textBaseline = 'middle';
    for (const l of HOLLOW_LANDMARKS) {
      const p = toHollowMap(l.x, l.z, size); this.hollowGlyph(c, l.kind, p.px, p.py, u);
      const text = HOLLOW_TEXT[this.lang].labels[l.kind]; c.textAlign = 'center'; c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(255,248,225,.95)'; c.lineJoin = 'round';
      const ty = p.py + (l.kind === 'heart' || l.kind === 'door' ? -22 * u : 22 * u); c.strokeText(text, p.px, ty); c.fillStyle = '#3b2414'; c.fillText(text, p.px, ty);
    }
  }
  private hollowGlyph(c: CanvasRenderingContext2D, kind: HollowLandmarkKind, x: number, y: number, u: number): void {
    c.save(); c.translate(x, y); c.lineWidth = 1.8 * u; c.strokeStyle = '#3b2414'; c.lineJoin = 'round';
    const gem = (r: number, col: string, dx = 0, dy = 0): void => { c.fillStyle = col; c.beginPath(); c.moveTo(dx, dy - r * 1.4); c.lineTo(dx + r, dy); c.lineTo(dx, dy + r * 1.4); c.lineTo(dx - r, dy); c.closePath(); c.fill(); c.stroke(); };
    switch (kind) {
      case 'prism': gem(8 * u, '#8fe0ff'); break;
      case 'heart': gem(7 * u, '#ff9fd8'); break;
      case 'door': c.fillStyle = '#c9d8f4'; c.fillRect(-9 * u, -4 * u, 18 * u, 8 * u); c.strokeRect(-9 * u, -4 * u, 18 * u, 8 * u); break;
      case 'gate': c.strokeStyle = '#3b2414'; c.lineWidth = 5 * u; c.beginPath(); c.arc(0, 2 * u, 8 * u, Math.PI, 0); c.moveTo(-8 * u, 2 * u); c.lineTo(-8 * u, 9 * u); c.moveTo(8 * u, 2 * u); c.lineTo(8 * u, 9 * u); c.stroke(); c.strokeStyle = '#bfe4ff'; c.lineWidth = 2.6 * u; c.stroke(); break;
      case 'pool': c.fillStyle = '#5aa9ee'; c.beginPath(); c.ellipse(0, 0, 11 * u, 7 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke(); break;
      case 'grotto': c.fillStyle = '#3fd6a0'; c.beginPath(); c.arc(0, 0, 8 * u, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); break;
      case 'pink': gem(5 * u, '#ff8fd0'); break;
      case 'mural': c.fillStyle = '#e6c36a'; c.fillRect(-8 * u, -5 * u, 16 * u, 10 * u); c.strokeRect(-8 * u, -5 * u, 16 * u, 10 * u); break;
      case 'glim': c.fillStyle = '#d4f4ff'; c.beginPath(); c.arc(0, 0, 6 * u, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(0, -13 * u); c.lineTo(3 * u, -6 * u); c.lineTo(-3 * u, -6 * u); c.closePath(); c.fill(); c.stroke(); break;   // Glim: a pale spirit under his little horn-light
    }
    c.restore();
  }

  private glyph(c: CanvasRenderingContext2D, kind: LandmarkKind, x: number, y: number, u: number): void {
    c.save(); c.translate(x, y); c.lineWidth = 1.8 * u; c.strokeStyle = '#3b2414'; c.lineJoin = 'round';
    const tri = (w: number, h: number, col: string): void => { c.fillStyle = col; c.beginPath(); c.moveTo(0, -h); c.lineTo(w, h * 0.7); c.lineTo(-w, h * 0.7); c.closePath(); c.fill(); c.stroke(); };
    const disc = (r: number, col: string, dx = 0, dy = 0): void => { c.fillStyle = col; c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); c.stroke(); };
    switch (kind) {
      case 'village': c.fillStyle = '#fff4d6'; c.fillRect(-9 * u, -2 * u, 18 * u, 10 * u); c.strokeRect(-9 * u, -2 * u, 18 * u, 10 * u); c.translate(0, -2 * u); tri(11 * u, 8 * u, '#e0573f'); break;
      case 'ruins': for (const dx of [-8, 0, 8]) { c.fillStyle = '#d8dde2'; c.fillRect((dx - 3) * u, -8 * u, 6 * u, 16 * u); c.strokeRect((dx - 3) * u, -8 * u, 6 * u, 16 * u); } break;
      case 'pond': break;
      case 'camp': tri(10 * u, 9 * u, '#ee5a4a'); break;
      case 'tree': disc(9 * u, '#2f7d3a', 0, -3 * u); c.fillStyle = '#7a4a22'; c.fillRect(-2 * u, 4 * u, 4 * u, 6 * u); break;
      case 'fairy': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; disc(2.4 * u, '#c9a6ff', Math.cos(a) * 8 * u, Math.sin(a) * 8 * u); } break;
      case 'stone': c.fillStyle = '#c6ccd2'; c.beginPath(); c.moveTo(-6 * u, 8 * u); c.lineTo(-5 * u, -6 * u); c.lineTo(0, -10 * u); c.lineTo(5 * u, -6 * u); c.lineTo(6 * u, 8 * u); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#6a5acd'; c.beginPath(); c.moveTo(0, -5 * u); c.lineTo(0, 4 * u); c.moveTo(-3 * u, -1 * u); c.lineTo(3 * u, -1 * u); c.stroke(); break;
      case 'gate': c.strokeStyle = '#3b2414'; c.lineWidth = 5 * u; c.beginPath(); c.arc(0, 2 * u, 8 * u, Math.PI, 0); c.moveTo(-8 * u, 2 * u); c.lineTo(-8 * u, 9 * u); c.moveTo(8 * u, 2 * u); c.lineTo(8 * u, 9 * u); c.stroke(); c.strokeStyle = '#ffd24a'; c.lineWidth = 2.6 * u; c.stroke(); break;
    }
    c.restore();
  }

  /** Over the still map: the three Echo Crystals as coloured gems, glowcaps once lit, and the secret nook once it is open. */
  private drawHollowMarks(c: CanvasRenderingContext2D, size: number, u: number): void {
    const hs = this.frame.hollow; c.save(); c.lineWidth = 1.6 * u; c.strokeStyle = '#3b2414';
    for (const col of ECHO_COLORS) { const p = toHollowMap(ECHO_SPOTS[col].x, ECHO_SPOTS[col].z, size); c.fillStyle = '#' + ECHO_HEX[col].toString(16).padStart(6, '0'); c.beginPath(); c.moveTo(p.px, p.py - 8 * u); c.lineTo(p.px + 5 * u, p.py); c.lineTo(p.px, p.py + 8 * u); c.lineTo(p.px - 5 * u, p.py); c.closePath(); c.fill(); c.stroke(); }
    if (hs) {
      for (const g of litGlowcaps(hs)) { const p = toHollowMap(g.x, g.z, size); c.fillStyle = '#7dffd0'; c.beginPath(); c.arc(p.px, p.py, 4 * u, 0, Math.PI * 2); c.fill(); c.stroke(); }
      for (const t of readTablets(hs)) { const p = toHollowMap(t.x, t.z, size); c.fillStyle = '#bfeaff'; c.beginPath(); c.moveTo(p.px - 4 * u, p.py + 5 * u); c.lineTo(p.px - 4 * u, p.py - 2 * u); c.arc(p.px, p.py - 2 * u, 4 * u, Math.PI, 0); c.lineTo(p.px + 4 * u, p.py + 5 * u); c.closePath(); c.fill(); c.stroke(); }   // a read Moon Tablet
      if (secretOpen(hs)) { const p = toHollowMap(SECRET_MARK.x, SECRET_MARK.z, size); c.fillStyle = '#c9b0ff'; c.beginPath(); c.arc(p.px, p.py, 5 * u, 0, Math.PI * 2); c.fill(); c.stroke(); }
    }
    c.restore();
  }

  /** v2.31: fog over the ground the hero has not seen, then the named places, chests and the count. */
  private drawWilds(c: CanvasRenderingContext2D, size: number, u: number, w: WildsState): void {
    const key = `${size}|${w.explored}`;
    if (key !== this.fogKey) {
      this.fogKey = key; this.fog.width = this.fog.height = size; const f = this.fog.getContext('2d')!; f.clearRect(0, 0, size, size);
      const k = size / 2 / MAP_EXTENT, cs = EXPLORE_CELL * k + 1;
      f.fillStyle = 'rgba(236,217,171,0.94)';
      for (let iz = 0; iz < EXPLORE_N; iz++) for (let ix = 0; ix < EXPLORE_N; ix++) {
        const wx = (ix + 0.5) * EXPLORE_CELL - EXPLORE_HALF, wz = (iz + 0.5) * EXPLORE_CELL - EXPLORE_HALF;
        if (!exploredAt(w, wx, wz)) { const p = toMap(wx - EXPLORE_CELL / 2, wz - EXPLORE_CELL / 2, size); f.fillRect(p.px, p.py, cs, cs); }
      }
      f.globalCompositeOperation = 'destination-in'; f.beginPath(); f.arc(size / 2, size / 2, WORLD_RADIUS * k + 2, 0, Math.PI * 2); f.fill();   // keep the fog inside the map's circle
    }
    c.drawImage(this.fog, 0, 0);
    const T = WILDS_TEXT[this.lang], fs = Math.max(10 * (size / 500) * 1.2, size * 0.03);
    c.save(); c.font = `700 ${fs}px system-ui, sans-serif`; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const m of visibleWildsMarks(w)) {
      const p = toMap(m.x, m.z, size); this.wildsGlyph(c, m.kind, p.px, p.py, u);
      c.textAlign = 'center'; c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(255,248,225,.95)'; c.strokeText(T.labels[m.kind], p.px, p.py + 17 * u); c.fillStyle = '#3b2414'; c.fillText(T.labels[m.kind], p.px, p.py + 17 * u);
    }
    for (const ch of visibleChests(w)) {
      const p = toMap(ch.x, ch.z, size); c.lineWidth = 1.6 * u; c.strokeStyle = '#3b2414'; c.fillStyle = ch.open ? '#b9a98a' : '#ffd24a';
      c.fillRect(p.px - 5 * u, p.py - 3.5 * u, 10 * u, 7 * u); c.strokeRect(p.px - 5 * u, p.py - 3.5 * u, 10 * u, 7 * u); if (!ch.open) { c.fillStyle = '#8a5a2e'; c.fillRect(p.px - 5 * u, p.py - 3.5 * u, 10 * u, 2.5 * u); }
    }
    c.textAlign = 'left'; c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(255,248,225,.95)'; const txt = T.map.discovered.replace('{n}', String(w.zones.length)).replace('{total}', String(ZONES_TOTAL));
    c.strokeText(txt, size * 0.03, size * 0.965); c.fillStyle = '#3b2414'; c.fillText(txt, size * 0.03, size * 0.965);
    c.restore();
  }
  private wildsGlyph(c: CanvasRenderingContext2D, kind: WildsLandmarkKind, x: number, y: number, u: number): void {
    c.save(); c.translate(x, y); c.lineWidth = 1.6 * u; c.strokeStyle = '#3b2414'; c.lineJoin = 'round';
    const disc = (r: number, col: string, dx = 0, dy = 0): void => { c.fillStyle = col; c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); c.stroke(); };
    const tri = (w2: number, h: number, col: string): void => { c.fillStyle = col; c.beginPath(); c.moveTo(0, -h); c.lineTo(w2, h * 0.7); c.lineTo(-w2, h * 0.7); c.closePath(); c.fill(); c.stroke(); };
    switch (kind) {
      case 'mill': c.fillStyle = '#fff4d6'; c.fillRect(-3 * u, -2 * u, 6 * u, 9 * u); c.strokeRect(-3 * u, -2 * u, 6 * u, 9 * u); c.beginPath(); c.moveTo(-8 * u, -8 * u); c.lineTo(8 * u, 4 * u); c.moveTo(8 * u, -8 * u); c.lineTo(-8 * u, 4 * u); c.stroke(); break;
      case 'hearthfield': c.fillStyle = '#fff4d6'; c.fillRect(-7 * u, -1 * u, 14 * u, 8 * u); c.strokeRect(-7 * u, -1 * u, 14 * u, 8 * u); c.translate(0, -1 * u); tri(9 * u, 6 * u, '#c8573b'); break;
      case 'orchard': disc(5 * u, '#f6a8cc', -5 * u, 0); disc(5 * u, '#9ad457', 5 * u, 0); break;
      case 'kite': c.fillStyle = '#ff7a8a'; c.beginPath(); c.moveTo(0, -9 * u); c.lineTo(6 * u, 0); c.lineTo(0, 8 * u); c.lineTo(-6 * u, 0); c.closePath(); c.fill(); c.stroke(); break;
      case 'lookout': tri(10 * u, 8 * u, '#8a7a5a'); c.fillStyle = '#ffd24a'; c.fillRect(-2 * u, -12 * u, 4 * u, 5 * u); break;
      case 'mirror': break;
      case 'thicket': disc(6 * u, '#245a34', -5 * u, 0); disc(6 * u, '#2f7d3a', 5 * u, -2 * u); break;
      case 'heartwood': disc(9 * u, '#7ff0d0', 0, -2 * u); c.fillStyle = '#7a4a22'; c.fillRect(-2 * u, 5 * u, 4 * u, 5 * u); break;
      case 'grove': for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; disc(3.2 * u, '#f6a8cc', Math.cos(a) * 5 * u, Math.sin(a) * 5 * u); } disc(2.4 * u, '#ffe08a'); break;
      case 'cave': c.fillStyle = '#3a3646'; c.beginPath(); c.arc(0, 4 * u, 8 * u, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); break;
      case 'steps': for (const dx of [-6, 0, 6]) { c.fillStyle = '#d8dde2'; c.fillRect((dx - 2) * u, -7 * u, 4 * u, 13 * u); c.strokeRect((dx - 2) * u, -7 * u, 4 * u, 13 * u); } break;
      case 'moon': for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; disc(2 * u, '#c6ccd2', Math.cos(a) * 7 * u, Math.sin(a) * 7 * u); } break;
      case 'mist': c.strokeStyle = '#3b2414'; c.lineWidth = 4 * u; c.beginPath(); c.arc(0, 2 * u, 7 * u, Math.PI, 0); c.moveTo(-7 * u, 2 * u); c.lineTo(-7 * u, 8 * u); c.moveTo(7 * u, 2 * u); c.lineTo(7 * u, 8 * u); c.stroke(); c.strokeStyle = '#bfe4ff'; c.lineWidth = 2 * u; c.stroke(); break;
      case 'door': c.fillStyle = '#6a6e78'; c.fillRect(-5 * u, -6 * u, 10 * u, 12 * u); c.strokeRect(-5 * u, -6 * u, 10 * u, 12 * u); break;
    }
    c.restore();
  }

  private draw(time: number): void {
    this.layout(); const c = this.ctx, size = this.canvas.width, u = size / 500;
    c.clearRect(0, 0, size, size); c.drawImage(this.base, 0, 0);
    if (this.area === 'woods' && this.frame.wilds) this.drawWilds(c, size, u, this.frame.wilds);
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    if (this.area === 'hollow') this.drawHollowMarks(c, size, u); else if (this.area === 'shore') this.drawShoreMarks(c, size, u);
    for (const t of this.frame.targets) {
      const p = this.project(t.x, t.z, size); c.save(); c.translate(p.px, p.py);
      c.strokeStyle = `rgba(255,210,74,${0.9 - pulse * 0.5})`; c.lineWidth = 3 * u; c.beginPath(); c.arc(0, 0, (9 + pulse * 7) * u, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffd24a'; c.strokeStyle = '#3b2414'; c.lineWidth = 1.8 * u; c.beginPath();
      for (let i = 0; i < 10; i++) { const r = (i % 2 ? 4.2 : 9.5) * u, a = -Math.PI / 2 + (i * Math.PI) / 5; (i ? c.lineTo : c.moveTo).call(c, Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    const h = this.project(this.frame.x, this.frame.z, size), a = headingArrow(this.frame.heading);
    c.save(); c.translate(h.px, h.py); c.rotate(Math.atan2(a.dx, -a.dy));
    c.fillStyle = '#fff'; c.strokeStyle = '#3b2414'; c.lineWidth = 2.2 * u; c.beginPath(); c.moveTo(0, -15 * u); c.lineTo(8 * u, 4 * u); c.lineTo(-8 * u, 4 * u); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, 2 * u, 7 * u, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
  }
}
