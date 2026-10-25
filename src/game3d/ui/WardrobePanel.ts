import { PARTS, PART_KEYS, defaultOutfit, randomOutfit, type Outfit, type PartKey } from '../../game/art/parts';
import { TEXT, type Lang, type Strings } from '../data/woodsText';
import { ACCESSORY_CATALOG, type AccessorySlot, type Equipment } from '../systems/outfit3d';
import { PREVIEW_POSES, type Box, type PreviewPose } from '../systems/wardrobeCam';

export interface WardrobeHandlers {
  /** The outfit changed: show it on the hero and save it. */
  onOutfit(outfit: Outfit): void;
  onEquip(slot: AccessorySlot, id: string | null): void;
  onPose(pose: PreviewPose): void;
  /** Dragging on the picture turns the hero by this many radians. */
  onRotate(radians: number): void;
  onClose(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};
const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

type Tab = PartKey | 'extras';

/**
 * The wardrobe: the real hero, turned to face you in the real woods, with a panel to pick a colour for each of the eight parts
 * (the same swatches and the same saved look as the 2D wardrobe) and the extras (crown, cloak, lantern). The 3D picture itself is
 * drawn by Game3D; this class is only the panel and the drag area.
 */
export class WardrobePanel {
  readonly root: HTMLDivElement;
  private readonly drag: HTMLDivElement;
  private panel: HTMLDivElement;
  private s: Strings;
  private open_ = false;
  private outfit: Outfit = defaultOutfit();
  private equipment: Equipment = {};
  private unlocked: readonly string[] = [];
  private tab: Tab = 'tunic';
  private pose: PreviewPose = 'stand';
  private dragging: { id: number; x: number } | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft') { this.h.onRotate(-0.25); e.preventDefault(); } else if (e.code === 'ArrowRight') { this.h.onRotate(0.25); e.preventDefault(); }
  };

  constructor(parent: HTMLElement, lang: Lang, private readonly h: WardrobeHandlers) {
    this.s = TEXT[lang];
    this.root = el('div', 'mq-wd', parent);
    this.drag = el('div', 'mq-wd-drag', this.root);
    this.drag.addEventListener('pointerdown', e => { this.dragging = { id: e.pointerId, x: e.clientX }; try { this.drag.setPointerCapture(e.pointerId); } catch { /* fine */ } });
    this.drag.addEventListener('pointermove', e => { if (this.dragging && e.pointerId === this.dragging.id) { this.h.onRotate((e.clientX - this.dragging.x) * 0.012); this.dragging.x = e.clientX; } });
    const stop = (e: PointerEvent) => { if (this.dragging && e.pointerId === this.dragging.id) this.dragging = null; };
    this.drag.addEventListener('pointerup', stop); this.drag.addEventListener('pointercancel', stop);
    this.panel = el('div', 'mq-panel mq-wd-panel', this.root);
  }

  get isOpen(): boolean { return this.open_; }
  setLang(lang: Lang): void { this.s = TEXT[lang]; if (this.open_) this.render(); }

  open(outfit: Outfit, equipment: Equipment, unlocked: readonly string[]): void {
    this.outfit = { ...outfit }; this.equipment = { ...equipment }; this.unlocked = unlocked; this.pose = 'stand';
    this.open_ = true; this.root.style.display = 'block'; window.addEventListener('keydown', this.onKey); this.render();
  }
  close(): void {
    if (!this.open_) return;
    this.open_ = false; this.root.style.display = 'none'; window.removeEventListener('keydown', this.onKey); this.h.onClose();
  }

  /** The panel's rectangle inside the game area, so the 3D camera can keep the hero in the part of the screen the panel leaves free. */
  box(host: HTMLElement): { screen: { w: number; h: number }; panel: Box } | null {
    if (!this.open_) return null;
    const hr = host.getBoundingClientRect(), pr = this.panel.getBoundingClientRect();
    return { screen: { w: hr.width, h: hr.height }, panel: { x: pr.left - hr.left, y: pr.top - hr.top, w: pr.width, h: pr.height } };
  }

  private render(): void {
    const w = this.s.wardrobe, p = this.panel; p.textContent = '';
    const head = el('div', 'mq-wd-head', p);
    el('h2', '', head, `👕 ${w.title}`);
    const done = el('button', 'mq-chip mq-wd-done', head, `✔ ${w.done}`); done.type = 'button'; done.addEventListener('click', () => this.close());

    const tabs = el('div', 'mq-tabs', p);
    for (const k of PART_KEYS) {
      const t = el('button', `mq-tab${this.tab === k ? ' mq-on' : ''}`, tabs); t.type = 'button';
      const dot = el('i', 'mq-tab-dot', t); dot.style.background = css((PARTS[k].swatches[this.outfit[k]] ?? PARTS[k].swatches[0]).hex);
      el('span', '', t, w.parts[k]); t.addEventListener('click', () => { this.tab = k; this.render(); });
    }
    const ex = el('button', `mq-tab${this.tab === 'extras' ? ' mq-on' : ''}`, tabs, `✨ ${w.extras}`); ex.type = 'button'; ex.addEventListener('click', () => { this.tab = 'extras'; this.render(); });

    const body = el('div', 'mq-wd-body', p);
    if (this.tab === 'extras') this.renderExtras(body); else this.renderSwatches(body, this.tab);

    const poses = el('div', 'mq-chips mq-wd-poses', p);
    for (const pose of PREVIEW_POSES) {
      const c = el('button', `mq-chip${this.pose === pose ? ' mq-on' : ''}`, poses, w.moves[pose]); c.type = 'button';
      c.addEventListener('click', () => { this.pose = pose; this.h.onPose(pose); this.render(); });
    }
    const acts = el('div', 'mq-chips mq-wd-acts', p);
    const rnd = el('button', 'mq-chip', acts, `🎲 ${w.random}`); rnd.type = 'button';
    rnd.addEventListener('click', () => { this.outfit = randomOutfit(); this.h.onOutfit({ ...this.outfit }); this.render(); });
    const rst = el('button', 'mq-chip', acts, `↺ ${w.reset}`); rst.type = 'button';
    rst.addEventListener('click', () => { this.outfit = defaultOutfit(); this.h.onOutfit({ ...this.outfit }); this.render(); });
    el('div', 'mq-wd-drag-hint', p, `↔ ${w.drag}`);
  }

  private renderSwatches(body: HTMLElement, key: PartKey): void {
    const grid = el('div', 'mq-swatches', body);
    PARTS[key].swatches.forEach((sw, i) => {
      const b = el('button', `mq-sw${this.outfit[key] === i ? ' mq-on' : ''}`, grid); b.type = 'button';
      b.style.setProperty('--c', css(sw.hex)); b.title = sw.name; b.setAttribute('aria-label', sw.name); b.setAttribute('aria-pressed', String(this.outfit[key] === i));
      b.addEventListener('click', () => { this.outfit = { ...this.outfit, [key]: i }; this.h.onOutfit({ ...this.outfit }); this.render(); });
    });
  }

  private renderExtras(body: HTMLElement): void {
    for (const slot of ['head', 'back', 'hand'] as const) {
      const defs = ACCESSORY_CATALOG.filter(a => a.slot === slot); if (!defs.length) continue;
      const row = el('div', 'mq-row', body); el('span', '', row, slot === 'head' ? '🎩' : slot === 'back' ? '🧣' : '🏮');
      const chips = el('div', 'mq-chips', row);
      const none = el('button', `mq-chip${!this.equipment[slot] ? ' mq-on' : ''}`, chips, this.s.ui.none); none.type = 'button';
      none.addEventListener('click', () => this.equip(slot, null));
      for (const d of defs) {
        const locked = d.unlock !== null && !this.unlocked.includes(d.unlock);
        const c = el('button', `mq-chip${this.equipment[slot] === d.id ? ' mq-on' : ''}`, chips, `${locked ? '🔒 ' : ''}${this.s.accessory[d.id] ?? d.label}`); c.type = 'button'; c.disabled = locked;
        c.addEventListener('click', () => this.equip(slot, d.id));
      }
    }
  }
  private equip(slot: AccessorySlot, id: string | null): void {
    const next: Equipment = { ...this.equipment }; if (id) next[slot] = id; else delete next[slot];
    this.equipment = next; this.h.onEquip(slot, id); this.render();
  }
}
