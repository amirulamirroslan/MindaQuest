import { PARTS, defaultOutfit, randomOutfit, type Outfit, type PartKey } from '../../game/art/parts';
import { COLLECTIONS, OPTIONAL_SLOTS, RARITIES, itemsInSlot, itemById, type CosmeticSlot } from '../cosmetics/catalog';
import {
  TINT_SWATCHES, collectionProgress, lockReason, statusOf, type CosmeticsState, type OwnershipContext, type TintSlot,
} from '../cosmetics/inventory';
import { resolveLoadout } from '../cosmetics/loadout';
import { TEXT, fill, type Lang, type Strings } from '../data/woodsText';
import { PREVIEW_POSES, type Box, type PreviewPose } from '../systems/wardrobeCam';
import { icon, tabIcon } from './icons';
import { applyThumb, artHtml, type ThumbSource } from './thumbs';

export interface CosmeticsHandlers {
  onOutfit(outfit: Outfit): void;
  onEquip(slot: CosmeticSlot, id: string | null): void;
  onTint(slot: TintSlot, index: number): void;
  onReset(): void;
  onPose(pose: PreviewPose): void;
  /** Dragging on the picture turns the hero by this many radians. */
  onRotate(radians: number): void;
  /** Relative zoom step (+0.1 = 10 % further away). */
  onZoom(delta: number): void;
  onClose(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};
const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export type CosmeticsTab = CosmeticSlot | 'colours' | 'collections';
export const TABS: readonly { id: CosmeticsTab }[] = [
  { id: 'hair' }, { id: 'outfit' }, { id: 'legs' }, { id: 'shoes' }, { id: 'headgear' }, { id: 'cape' }, { id: 'weapon' }, { id: 'offhand' }, { id: 'colours' }, { id: 'collections' },
];
/** Which colour rows sit under each tab (wardrobe parts, or a cape/hat tint). */
export const TAB_COLOURS: Partial<Record<CosmeticsTab, readonly (PartKey | TintSlot)[]>> = {
  hair: ['hood'], outfit: ['tunic', 'gear'], legs: ['trousers'], shoes: ['boots'], headgear: ['headgear'], cape: ['cape'], weapon: ['steel'], colours: ['skin', 'eyes'],
};

/**
 * The customisation panel: a large 3D preview (the real hero, drawn by Game3D) with this panel beside it (desktop) or under it
 * (phone). Pure DOM; all state lives in Game3D and arrives through `setState`.
 */
export class CosmeticsPanel {
  readonly root: HTMLDivElement;
  private readonly drag: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private body: HTMLDivElement | null = null;
  private s: Strings;
  private open_ = false;
  private outfit: Outfit = defaultOutfit();
  private state: CosmeticsState | null = null;
  private ctx: OwnershipContext = { level: 1, unlocked: [] };
  private tab: CosmeticsTab = 'outfit';
  private pose: PreviewPose = 'stand';
  private picked: string | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft') { this.h.onRotate(-0.25); e.preventDefault(); } else if (e.code === 'ArrowRight') { this.h.onRotate(0.25); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') this.h.onZoom(-0.1); else if (e.key === '-') this.h.onZoom(0.1);
  };

  constructor(parent: HTMLElement, lang: Lang, private readonly thumbs: ThumbSource | null, private readonly h: CosmeticsHandlers) {
    this.s = TEXT[lang];
    this.thumbs?.subscribe(id => { const it = itemById(id), u = it ? this.thumbs?.url(it) : null; if (it && u) applyThumb(this.root, it, u); });
    this.root = el('div', 'mq-wd mq-cs', parent);
    this.drag = el('div', 'mq-wd-drag', this.root);
    this.drag.addEventListener('pointerdown', e => { this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.pinch = this.pinchDist(); try { this.drag.setPointerCapture(e.pointerId); } catch { /* fine */ } });
    this.drag.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      if (this.pointers.size >= 2) { p.x = e.clientX; p.y = e.clientY; const d = this.pinchDist(); if (this.pinch > 0 && d > 0) this.h.onZoom(this.pinch / d - 1); this.pinch = d; return; }
      this.h.onRotate((e.clientX - p.x) * 0.012); p.x = e.clientX; p.y = e.clientY;
    });
    const stop = (e: PointerEvent) => { this.pointers.delete(e.pointerId); this.pinch = this.pinchDist(); };
    this.drag.addEventListener('pointerup', stop); this.drag.addEventListener('pointercancel', stop);
    this.drag.addEventListener('wheel', e => { this.h.onZoom(Math.sign(e.deltaY) * 0.08); e.preventDefault(); }, { passive: false });
    this.panel = el('div', 'mq-panel mq-wd-panel mq-cs-panel', this.root);
  }
  private pinchDist(): number { const p = [...this.pointers.values()]; return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; }

  get isOpen(): boolean { return this.open_; }
  setLang(lang: Lang): void { this.s = TEXT[lang]; this.lang = lang; if (this.open_) this.render(); }
  private lang: Lang = 'en';

  open(outfit: Outfit, state: CosmeticsState, ctx: OwnershipContext): void {
    this.outfit = { ...outfit }; this.state = state; this.ctx = ctx; this.pose = 'stand'; this.picked = null;
    this.open_ = true; this.root.style.display = 'block'; window.addEventListener('keydown', this.onKey); this.render();
  }
  close(): void {
    if (!this.open_) return;
    this.open_ = false; this.root.style.display = 'none'; window.removeEventListener('keydown', this.onKey); this.h.onClose();
  }
  /** Game3D calls this after every change so the cards, badges and swatches stay true. */
  setState(state: CosmeticsState, outfit: Outfit, ctx: OwnershipContext): void {
    this.state = state; this.outfit = { ...outfit }; this.ctx = ctx; if (this.open_) this.render();
  }

  /** The panel's rectangle inside the game area, so the 3D camera can keep the hero in the part of the screen the panel leaves free. */
  box(host: HTMLElement): { screen: { w: number; h: number }; panel: Box } | null {
    if (!this.open_) return null;
    const hr = host.getBoundingClientRect(), pr = this.panel.getBoundingClientRect();
    return { screen: { w: hr.width, h: hr.height }, panel: { x: pr.left - hr.left, y: pr.top - hr.top, w: pr.width, h: pr.height } };
  }

  private render(): void {
    const st = this.state; if (!st) return;
    const keep = this.body?.scrollTop ?? 0;
    const w = this.s.wardrobe, c = this.s.cosmetics, p = this.panel; p.textContent = '';
    const head = el('div', 'mq-wd-head', p);
    const h2 = el('h2', '', head); h2.innerHTML = icon('shirt', 24); el('span', '', h2, w.title);
    const done = el('button', 'mq-chip mq-wd-done mq-with-icon', head); done.innerHTML = `${icon('check', 18)}<span></span>`; (done.lastElementChild as HTMLElement).textContent = w.done; done.type = 'button'; done.addEventListener('click', () => this.close());

    const tabs = el('div', 'mq-cs-tabs', p); tabs.setAttribute('role', 'tablist');
    for (const t of TABS) {
      const label = t.id === 'collections' ? c.collections : c.slots[t.id];
      const b = el('button', `mq-cs-tab${this.tab === t.id ? ' mq-on' : ''}`, tabs); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(this.tab === t.id));
      // a tab shows a picture of the item worn in that slot (the real 3D hero); the outline icon stands in for empty slots and the two non-item tabs
      const worn = t.id === 'colours' || t.id === 'collections' ? null : itemById(st.equipped[t.id] ?? '');
      el('span', 'mq-cs-tab-i', b).innerHTML = worn ? artHtml(worn, this.thumbs, 32) : icon(tabIcon(t.id), 24); el('span', 'mq-cs-tab-l', b, label);
      b.addEventListener('click', () => { this.tab = t.id; this.picked = null; this.render(); });
    }

    const body = this.body = el('div', 'mq-cs-body', p);
    if (this.tab === 'collections') this.renderCollections(body, st);
    else {
      if (this.tab !== 'colours') this.renderItems(body, st, this.tab);
      this.renderColours(body, st);
    }

    this.renderDetail(p, st);
    const tools = el('div', 'mq-cs-foot', p);
    for (const pose of PREVIEW_POSES) {
      const b = el('button', `mq-chip${this.pose === pose ? ' mq-on' : ''}`, tools, w.moves[pose]); b.type = 'button';
      b.addEventListener('click', () => { this.pose = pose; this.h.onPose(pose); this.render(); });
    }
    const rnd = el('button', 'mq-chip mq-with-icon', tools); rnd.innerHTML = `${icon('dice', 18)}<span></span>`; (rnd.lastElementChild as HTMLElement).textContent = w.random; rnd.type = 'button';
    rnd.addEventListener('click', () => { this.outfit = randomOutfit(); this.h.onOutfit({ ...this.outfit }); });
    const rst = el('button', 'mq-chip mq-with-icon', tools); rst.innerHTML = `${icon('reset', 18)}<span></span>`; (rst.lastElementChild as HTMLElement).textContent = w.reset; rst.type = 'button'; rst.addEventListener('click', () => this.h.onReset());

    const view = el('div', 'mq-cs-view', this.root); view.textContent = '';
    for (const [ic, label, fn] of [['rotL', c.turn, () => this.h.onRotate(-0.5)], ['rotR', c.turn, () => this.h.onRotate(0.5)], ['plus', c.zoom, () => this.h.onZoom(-0.12)], ['minus', c.zoom, () => this.h.onZoom(0.12)]] as const) {
      const b = el('button', 'mq-cs-vbtn', view); b.innerHTML = icon(ic, 24); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('click', fn);
    }
    this.root.querySelectorAll('.mq-cs-view').forEach((n, i) => { if (i > 0) n.remove(); });
    body.scrollTop = keep;
  }

  private renderItems(body: HTMLElement, st: CosmeticsState, slot: CosmeticSlot): void {
    const grid = el('div', 'mq-cs-grid', body);
    const sorted = [...itemsInSlot(slot)];
    if (OPTIONAL_SLOTS.includes(slot)) {
      const none = el('button', `mq-cs-card mq-cs-none${st.equipped[slot] === null ? ' mq-eq' : ''}`, grid); none.type = 'button';
      el('span', 'mq-cs-ico', none).innerHTML = icon('none', 34); el('span', 'mq-cs-name', none, this.s.cosmetics.none);
      none.addEventListener('click', () => { this.picked = null; this.h.onEquip(slot, null); });
    }
    const blocked = slot === 'offhand' && resolveLoadout(st).items.weapon?.twoHanded;
    for (const item of sorted) {
      const status = statusOf(item, st, this.ctx);
      const card = el('button', `mq-cs-card mq-r-${item.rarity} mq-${status === 'equipped' ? 'eq' : status === 'locked' ? 'lk' : 'ow'}${this.picked === item.id ? ' mq-pick' : ''}`, grid); card.type = 'button';
      el('span', 'mq-cs-ico mq-cs-art-wrap', card).innerHTML = artHtml(item, this.thumbs, 68);
      el('span', 'mq-cs-name', card, item.name[this.lang]);
      // one clear state chip per card: wearing (green), locked with what it takes (grey), or nothing when simply owned
      const lr = status === 'locked' ? lockReason(item) : null; const next = !!lr && lr.kind === 'level' && lr.level === this.ctx.level + 1;
      if (next) card.classList.add('mq-nx');
      const chip = el('span', `mq-cs-chip ${status === 'equipped' ? 'mq-chip-eq' : status === 'locked' ? 'mq-chip-lk' : 'mq-chip-ow'}`, card); chip.setAttribute('aria-hidden', 'true');
      if (status === 'equipped') { chip.innerHTML = icon('check', 12); el('span', '', chip, this.s.cosmetics.equipped); }
      else if (status === 'locked') { chip.innerHTML = icon(lr?.kind === 'quest' ? 'gift' : 'lock', 12); el('span', '', chip, lr?.kind === 'level' ? `${this.s.ui.levelShort} ${lr.level}` : lr?.kind === 'quest' ? this.s.ui.quest : this.s.ui.soon); }
      card.setAttribute('aria-pressed', String(status === 'equipped'));
      card.setAttribute('aria-label', `${item.name[this.lang]}, ${this.s.cosmetics.rarity[item.rarity]}, ${status === 'equipped' ? this.s.cosmetics.equipped : status === 'locked' ? this.s.cosmetics.locked : this.s.cosmetics.owned}`);
      card.addEventListener('click', () => {
        this.picked = item.id;
        if (status === 'owned') this.h.onEquip(slot, item.id); else if (status === 'equipped' && OPTIONAL_SLOTS.includes(slot)) this.h.onEquip(slot, null); else this.render();
      });
    }
    if (blocked) el('div', 'mq-cs-note', body, this.s.cosmetics.twoHanded);
  }

  private renderDetail(p: HTMLElement, st: CosmeticsState): void {
    const c = this.s.cosmetics;
    const item = this.picked ? itemById(this.picked) : undefined;
    const d = el('div', `mq-cs-detail${item ? '' : ' mq-empty'}`, p);
    if (!item) { el('span', '', d, c.turn); return; }
    const status = statusOf(item, st, this.ctx);
    const col = COLLECTIONS.find(x => x.id === item.collection)?.name[this.lang] ?? '';
    const t = el('div', 'mq-cs-dtext', d);
    el('b', '', t, item.name[this.lang]);
    el('small', `mq-r-txt mq-r-${item.rarity}`, t, ` ${c.rarity[item.rarity]} · ${col}`);
    const lr = lockReason(item);
    let info = status === 'equipped' ? c.equipped : status === 'owned' ? c.owned : '';
    if (status === 'locked' && lr) info = lr.kind === 'level' ? fill(c.reachLevel, { n: lr.level }) : lr.kind === 'quest' ? c.questReward : c.comingSoon;
    const di = el('div', 'mq-cs-dinfo', t); if (status === 'locked') di.innerHTML = `${icon('lock', 14)} `; el('span', '', di, info);
    if (status === 'owned') { const b = el('button', 'mq-chip mq-on', d, c.equip); b.type = 'button'; b.addEventListener('click', () => this.h.onEquip(item.slot, item.id)); }
    else if (status === 'equipped' && OPTIONAL_SLOTS.includes(item.slot)) { const b = el('button', 'mq-chip', d, c.unequip); b.type = 'button'; b.addEventListener('click', () => this.h.onEquip(item.slot, null)); }
  }

  private renderColours(body: HTMLElement, st: CosmeticsState): void {
    const rows = TAB_COLOURS[this.tab]; if (!rows) return;
    for (const key of rows) {
      const row = el('div', 'mq-cs-colrow', body);
      const isTint = key === 'cape' || key === 'headgear';
      const label = key === 'cape' ? this.s.cosmetics.capeTint : key === 'headgear' ? this.s.cosmetics.hatTint : this.s.wardrobe.parts[key];
      el('div', 'mq-cs-collabel', row, label);
      const grid = el('div', 'mq-swatches', row);
      const swatches = isTint ? PARTS.tunic.swatches.slice(0, TINT_SWATCHES) : PARTS[key as PartKey].swatches;
      const current = isTint ? st.tints[key as TintSlot] : this.outfit[key as PartKey];
      swatches.forEach((sw, i) => {
        const b = el('button', `mq-sw${current === i ? ' mq-on' : ''}${i === 0 ? ' mq-orig' : ''}`, grid); b.type = 'button';
        if (i === 0) b.innerHTML = icon('reset', 16);
        b.style.setProperty('--c', css(sw.hex)); b.title = sw.name; b.setAttribute('aria-label', `${label}: ${sw.name}`); b.setAttribute('aria-pressed', String(current === i));
        b.addEventListener('click', () => {
          if (isTint) this.h.onTint(key as TintSlot, i);
          else { this.outfit = { ...this.outfit, [key]: i }; this.h.onOutfit({ ...this.outfit }); }
        });
      });
    }
  }

  private renderCollections(body: HTMLElement, st: CosmeticsState): void {
    const prog = collectionProgress(st, this.ctx);
    for (const col of COLLECTIONS) {
      const p = prog[col.id] ?? { owned: 0, total: 0 };
      const row = el('div', 'mq-cs-coll', body);
      const top = el('div', 'mq-cs-colltop', row); el('b', '', top, col.name[this.lang]); el('span', '', top, `${p.owned}/${p.total} ${this.s.cosmetics.items}`);
      const bar = el('div', 'mq-cs-bar', row); const fillEl = el('i', '', bar); fillEl.style.width = `${p.total ? (100 * p.owned) / p.total : 0}%`;
    }
    const legend = el('div', 'mq-cs-legend', body);
    for (const r of RARITIES) el('span', `mq-r-txt mq-r-${r}`, legend, this.s.cosmetics.rarity[r]);
  }
}
