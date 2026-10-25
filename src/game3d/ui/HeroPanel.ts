/**
 * v2.14: the Hero panel. One overlay with three tabs, all read live from the game through `read()` (never cached numbers):
 *  - Hero: level, XP to the next level, health, what is worn in each slot, the next level reward, and a button to the wardrobe.
 *  - Bag: what the hero has collected (glow petals, calmed sprouts, riddles, the Mossback) and the quest rewards earned.
 *    General items (loot, shop) do not exist yet; the integration point is `HeroView.bag` and the note at the bottom of the tab.
 *  - Journal: the quest as a checklist with the current step highlighted.
 */
import { TEXT, fill, type Lang, type Strings } from '../data/woodsText';
import { itemById, type CosmeticSlot } from '../cosmetics/catalog';
import { bagCounts, equippedList, journalSteps, levelInfo, nextLevelUnlock, questFraction } from '../systems/hudData';
import { summarise, type LearningProfile } from '../learning/profile';
import type { Progress } from '../systems/woodsQuest';
import { icon, tabIcon, type IconName } from './icons';
import { applyThumb, artHtml, type ThumbSource } from './thumbs';

export type HeroTab = 'hero' | 'bag' | 'journal';
export interface HeroView { progress: Progress; learning: LearningProfile; equipped: Readonly<Record<CosmeticSlot, string | null>>; hp: number; maxHp: number }
export interface HeroPanelHandlers { onClose(): void; onOutfit(): void }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};

export class HeroPanel {
  readonly root: HTMLElement;
  private readonly card: HTMLElement; private readonly body: HTMLElement; private readonly tabs: HTMLElement;
  private s: Strings; private lang: Lang; private tab: HeroTab = 'hero'; private open_ = false;

  constructor(parent: HTMLElement, lang: Lang, private readonly thumbs: ThumbSource | null, private readonly read: () => HeroView, private readonly h: HeroPanelHandlers) {
    this.lang = lang; this.s = TEXT[lang];
    this.root = el('div', 'mq-overlay mq-hero-overlay', parent); this.root.style.display = 'none';
    this.card = el('div', 'mq-panel mq-card mq-hero', this.root);
    this.card.setAttribute('role', 'dialog'); this.card.setAttribute('aria-modal', 'true');
    this.tabs = el('div', 'mq-hero-tabs', this.card); this.tabs.setAttribute('role', 'tablist');
    this.body = el('div', 'mq-hero-body', this.card);
    this.thumbs?.subscribe(id => { const it = itemById(id), u = it ? this.thumbs?.url(it) : null; if (it && u) applyThumb(this.root, it, u); });
    this.root.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === this.root) this.h.onClose(); });
  }

  get isOpen(): boolean { return this.open_; }
  get current(): HeroTab { return this.tab; }
  setLang(l: Lang): void { this.lang = l; this.s = TEXT[l]; if (this.open_) this.render(); }
  show(tab: HeroTab = this.tab): void { this.tab = tab; this.open_ = true; this.root.style.display = 'flex'; this.render(); }
  hide(): void { this.open_ = false; this.root.style.display = 'none'; }
  /** Re-reads the game state (call when something changes while the panel is open). */
  refresh(): void { if (this.open_) this.render(); }

  private render(): void {
    const t = this.s.hero, v = this.read();
    this.tabs.textContent = '';
    const defs: { id: HeroTab; label: string; ic: IconName }[] = [{ id: 'hero', label: t.heroTab, ic: 'hero' }, { id: 'bag', label: t.bagTab, ic: 'bag' }, { id: 'journal', label: t.journalTab, ic: 'scroll' }];
    for (const d of defs) {
      const b = el('button', `mq-hero-tab${d.id === this.tab ? ' mq-on' : ''}`, this.tabs); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(d.id === this.tab));
      b.innerHTML = icon(d.ic, 22); el('span', '', b, d.label);
      b.addEventListener('click', () => { this.tab = d.id; this.render(); });
    }
    const x = el('button', 'mq-hero-close', this.tabs); x.type = 'button'; x.setAttribute('aria-label', t.close); x.innerHTML = icon('close', 20);
    x.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.h.onClose(); });
    this.body.textContent = '';
    if (this.tab === 'hero') this.renderHero(v); else if (this.tab === 'bag') this.renderBag(v); else this.renderJournal(v);
  }

  private bar(parent: HTMLElement, frac: number, cls: string, text: string): void {
    const b = el('div', `mq-hero-bar ${cls}`, parent); el('div', 'mq-hero-fill', b).style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`; el('span', '', b, text);
  }

  private renderHero(v: HeroView): void {
    const t = this.s.hero, info = levelInfo(v.progress.xp);
    const top = el('div', 'mq-hero-top', this.body);
    const lv = el('div', 'mq-hero-lv', top); lv.innerHTML = icon('star', 54, 'mq-hero-star'); el('b', '', lv, String(info.level));
    const col = el('div', 'mq-hero-stats', top);
    el('div', 'mq-hero-h', col, `${t.level} ${info.level}`);
    this.bar(col, info.fraction, 'mq-xp', `${this.s.ui.xp} ${Math.round(info.xpInto)}/${info.xpNeeded}`);
    el('div', 'mq-hero-sub', col, fill(t.xpToNext, { n: info.xpToNext }));
    const hp = el('div', 'mq-hero-hp', col); hp.setAttribute('aria-label', `${t.health} ${v.hp}/${v.maxHp}`);
    for (let i = 0; i < v.maxHp; i++) { const h = el('span', i < v.hp ? '' : 'mq-empty', hp); h.innerHTML = icon(i < v.hp ? 'heartFull' : 'heartHollow', 22); }
    // next level reward
    const next = nextLevelUnlock(info.level); const nr = el('div', 'mq-hero-next', this.body);
    if (next) { nr.innerHTML = artHtml(next.item, this.thumbs, 48); const tx = el('div', '', nr); el('small', '', tx, `${t.nextReward} · ${this.s.ui.levelShort} ${next.level}`); el('b', '', tx, next.item.name[this.lang]); }
    else { nr.innerHTML = icon('trophy', 26); el('b', '', nr, t.allOpen); }
    // what is worn
    el('div', 'mq-hero-h2', this.body, t.wearing);
    const grid = el('div', 'mq-hero-slots', this.body);
    for (const { slot, item } of equippedList(v.equipped)) {
      const c = el('div', `mq-hero-slot${item ? '' : ' mq-none'}`, grid); c.innerHTML = item ? artHtml(item, this.thumbs, 46) : icon(tabIcon(slot), 28);
      el('small', '', c, this.s.cosmetics.slots[slot]); el('b', '', c, item ? item.name[this.lang] : t.nothing);
    }
    const go = el('button', 'mq-big mq-with-icon', this.body); go.type = 'button'; go.innerHTML = `${icon('shirt', 22)}<span></span>`; (go.lastElementChild as HTMLElement).textContent = t.changeOutfit;
    go.addEventListener('click', () => this.h.onOutfit());
  }

  private renderBag(v: HeroView): void {
    const t = this.s.hero, b = bagCounts(v.progress);
    el('div', 'mq-hero-h2', this.body, t.collected);
    const grid = el('div', 'mq-bag-grid', this.body);
    const cell = (ic: IconName, label: string, big: string, full: boolean): void => {
      const c = el('div', `mq-bag-cell${full ? ' mq-full' : ''}`, grid); c.innerHTML = icon(ic, 34); el('b', '', c, big); el('small', '', c, label);
    };
    cell('petal', t.petals, `${b.petals.done}/${b.petals.total}`, b.petals.done >= b.petals.total);
    cell('sprout', t.sprouts, `${b.sprouts.done}/${b.sprouts.total}`, b.sprouts.done >= b.sprouts.total);
    cell('rune', t.riddles, `${b.riddles.done}/${b.riddles.total}`, b.riddles.done >= b.riddles.total);
    cell('shield', t.mossback, b.mossbackCalmed ? t.calmed : t.waiting, b.mossbackCalmed);
    el('div', 'mq-hero-h2', this.body, t.rewards);
    const rw = el('div', 'mq-bag-rewards', this.body);
    if (!b.rewards.length) el('p', 'mq-hero-sub', rw, t.noRewards);
    for (const id of b.rewards) {
      const it = itemById(id); const r = el('div', 'mq-bag-reward', rw); r.innerHTML = it ? artHtml(it, this.thumbs, 44) : icon('gift', 26);
      el('b', '', r, it ? it.name[this.lang] : this.s.accessory[id] ?? id);
    }
    el('p', 'mq-hero-note', this.body, t.itemsSoon);
  }

  private renderJournal(v: HeroView): void {
    const t = this.s.hero; const frac = questFraction(v.progress);
    this.bar(this.body, frac, 'mq-quest-bar', `${Math.round(frac * 100)}%`);
    const list = el('ol', 'mq-journal', this.body);
    for (const st of journalSteps(v.progress)) {
      const li = el('li', `mq-j-${st.state}`, list); const mark = el('span', 'mq-j-mark', li);
      mark.innerHTML = st.state === 'done' ? icon('check', 16) : st.state === 'current' ? icon('flag', 18) : '';
      const label = el('b', '', li, t.stage[st.stage] + (st.count ? ` (${st.count.done}/${st.count.total})` : ''));
      if (st.state === 'current') el('em', '', label, ` ${t.now}`);
    }
    this.renderLearning(v);
  }

  /** The Rune practice list: only counters, saved on this device, with a gentle "fun to practise more" line (never a score or a grade). */
  private renderLearning(v: HeroView): void {
    const t = this.s.hero.learning, rows = summarise(v.learning);
    el('div', 'mq-hero-h2', this.body, t.title);
    if (!rows.length) { el('p', 'mq-hero-sub', this.body, t.none); return; }
    const list = el('div', 'mq-learn', this.body);
    for (const r of rows) {
      const row = el('div', 'mq-learn-row', list); el('b', '', row, t.skills[r.skill]);
      const pips = el('span', 'mq-pips', row); pips.setAttribute('role', 'img'); pips.setAttribute('aria-label', `${t.level} ${r.tier}/3`);
      for (let k = 1; k <= 3; k++) el('i', k <= r.tier ? 'mq-on' : '', pips);
      el('small', '', row, `${r.firstTry}/${r.completed} ${t.firstTry} · ${r.hints} ${t.hints}`);
    }
    const more = rows.filter(r => r.practice);
    if (more.length) el('p', 'mq-learn-more', this.body, `${t.tryMore}: ${more.map(r => t.skills[r.skill]).join(', ')}`);
    el('p', 'mq-hero-note', this.body, t.note);
  }
}
