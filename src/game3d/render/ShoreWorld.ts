/**
 * Moonwake Shore as three.js objects (v2.29). The layout, tide rules and quest live in systems/shoreLayout.ts and shoreQuest.ts; this file only
 * draws and animates them. It follows the Hollow's recipe: merged vertex-coloured Kit pieces for landmarks, instancing for repeated things,
 * glow sprites for light, built lazily the first time the hero arrives. Unlike the Hollow it is an open coast under the real day-night sky
 * (the scene applies the same `lookForPhase` light as the woods), so the stilt-village lamps and the lighthouse glow as evening comes.
 *
 * The tide is shown by the ground itself rising out of, and sinking into, a sea that stays at one level: the tidepool flats rise at low tide,
 * the ferry floats up at high tide, the Moon Causeway climbs out of the water when the puzzle is solved, and the sea cave dries at low tide.
 */
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  PlaneGeometry, Quaternion, RepeatWrapping, RingGeometry, SphereGeometry, SpriteMaterial, Sprite, SRGBColorSpace, TorusGeometry, Vector3, type BufferGeometry, type Scene,
} from 'three';
import { Kit, M, mat } from './env/Structures';
import { glowSprite } from './common';
import { withPaint } from './stylize';
import { ColliderGrid } from '../systems/colliders';
import type { Quality } from '../systems/quality';
import {
  BOTTLE_SPOTS, BUOYS, BUOY_SPOTS, CAVE, CRAB_SPOTS, EBB_SONG, FLOOD_SONG, GLASS_SPOTS, GROUND, HUB, LIGHTHOUSE_POS, SCENERY, SHORE_EXIT, TIDE_BOARD_POS,
  buildShoreDecor, shoreGrid, type BuoyId, type FloorShape, type Tide,
} from '../systems/shoreLayout';

/** Colour of each bell (also on its emblem and the Tide Board). */
export const BUOY_HEX: Readonly<Record<BuoyId, number>> = { shell: 0xff8a6a, wave: 0x4fb4ff, star: 0xffd23a };
const GLASS_HUES = [0x7fe8d0, 0x8fd0ff, 0xb8f0a8, 0xffd0e8, 0xa8c8ff] as const;
const DEEP = 0.95;   // how far a gated piece of ground sinks below the deck when it is "under water"

const lam = (color: number, extra: Partial<ConstructorParameters<typeof MeshLambertMaterial>[0]> = {}): MeshLambertMaterial => withPaint(new MeshLambertMaterial({ color, flatShading: true, ...extra }));
const glowMat = (color: number, opacity: number): MeshBasicMaterial => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
const ease = (k: number): number => k * k * (3 - 2 * k);
const _q = new Quaternion(), _up = new Vector3(0, 1, 0);
const quatY = (a: number): Quaternion => _q.clone().setFromAxisAngle(_up, a);

// ---------------------------------------------------------------------------------------------------------------- canvas pictures
function emblem(id: BuoyId, size = 128): CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d')!, hex = '#' + BUOY_HEX[id].toString(16).padStart(6, '0'), c = size / 2;
  g.fillStyle = '#10223c'; g.beginPath(); g.arc(c, c, c - 3, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff6d8'; g.stroke();
  g.fillStyle = hex; g.strokeStyle = '#fff6d8'; g.lineWidth = 5; g.lineJoin = 'round';
  if (id === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 17 : 40; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }
  else if (id === 'wave') { g.lineWidth = 9; g.strokeStyle = hex; g.lineCap = 'round'; for (let row = 0; row < 3; row++) { g.beginPath(); for (let x = -36; x <= 36; x += 4) { const y = c - 22 + row * 22 + Math.sin(x * 0.17 + row) * 7; if (x === -36) g.moveTo(c + x, y); else g.lineTo(c + x, y); } g.stroke(); } }
  else { g.beginPath(); g.moveTo(c, c + 34); for (let i = 0; i <= 5; i++) { const a = Math.PI + (i / 5) * Math.PI; g.lineTo(c + Math.cos(a) * 40, c + 10 + Math.sin(a) * 40); } g.closePath(); g.fill(); g.stroke(); g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(c, c + 34); g.lineTo(c + i * 15, c - 22 + Math.abs(i) * 5); g.stroke(); } }
  const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace; return t;
}
/** The Tide Board: two rows of three emblems in order, each with a little picture of the tide it brings (low water = the sea drawn low, high water = high). */
function boardTexture(): CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320; const g = cv.getContext('2d')!;
  g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#e8dcb8'; g.fillRect(14, 14, 484, 292);
  const row = (song: readonly BuoyId[], y: number, high: boolean): void => {
    g.fillStyle = '#c8d8e8'; g.fillRect(28, y - 50, 70, 100); g.strokeStyle = '#3a2a1c'; g.lineWidth = 4; g.strokeRect(28, y - 50, 70, 100);
    g.fillStyle = '#3a8fc8'; const top = high ? y - 34 : y + 18; g.fillRect(30, top, 66, y + 48 - top);
    g.fillStyle = '#3a2a1c'; g.font = '700 22px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(high ? '\u25B2' : '\u25BC', 63, y - 56 + 2);
    song.forEach((b, i) => {
      const cx = 170 + i * 118, cy = y;
      const t = emblem(b, 128); void t; // the emblem is drawn straight onto the board below
      g.save(); g.translate(cx, cy); g.fillStyle = '#10223c'; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff6d8'; g.stroke();
      g.fillStyle = '#' + BUOY_HEX[b].toString(16).padStart(6, '0'); g.strokeStyle = '#' + BUOY_HEX[b].toString(16).padStart(6, '0'); g.lineWidth = 6; g.lineJoin = 'round'; g.lineCap = 'round';
      if (b === 'star') { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 10 : 26; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
      else if (b === 'wave') { for (let r2 = 0; r2 < 3; r2++) { g.beginPath(); for (let x = -22; x <= 22; x += 4) { const yy = -14 + r2 * 14 + Math.sin(x * 0.28 + r2) * 4; if (x === -22) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke(); } }
      else { g.beginPath(); g.moveTo(0, 22); for (let k = 0; k <= 5; k++) { const a = Math.PI + (k / 5) * Math.PI; g.lineTo(Math.cos(a) * 26, 6 + Math.sin(a) * 26); } g.closePath(); g.fill(); }
      g.restore();
      g.fillStyle = '#3a2a1c'; g.font = '700 26px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), cx, cy + 66);
      if (i < 2) { g.strokeStyle = '#3a2a1c'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx + 46, cy); g.lineTo(cx + 72, cy); g.lineTo(cx + 62, cy - 9); g.moveTo(cx + 72, cy); g.lineTo(cx + 62, cy + 9); g.stroke(); }
    });
  };
  row(EBB_SONG, 92, false); row(FLOOD_SONG, 232, true);
  const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t;
}
function plankTexture(): CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d')!;
  for (let i = 0; i < 8; i++) { const v = 200 + ((i * 37) % 30); g.fillStyle = `rgb(${v},${v - 28},${v - 70})`; g.fillRect(0, i * 16, 128, 16); g.fillStyle = 'rgba(40,24,10,.55)'; g.fillRect(0, i * 16, 128, 2); g.fillStyle = 'rgba(40,24,10,.25)'; g.fillRect(((i * 53) % 110) + 6, i * 16 + 2, 2, 14); }
  const t = new CanvasTexture(cv); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1, 1); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t;
}
function waveTexture(): CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const x = (i * 97) % 256, y = (i * 61) % 256, w = 14 + (i % 5) * 7; g.strokeStyle = `rgba(150,205,225,${0.22 + (i % 4) * 0.06})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke(); }
  const t = new CanvasTexture(cv); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(70, 70); t.colorSpace = SRGBColorSpace; return t;
}

// ---------------------------------------------------------------------------------------------------------------- small animated pieces
class BuoyView {
  readonly root = new Group(); private readonly top = new Group(); private readonly halo: Sprite; private readonly ping: Mesh; private flash = 0; lit = false;
  constructor(readonly id: BuoyId) {
    const p = BUOY_SPOTS[id], hex = BUOY_HEX[id];
    const k = new Kit().add(new CylinderGeometry(0.62, 0.45, 0.5, 12), 0xd8483a, M(0, 0.1, 0)).add(new CylinderGeometry(0.64, 0.62, 0.18, 12), 0xf6f0e0, M(0, 0.38, 0)).add(new CylinderGeometry(0.5, 0.64, 0.4, 12), 0xd8483a, M(0, 0.62, 0)).add(new CylinderGeometry(0.2, 0.5, 0.35, 10), 0xf6f0e0, M(0, 0.98, 0));
    k.cyl(0.05, 0.05, 0.75, 6, 0, 1.45, 0, 0x4a4a58);
    const body = new Mesh(k.build(0.1, 1), mat()); body.castShadow = true;
    const bell = new Kit().add(new SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), 0xf0c24a, M(0, 0, 0)).ball(0.07, 0, -0.28, 0, 0x4a3a20);
    const bellMesh = new Mesh(bell.build(0, 1), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x4a3410, emissiveIntensity: 0.5 })); bellMesh.castShadow = true;
    this.top.add(bellMesh); this.top.position.y = 1.95;
    const em = new Sprite(new SpriteMaterial({ map: emblem(id), transparent: true, depthWrite: false })); em.scale.set(1.2, 1.2, 1); em.position.y = 3.05;
    this.halo = glowSprite(hex, 3.6, 0.35); this.halo.position.y = 1.9;
    this.ping = new Mesh(new RingGeometry(0.8, 1.0, 36), glowMat(hex, 0)); this.ping.rotation.x = -Math.PI / 2; this.ping.position.y = 0.05;
    this.root.add(body, this.top, em, this.halo, this.ping); this.root.position.set(p.x, -0.05, p.z);
  }
  ring(): void { this.flash = 1; }
  update(t: number, dt: number, lit: boolean): void {
    this.flash = Math.max(0, this.flash - dt * 1.5); const i = BUOYS.indexOf(this.id);
    this.root.position.y = -0.05 + Math.sin(t * 1.6 + i * 2) * 0.07; this.root.rotation.z = Math.sin(t * 1.1 + i) * 0.05; this.root.rotation.x = Math.cos(t * 0.9 + i) * 0.04;
    this.top.rotation.z = Math.sin(t * 5 + i) * (0.08 + this.flash * 0.7) * (this.flash > 0 ? 1 : 0.4); this.top.rotation.x = Math.cos(t * 4.3 + i) * (0.05 + this.flash * 0.4);
    (this.halo.material as { opacity: number }).opacity = Math.min(1, (lit ? 0.6 : 0.28 + 0.1 * Math.sin(t * 2 + i)) + this.flash * 0.5); this.halo.scale.setScalar(3.6 + this.flash * 2);
    const pm = this.ping.material as MeshBasicMaterial; pm.opacity = this.flash * 0.8; this.ping.scale.setScalar(1 + (1 - this.flash) * 4);
  }
}

class GlassView {
  readonly root = new Group(); collected = false; private readonly gem: Mesh; private readonly halo: Sprite;
  constructor(readonly id: number, x: number, z: number) {
    const hue = GLASS_HUES[id % GLASS_HUES.length];
    this.gem = new Mesh(new IcosahedronGeometry(0.26, 0), new MeshLambertMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.35, transparent: true, opacity: 0.88, flatShading: true })); this.gem.scale.set(1, 0.7, 1.3);
    this.halo = glowSprite(hue, 1.9, 0.5); this.root.add(this.gem, this.halo); this.root.position.set(x, 0.55, z);
  }
  update(t: number): void { if (this.collected) return; this.gem.rotation.y = t * 1.3 + this.id; this.gem.rotation.z = Math.sin(t * 1.7 + this.id) * 0.4; this.root.position.y = 0.55 + Math.sin(t * 2 + this.id * 1.3) * 0.08; (this.halo.material as { opacity: number }).opacity = 0.4 + 0.2 * Math.sin(t * 3 + this.id); }
}

/** A message in a bottle lying in the sand: a glass bottle with a cork and a rolled note; glints until it is read. */
class BottleView {
  readonly root = new Group(); read = false; private flash = 0; private readonly halo: Sprite; private readonly note: Mesh;
  constructor(readonly id: number, p: { x: number; z: number }) {
    const glass = new Mesh(new CylinderGeometry(0.17, 0.2, 0.62, 10), new MeshLambertMaterial({ color: 0x9fe0d0, transparent: true, opacity: 0.7, emissive: 0x2a6a5a, emissiveIntensity: 0.4, flatShading: true }));
    const neck = new Mesh(new CylinderGeometry(0.07, 0.15, 0.3, 8), glass.material); neck.position.y = 0.44; const cork = new Mesh(new CylinderGeometry(0.075, 0.07, 0.1, 6), lam(0xb88a54)); cork.position.y = 0.64;
    this.note = new Mesh(new CylinderGeometry(0.06, 0.06, 0.42, 6), lam(0xf4ecd0)); this.note.position.y = 0.05;
    const b = new Group(); b.add(glass, neck, cork, this.note); b.rotation.z = Math.PI / 2 - 0.25; b.rotation.y = id * 1.4; b.position.y = 0.27;
    const sand = new Mesh(new CylinderGeometry(0.55, 0.7, 0.14, 8), lam(0xd9c08a)); sand.position.y = 0.04;
    this.halo = glowSprite(0xbff4e8, 2.2, 0.3); this.halo.position.y = 0.8; this.root.add(sand, b, this.halo); this.root.position.set(p.x, 0.02, p.z);
    for (const m of [glass, neck, cork, sand]) m.castShadow = true;
  }
  readNow(): void { this.read = true; this.flash = 1; }
  update(t: number, dt: number): void { this.flash = Math.max(0, this.flash - dt * 1.2); const glint = this.read ? 0.4 : 0.35 + 0.35 * Math.max(0, Math.sin(t * 2.1 + this.id * 2)); (this.halo.material as { opacity: number }).opacity = Math.min(0.9, 0.1 + glint * 0.4 + this.flash * 0.5); this.halo.scale.setScalar(2 + this.flash * 1.6); }
}

// ---------------------------------------------------------------------------------------------------------------- the world
export class ShoreWorld {
  readonly group = new Group();
  readonly grid: ColliderGrid = shoreGrid();
  private readonly parts = new Map<string, { g: Group; k: number; target: number }>();
  private readonly buoys: BuoyView[] = BUOYS.map(b => new BuoyView(b));
  private readonly glass: GlassView[] = GLASS_SPOTS.map((p, i) => new GlassView(i, p.x, p.z));
  private readonly bottles: BottleView[] = BOTTLE_SPOTS.map((p, i) => new BottleView(i, p));
  private readonly sea: Mesh<PlaneGeometry, MeshLambertMaterial>; private readonly seaTex: CanvasTexture;
  private readonly lampGlow: { s: Sprite; size: number }[] = [];
  private readonly ferry = new Group(); private readonly lampRoom: Mesh<BufferGeometry, MeshLambertMaterial>; private readonly beam: Group; private readonly lampHalo: Sprite;
  private readonly portal: Mesh; private readonly portalHalo: Sprite;
  private readonly pearls: { s: Sprite; ph: number }[] = [];
  private tide: Tide = 'still'; private causeway = false; private lampLit = false; private lampK = 0; private lampLevel = 0; private solved = false; private last = 0; private lampBright = 0.3;

  constructor(scene: Scene, quality: Quality = 'high') {
    const low = quality === 'low';
    this.group.name = 'shore'; this.group.visible = false; scene.add(this.group);
    this.seaTex = waveTexture();
    this.sea = new Mesh(new PlaneGeometry(900, 900), new MeshLambertMaterial({ color: 0x4fb0c8, map: this.seaTex, emissive: 0x0a2c40, transparent: true, opacity: 0.93 })) as ShoreWorld['sea'];
    this.sea.rotation.x = -Math.PI / 2; this.sea.position.set(0, -0.32, -14); this.sea.receiveShadow = true; this.group.add(this.sea);
    this.buildGround(); this.buildVillage(); this.buildBoard(); this.buildBells(); this.buildFlats(low); this.buildWrecks(); this.buildFerry();
    const lh = this.buildLighthouse(); this.lampRoom = lh.lamp; this.beam = lh.beam; this.lampHalo = lh.halo;
    this.buildCave(low);
    const ex = this.buildExit(); this.portal = ex.portal; this.portalHalo = ex.halo;
    for (const g of this.glass) this.group.add(g.root);
    for (const b of this.bottles) this.group.add(b.root);
    this.buildDecor(low);
    this.applyParts(true);
  }

  // ------------------------------------------------------------------------------------------------------------ state from the game
  get visible(): boolean { return this.group.visible; }
  set visible(v: boolean) { this.group.visible = v; }
  /** Moves the tide. `animate` is false when loading a save (the ground simply is where it should be). */
  setTide(tide: Tide, animate = true): void { this.tide = tide; this.applyParts(!animate); }
  setCauseway(open: boolean, animate = true): void { this.causeway = open; this.applyParts(!animate); }
  setGlass(found: readonly number[]): void { for (const g of this.glass) { g.collected = found.includes(g.id); g.root.visible = !g.collected; } }
  setBottles(read: readonly number[]): void { for (const b of this.bottles) b.read = read.includes(b.id); }
  readBottle(i: number): void { this.bottles[i]?.readNow(); }
  ringBuoy(id: BuoyId): void { this.buoys.find(b => b.id === id)?.ring(); }
  setSolved(on: boolean): void { this.solved = on; }
  /** The lamp: dim and cold until the hero lights it. `animate` false = already lit in the save. */
  setLampLit(on: boolean, animate = true): void { this.lampLit = on; if (!animate) this.lampK = on ? 1 : 0; }
  /** 0..1: how much the village lamps and lighthouse glow (evening). */
  setLampLevel(l: number): void { this.lampLevel = l; }
  glassPosition(i: number): { x: number; z: number } { return GLASS_SPOTS[i]; }

  private partTarget(gate: string): number { return gate === 'always' ? 1 : gate === 'low' ? (this.tide === 'low' ? 1 : 0) : gate === 'high' ? (this.tide === 'high' ? 1 : 0) : this.causeway ? 1 : 0; }
  private applyParts(snap: boolean): void {
    for (const gp of GROUND) {
      const p = this.parts.get(gp.part); if (!p) continue;
      p.target = this.partTarget(gp.gate); if (snap) p.k = p.target;
    }
    this.placeParts();
  }
  private placeParts(): void {
    for (const [name, p] of this.parts) { const e = ease(p.k); p.g.visible = p.k > 0.01; p.g.position.y = -DEEP * (1 - e); void name; }
  }

  // ------------------------------------------------------------------------------------------------------------ frame
  update(t: number, hero: { x: number; z: number }): void {
    const dt = Math.min(0.1, Math.max(0, t - this.last)); this.last = t;
    for (const b of this.buoys) b.update(t, dt, this.solved);
    for (const g of this.glass) g.update(t);
    for (const b of this.bottles) b.update(t, dt);
    // gated ground rises and sinks
    let moving = false;
    for (const p of this.parts.values()) if (p.k !== p.target) { p.k += Math.sign(p.target - p.k) * Math.min(Math.abs(p.target - p.k), dt * 0.9); moving = true; }
    if (moving) this.placeParts();
    // the sea slides slowly; the ferry bobs on it
    this.seaTex.offset.set((t * 0.004) % 1, (t * 0.0025) % 1); this.sea.position.x = Math.round(hero.x / 100) * 100; this.sea.position.z = -14 + Math.round(hero.z / 100) * 100;
    const fk = ease(this.parts.get('ferry-deck')?.k ?? 0); this.ferry.position.y = -DEEP * (1 - fk) + Math.sin(t * 1.4) * 0.05 * fk; this.ferry.rotation.z = Math.sin(t * 1.1) * 0.025 * fk; this.ferry.visible = fk > 0.01;
    // lamps and the lighthouse
    this.lampK += ((this.lampLit ? 1 : 0) - this.lampK) * Math.min(1, dt * 1.5); const night = Math.max(this.lampLevel, 0);
    for (const l of this.lampGlow) { (l.s.material as { opacity: number }).opacity = 0.12 + night * 0.7; l.s.scale.setScalar(l.size * (0.9 + night * 0.4)); }
    this.lampBright += ((0.28 + 0.95 * this.lampK) - this.lampBright) * Math.min(1, dt * 2);
    this.lampRoom.material.emissiveIntensity = 0.15 + this.lampBright * 1.4 + night * 0.4 * this.lampK; (this.lampHalo.material as { opacity: number }).opacity = 0.1 + this.lampBright * 0.55 + 0.05 * Math.sin(t * 2); this.lampHalo.scale.setScalar(6 + this.lampBright * 8);
    this.beam.visible = this.lampK > 0.02; this.beam.rotation.y = t * 0.8; this.beam.children.forEach(c => { ((c as Mesh).material as MeshBasicMaterial).opacity = (0.1 + 0.18 * night) * this.lampK; });
    for (const p of this.pearls) (p.s.material as { opacity: number }).opacity = 0.25 + 0.2 * Math.sin(t * 1.7 + p.ph) + 0.25 * this.lampK;
    (this.portal.material as MeshBasicMaterial).opacity = 0.28 + 0.1 * Math.sin(t * 2.4); (this.portalHalo.material as { opacity: number }).opacity = 0.4 + 0.12 * Math.sin(t * 1.9);
  }

  // ------------------------------------------------------------------------------------------------------------ building
  private groundGroup(name: string): Group { const g = new Group(); g.name = name; this.group.add(g); this.parts.set(name, { g, k: 1, target: 1 }); return g; }
  private buildGround(): void {
    const deck = new MeshLambertMaterial({ map: plankTexture(), color: 0xe8d4b4 }), sand = lam(0xe6d3a4), wet = lam(0xb59a6a), stone = lam(0x9a9aa4), shingle = lam(0xc9b98e);
    const skirt = lam(0x6a4e32);
    for (const gp of GROUND) {
      const g = this.groundGroup(gp.part), s = gp.shape;
      const material = ['hub', 'shell-pier', 'wave-pier', 'north-strip', 'star-jetty', 'shell-end', 'wave-end', 'star-end', 'ferry-deck'].includes(gp.part) ? deck : gp.part === 'causeway' || gp.part === 'causeway-foot' ? stone : gp.part === 'flats' || gp.part === 'flats-path' || gp.part === 'beach' || gp.part === 'beach-path' ? sand : gp.part === 'wreck' ? shingle : gp.part === 'island' ? lam(0x9aa88a) : wet;
      for (const m of this.slab(s, material, skirt, DEEP)) { m.receiveShadow = true; g.add(m); }
      if (gp.part === 'causeway') this.addCausewayPosts(g);
    }
    // wooden piles under the village deck
    const piles = new InstancedMesh(new CylinderGeometry(0.16, 0.2, 1.6, 6), lam(0x5a4028), 48), mtx = new Matrix4();
    let n = 0;
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; mtx.makeTranslation(HUB.x + Math.cos(a) * (HUB.r - 0.4), -0.7, HUB.z + Math.sin(a) * (HUB.r - 0.4)); piles.setMatrixAt(n++, mtx); }
    piles.count = n; piles.instanceMatrix.needsUpdate = true; this.parts.get('hub')!.g.add(piles);
  }
  /** A flat slab for a disc or a capsule, top at y = 0 and sides running down `depth` (so it can sink below the sea and rise again). */
  private slab(s: FloorShape, top: MeshLambertMaterial, side: MeshLambertMaterial, depth: number): Mesh[] {
    const out: Mesh[] = [];
    const scaleUv = (g: BufferGeometry, ku: number, kv: number, from = 0, to = Infinity): void => {   // plank texture: one tile = about 3.2 m, so the boards stay a believable size
      const uv = g.getAttribute('uv'); for (let i = from; i < Math.min(uv.count, to); i++) uv.setXY(i, uv.getX(i) * ku, uv.getY(i) * kv); uv.needsUpdate = true;
    };
    const cyl = (r: number, x: number, z: number): void => {
      const cg = new CylinderGeometry(r, r * 0.97, 0.3, 40); scaleUv(cg, (r * 2) / 3.2, (r * 2) / 3.2);
      const t = new Mesh(cg, [side, top, side]); t.position.set(x, -0.15, z); out.push(t);
      const b = new Mesh(new CylinderGeometry(r * 0.97, r * 0.9, depth, 24), side); b.position.set(x, -0.3 - depth / 2, z); out.push(b);
    };
    if (s.kind === 'disc') { cyl(s.r, s.x, s.z); return out; }
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz), mx = (s.a.x + s.b.x) / 2, mz = (s.a.z + s.b.z) / 2;
    const bg = new BoxGeometry(s.r * 2, 0.3, len); scaleUv(bg, (s.r * 2) / 3.2, len / 3.2, 8, 12);   // vertices 8 to 11 are the top face
    const t = new Mesh(bg, [side, side, top, side, side, side]); t.position.set(mx, -0.15, mz); t.rotation.y = ang; out.push(t);
    const b = new Mesh(new BoxGeometry(s.r * 1.9, depth, len), side); b.position.set(mx, -0.3 - depth / 2, mz); b.rotation.y = ang; out.push(b);
    for (const p of [s.a, s.b]) cyl(s.r, p.x, p.z);
    return out;
  }
  /** Mooring posts along the causeway, with a lantern on every other one. */
  private addCausewayPosts(g: Group): void {
    const k = new Kit();
    for (let i = 0; i < 8; i++) for (const sd of [-1, 1]) { const z = -13.5 - i * 2.9; k.cyl(0.14, 0.17, 1.0, 6, sd * 2.3, 0.5, z, 0x6a5238); if (i % 2 === 0) k.ball(0.14, sd * 2.3, 1.1, z, 0xffe9a0, 1, 1, 1, 1); }
    const m = new Mesh(k.build(0.1, 1), mat()); m.castShadow = true; g.add(m);
    for (let i = 0; i < 8; i += 2) for (const sd of [-1, 1]) { const sp = glowSprite(0xffe0a0, 1.4, 0.2); sp.position.set(sd * 2.3, 1.1, -13.5 - i * 2.9); g.add(sp); this.lampGlow.push({ s: sp, size: 1.4 }); }
  }

  private buildVillage(): void {
    const g = this.parts.get('hub')!.g;
    const WALL = [0xe8d4a8, 0xc9e0e4, 0xf0c8b0], ROOF = [0xc8573b, 0x3f84a0, 0x9c5a3c];
    const k = new Kit();
    buildShoreDecor().huts.forEach(h => {
      const w = 1.7 * h.r / 1.6, d = 1.5 * h.r / 1.6, c = Math.cos(h.rot), s = Math.sin(h.rot), at = (lx: number, lz: number) => ({ x: h.x + lx * c + lz * s, z: h.z - lx * s + lz * c });
      void at;
      k.add(new CylinderGeometry(0.1, 0.12, 1.1, 5), 0x5a4028, M(h.x - w * 0.8 * c - d * 0.8 * s, 0.55, h.z + w * 0.8 * s - d * 0.8 * c)); k.add(new CylinderGeometry(0.1, 0.12, 1.1, 5), 0x5a4028, M(h.x + w * 0.8 * c + d * 0.8 * s, 0.55, h.z - w * 0.8 * s + d * 0.8 * c));
      k.box(w * 2, 1.6, d * 2, h.x, 1.9, h.z, WALL[h.roof % 3], h.rot); k.box(w * 2 + 0.15, 0.12, d * 2 + 0.15, h.x, 1.1, h.z, 0x6e4a30, h.rot);
      k.add(new ConeGeometry(Math.max(w, d) * 1.55, 1.3, 4), ROOF[h.roof % 3], M(h.x, 3.3, h.z, 0, h.rot + Math.PI / 4, 0, 1, 1, 1));
      k.box(0.4, 0.7, 0.06, h.x + 0.0 * c, 1.55, h.z + d * 1.0 * c, 0x6e4a30, h.rot);   // a door
      k.box(0.34, 0.34, 0.06, h.x + w * 0.5 * c, 2.2, h.z - w * 0.5 * s + d * 1.0 * c * 0.98, 0xffe9a0, h.rot);   // a window (warm at night)
      k.cyl(0.05, 0.05, 1.0, 5, h.x + w * 1.1 * c + d * 0.2 * s, 0.6, h.z - w * 1.1 * s + d * 0.2 * c, 0x6a5238); k.box(0.7, 0.05, 0.05, h.x + w * 1.1 * c + d * 0.2 * s, 1.1, h.z - w * 1.1 * s + d * 0.2 * c, 0x6a5238, h.rot);   // a drying rack
      const gl = glowSprite(0xffd890, 1.6, 0.2); gl.position.set(h.x + w * 0.5 * c, 2.2, h.z - w * 0.5 * s + d * 1.1 * c); g.add(gl); this.lampGlow.push({ s: gl, size: 1.6 });
    });
    const m = new Mesh(k.build(0.15, 1.5), mat()); m.castShadow = m.receiveShadow = true; g.add(m);
    // lamp posts and barrels
    const lk = new Kit();
    for (const [x, z] of [[-3, 24], [3, 24], [-10, 12], [10, 12], [0, 8], [0, -6]] as const) { lk.cyl(0.07, 0.09, 2.0, 5, x, 1.0, z, 0x4a3a2a); lk.box(0.3, 0.3, 0.3, x, 2.1, z, 0xffe9a0); const sp = glowSprite(0xffe0a0, 2.4, 0.2); sp.position.set(x, 2.1, z); g.add(sp); this.lampGlow.push({ s: sp, size: 2.4 }); }
    for (const [x, z] of [[-3.6, 17.5], [2.4, 11.6], [7.2, 19], [-7.4, 14]] as const) lk.cyl(0.35, 0.38, 0.7, 8, x, 0.35, z, 0x8a5a38).cyl(0.37, 0.37, 0.05, 8, x, 0.6, z, 0x4a4a52);
    for (const [x, z, r] of [[-9.8, 14.4, 0.5], [6.4, 15.8, 0.6]] as const) lk.box(r * 1.6, r * 1.1, r * 1.2, x, r * 0.55, z, 0xa87a48);   // crates
    const lm = new Mesh(lk.build(0.12, 1), mat()); lm.castShadow = true; g.add(lm);
  }

  private buildBoard(): void {
    const g = this.parts.get('hub')!.g, root = new Group(), yaw = Math.atan2(HUB.x - TIDE_BOARD_POS.x, HUB.z - TIDE_BOARD_POS.z);
    const frame = new Kit().box(4.3, 2.8, 0.22, 0, 1.9, -0.14, 0x5a4028).box(0.28, 3.4, 0.3, -2.0, 1.7, -0.1, 0x6e4a30).box(0.28, 3.4, 0.3, 2.0, 1.7, -0.1, 0x6e4a30).box(4.6, 0.25, 0.4, 0, 3.55, -0.1, 0x7a5638);
    const fm = new Mesh(frame.build(0.2, 1.2), mat()); fm.castShadow = true; const board = new Mesh(new PlaneGeometry(4.0, 2.5), new MeshBasicMaterial({ map: boardTexture() })); board.position.set(0, 1.9, 0.0);
    root.add(fm, board); root.position.set(TIDE_BOARD_POS.x, 0, TIDE_BOARD_POS.z); root.rotation.y = yaw; g.add(root);
  }

  private buildBells(): void { for (const b of this.buoys) this.group.add(b.root); }

  private buildFlats(low: boolean): void {
    const g = this.parts.get('flats')!.g, k = new Kit();
    // boulders where the layout has solid rocks, a few tidepools (dark teal discs), starfish
    SCENERY.slice(5, 10).forEach((c, i) => { k.ball(c.r * 1.05, c.x, c.r * 0.55, c.z, i % 2 ? 0x7a7e86 : 0x6a6e78, 1, 0.8, 1, 1); k.ball(c.r * 0.55, c.x + c.r * 0.6, c.r * 0.3, c.z + c.r * 0.3, 0x8a8e96, 1, 0.8, 1, 1); k.ball(c.r * 0.25, c.x - c.r * 0.4, c.r * 1.0, c.z, 0x4ea870, 1, 0.7, 1, 0); });   // mossy boulders
    const m = new Mesh(k.build(0.15, 1), mat()); m.castShadow = m.receiveShadow = true; g.add(m);
    const pools: [number, number, number][] = [[-31, 12, 1.9], [-40, 1, 1.6], [-44, 9, 1.4], [-27.5, 3, 1.2], [-36, 15.5, 1.3], [-35, 7, 1.7]];
    for (const [x, z, r] of pools) {
      const p = new Mesh(new CircleGeometry(r, 24).rotateX(-Math.PI / 2), new MeshLambertMaterial({ color: 0x3aa8b0, emissive: 0x104050, transparent: true, opacity: 0.85 })); p.position.set(x, 0.03, z); g.add(p);
      const rim = new Mesh(new RingGeometry(r, r + 0.25, 24).rotateX(-Math.PI / 2), new MeshLambertMaterial({ color: 0xb59a6a })); rim.position.set(x, 0.025, z); g.add(rim);
    }
    const star = new Kit();
    [[-30.4, 11.2], [-40.6, 1.9], [-35.5, 15.0], [-43.4, 9.0]].forEach(([x, z], i) => {
      for (let a = 0; a < 5; a++) { const an = (a / 5) * Math.PI * 2; star.add(new ConeGeometry(0.1, 0.5, 4), i % 2 ? 0xff8a5a : 0xffb06a, M(x + Math.cos(an) * 0.25, 0.08, z + Math.sin(an) * 0.25, 0, -an, Math.PI / 2)); }
      star.ball(0.1, x, 0.1, z, 0xffc088, 1, 0.5, 1, 0);
    });
    g.add(new Mesh(star.build(0, 1), mat()));
    void low;
    // crab burrow mounds at the creature spots (decor only)
    for (const c of CRAB_SPOTS.slice(0, 3)) { const mound = new Mesh(new SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xcdb27a)); mound.position.set(c.x - 0.9, 0, c.z + 0.6); g.add(mound); }
  }

  private buildWrecks(): void {
    const g = this.parts.get('wreck')!.g, k = new Kit();
    const ribs = (cx: number, cz: number, n: number, span: number, h: number, rot: number): void => {
      k.box(span * 0.9, 0.3, 0.45, cx, h * 0.12, cz, 0x5a4636, rot);   // keel
      for (let i = 0; i < n; i++) { const u = (i / (n - 1) - 0.5) * span, c = Math.cos(rot), s = Math.sin(rot); for (const sd of [-1, 1]) k.box(0.22, h * (0.85 - Math.abs(i / (n - 1) - 0.5) * 0.7), 0.2, cx + u * c + sd * 0.9 * s, h * 0.45, cz - u * s + sd * 0.9 * c, 0x6a5440, rot, sd * 0.35); }
    };
    ribs(32, 6.8, 7, 5.4, 2.8, 0.35); ribs(40.6, 3.2, 8, 6.0, 3.2, -0.5);
    k.cyl(0.18, 0.24, 4.6, 6, 40.6, 2.3, 3.2, 0x5a4636); k.box(2.2, 0.16, 0.16, 40.6, 3.8, 3.2, 0x5a4636, 0.4); k.box(1.4, 1.1, 0.04, 41.2, 3.0, 3.25, 0xe6dcc4, 0.4);   // a broken mast with a rag of sail
    k.add(new TorusGeometry(0.65, 0.12, 6, 14), 0x7a5a3c, M(36, 0.7, 12.5, Math.PI / 2 - 0.4, 0.5, 0)); k.box(0.12, 1.3, 0.12, 36, 0.65, 12.5, 0x5a4636);   // a ship's wheel on a post
    for (const c of SCENERY.slice(3, 5)) k.ball(c.r, c.x, c.r * 0.5, c.z, 0x7a7e86, 1, 0.8, 1, 1);
    for (const [x, z, r] of [[34.4, 1.4, 0.5], [44.2, 8.6, 0.55], [30.2, 9.4, 0.45]] as const) k.box(r * 1.5, r, r * 1.1, x, r * 0.5, z, 0xa87a48, x);   // washed-up crates
    const m = new Mesh(k.build(0.15, 1.5), mat()); m.castShadow = m.receiveShadow = true; g.add(m);
    const gl = glowSprite(0xbfe6ff, 5, 0.18); gl.position.set(38, 2, 6); g.add(gl); this.pearls.push({ s: gl, ph: 0 });
  }

  private buildFerry(): void {
    const g = this.parts.get('ferry-deck')!.g;
    // a ferry raft along the deck path, with rails, a little mast with a sail and a lantern
    const a = { x: 10.5, z: 13 }, b = { x: 27, z: 10 }, len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(b.x - a.x, b.z - a.z), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const fk = new Kit();
    for (const sd of [-1, 1]) { fk.box(0.12, 0.6, len, sd * 2.45, 0.4, 0, 0x6e4a30); for (let i = 0; i <= 6; i++) fk.cyl(0.07, 0.07, 0.8, 5, sd * 2.45, 0.5, -len / 2 + (i / 6) * len, 0x5a4028); }
    fk.cyl(0.09, 0.11, 3.2, 6, 0, 1.6, len * 0.36, 0x5a4028); fk.box(0.3, 0.3, 0.3, 0, 3.3, len * 0.36, 0xffe9a0); fk.box(1.8, 1.2, 0.05, 0.9, 2.2, len * 0.36 - 0.1, 0xf0e6d0);
    const fm = new Mesh(fk.build(0.1, 1), mat()); fm.castShadow = true; fm.position.set(mx, 0.0, mz); fm.rotation.y = ang; this.ferry.add(fm); g.add(this.ferry);
    this.ferry.position.set(0, 0, 0);
    const gl = glowSprite(0xffe0a0, 2.2, 0.3); gl.position.set(mx + Math.sin(ang) * len * 0.36, 3.3, mz + Math.cos(ang) * len * 0.36); g.add(gl); this.lampGlow.push({ s: gl, size: 2.2 });
  }

  private buildLighthouse(): { lamp: Mesh<BufferGeometry, MeshLambertMaterial>; beam: Group; halo: Sprite } {
    const g = this.parts.get('island')!.g, c = LIGHTHOUSE_POS;
    const k = new Kit(); const H = 15;
    for (let i = 0; i < 6; i++) k.add(new CylinderGeometry(2.1 - (i + 1) * 0.2, 2.1 - i * 0.2, H / 6, 14), i % 2 ? 0xf6f0e0 : 0xd8483a, M(c.x, (i + 0.5) * (H / 6), c.z));
    k.add(new CylinderGeometry(2.6, 2.4, 0.3, 14), 0x5a5a68, M(c.x, 0.15, c.z)); k.add(new CylinderGeometry(2.4, 1.4, 0.4, 14), 0x4a4a58, M(c.x, H + 0.2, c.z)); k.add(new CylinderGeometry(2.6, 2.6, 0.12, 14), 0x3a3a48, M(c.x, H + 0.46, c.z));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.cyl(0.05, 0.05, 0.9, 4, c.x + Math.cos(a) * 2.5, H + 0.95, c.z + Math.sin(a) * 2.5, 0x3a3a48); }
    k.add(new ConeGeometry(1.7, 1.4, 14), 0xd8483a, M(c.x, H + 2.6, c.z + 0)); k.ball(0.16, c.x, H + 3.4, c.z, 0xf0c24a, 1, 1, 1, 1);
    k.box(0.9, 1.6, 0.2, c.x, 0.8, c.z + 2.0, 0x4a3a2a); for (const y of [4, 8, 11.5]) k.box(0.5, 0.7, 0.2, c.x + 0.0, y, c.z + 1.7 - (y / H) * 0.3, 0x2a3a5a);
    const base = new Mesh(k.build(0.15, 3), mat()); base.castShadow = base.receiveShadow = true; g.add(base);
    const lamp = new Mesh(new CylinderGeometry(1.2, 1.2, 1.2, 14), new MeshLambertMaterial({ color: 0xfff0c0, emissive: 0xffd070, emissiveIntensity: 0.2 })) as Mesh<BufferGeometry, MeshLambertMaterial>; lamp.position.set(c.x, H + 1.1, c.z); g.add(lamp);
    const halo = glowSprite(0xffe0a0, 8, 0.2); halo.position.copy(lamp.position); g.add(halo);
    const beam = new Group(); beam.position.copy(lamp.position);
    for (const sd of [0, Math.PI]) { const b = new Mesh(new ConeGeometry(2.6, 34, 12, 1, true), glowMat(0xfff0c0, 0.0)); b.rotation.z = -Math.PI / 2; b.rotation.y = sd; b.position.set(Math.cos(sd) * 17, 0, -Math.sin(sd) * 17); b.rotation.set(0, 0, sd === 0 ? -Math.PI / 2 : Math.PI / 2); beam.add(b); }
    g.add(beam); beam.visible = false;
    // the keeper's cottage, a boat on the shingle and a few boulders
    const ck = new Kit(); const hx = -9.4, hz = -38.4;
    ck.box(3.4, 2.0, 2.8, hx, 1.0, hz, 0xf0e2bc); ck.add(new ConeGeometry(2.7, 1.5, 4), 0x3f84a0, M(hx, 2.75, hz, 0, Math.PI / 4, 0)); ck.box(0.6, 1.1, 0.1, hx + 0.6, 0.55, hz + 1.42, 0x6e4a30); ck.box(0.5, 0.5, 0.1, hx - 0.8, 1.2, hz + 1.42, 0xffe9a0); ck.cyl(0.3, 0.3, 1.0, 6, hx - 1.0, 3.4, hz - 0.6, 0x8a6a5a);
    ck.box(2.6, 0.5, 1.0, 6.4, 0.3, -38.5, 0x7a5638, 0.4); ck.add(new SphereGeometry(0.5, 6, 4), 0xe6dcc4, M(6.4, 0.55, -38.5, 0, 0, 0, 2.2, 0.5, 0.9));
    const cm = new Mesh(ck.build(0.15, 1.5), mat()); cm.castShadow = true; g.add(cm);
    const gl = glowSprite(0xffd890, 1.8, 0.2); gl.position.set(hx - 0.8, 1.2, hz + 1.6); g.add(gl); this.lampGlow.push({ s: gl, size: 1.8 });
    return { lamp, beam, halo };
  }

  private buildCave(low: boolean): void {
    const g = this.parts.get('cave')!.g, rnd = (i: number): number => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    // a ring of rocks round the cave floor, left open toward the path; a crown of rock over the back
    const open = Math.atan2(-6.5 - CAVE.x, -50 - CAVE.z), rocks: Matrix4[] = [], tint = new Color(), n = low ? 22 : 34;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; let da = a - open; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 0.5) continue;
      const r = CAVE.r + 0.3 + rnd(i) * 0.5, sx = 1.2 + rnd(i + 3) * 1.1, sy = 2.2 + rnd(i + 9) * 2.4;
      rocks.push(new Matrix4().compose(new Vector3(CAVE.x + Math.cos(a) * r, sy * 0.4, CAVE.z + Math.sin(a) * r), quatY(rnd(i) * 6), new Vector3(sx, sy, sx)));
    }
    const mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), withPaint(new MeshLambertMaterial({ flatShading: true })), rocks.length);
    rocks.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, tint.setHex(0x3a4258).multiplyScalar(0.8 + rnd(i + 20) * 0.6)); }); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; g.add(mesh);
    const roof = new Mesh(new SphereGeometry(CAVE.r + 1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), new MeshLambertMaterial({ color: 0x2c3448, side: DoubleSide, flatShading: true })); roof.position.set(CAVE.x - 1.5, 3.2, CAVE.z - 2); roof.scale.set(1, 0.7, 1); g.add(roof);
    // a soft sea-green glow in the dark, and glinting pebbles
    const gl = glowSprite(0x6fe8d0, 11, 0.35); gl.position.set(CAVE.x, 1.4, CAVE.z); g.add(gl); this.pearls.push({ s: gl, ph: 1.3 });
    const k = new Kit(); for (let i = 0; i < 14; i++) { const a = rnd(i + 50) * 6.28, r = rnd(i + 60) * (CAVE.r - 1.2); k.ball(0.14 + rnd(i) * 0.1, CAVE.x + Math.cos(a) * r, 0.1, CAVE.z + Math.sin(a) * r, i % 2 ? 0x8fe8d0 : 0xb8d8ff, 1, 0.6, 1, 0); }
    g.add(new Mesh(k.build(0, 1), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a6a5a, emissiveIntensity: 0.6 })));
  }

  private buildExit(): { portal: Mesh; halo: Sprite } {
    const g = this.parts.get('beach')!.g, z = SHORE_EXIT.z + 1.3, k = new Kit();
    for (const s of [-1, 1]) { k.cyl(0.32, 0.42, 4.2, 7, s * 2.2, 2.1, 0, 0x8a6a48); k.add(new ConeGeometry(0.4, 0.8, 6), 0xe8f4ff, M(s * 2.2, 4.6, 0)); k.ball(0.3, s * 2.2, 0.4, 0.25, 0xe6dcc4, 1, 0.5, 1, 1); }
    k.box(5.2, 0.4, 0.5, 0, 4.2, 0, 0x7a5638); k.add(new TorusGeometry(0.5, 0.08, 6, 12), 0xe8e0d0, M(0, 3.2, 0.1)); k.ball(0.14, 0, 3.2, 0.1, 0xb8f0e8, 1, 1, 1, 1);
    const m = new Mesh(k.build(0.2, 1), mat()); m.position.set(SHORE_EXIT.x, 0, z); m.castShadow = true; g.add(m);
    const portal = new Mesh(new PlaneGeometry(3.6, 4.2), glowMat(0xbfe4ff, 0.3)); portal.position.set(SHORE_EXIT.x, 2.1, z); const halo = glowSprite(0xbfe4ff, 6.5, 0.45); halo.position.set(SHORE_EXIT.x, 2.3, z - 0.2);
    g.add(portal, halo); return { portal, halo };
  }

    /** Pebbles on the flats, wrecks and cave floor, reeds along the village edge. */
  private buildDecor(low: boolean): void {
    const d = buildShoreDecor(), mtx = new Matrix4(), tint = new Color();
    const peb = d.pebbles.filter((_, i) => !low || i % 2 === 0);
    const mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), withPaint(new MeshLambertMaterial({ flatShading: true })), peb.length);
    peb.forEach((p, i) => { mtx.compose(new Vector3(p.x, p.s * 0.3, p.z), quatY(p.rot), new Vector3(p.s * 1.4, p.s, p.s * 1.1)); mesh.setMatrixAt(i, mtx); mesh.setColorAt(i, tint.setHex(0x8a8a90).lerp(new Color(0xd8c8a0), p.tone)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.receiveShadow = true;
    // the pebbles belong to whichever ground they sit on, so they rise and sink with it
    this.group.add(mesh);
    const k = new Kit(); for (const r of d.reeds) for (let i = 0; i < 4; i++) k.add(new ConeGeometry(0.05, 0.9 * r.s, 4), i % 2 ? 0x7aa24a : 0x8ab85a, M(r.x + (i - 1.5) * 0.09, 0.4 * r.s, r.z + (i % 2) * 0.07, 0.1 * (i - 1.5), 0, 0.08 * (i - 1.5)));
    const rm = new Mesh(k.build(0, 1), mat()); this.parts.get('hub')!.g.add(rm);
  }
}
