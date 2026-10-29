import './hud3d.css';
import { TEXT, type Lang, type Strings } from '../data/woodsText';
import { icon, type IconName } from './icons';
import { ChallengeSession, type SessionResult } from '../learning/session';
import type { Riddle } from '../systems/runePuzzle';

/**
 * A question asked inside a conversation (no full-screen card): the speaker's last line is followed by answer buttons. It uses the same
 * `ChallengeSession` rules as the Rune Stone: hints are free, wrong answers explain the idea and never cost XP, and after two slips the
 * answer is shown, so the conversation can always finish. Only addition and taking away (shown with small petal pictures) are supported.
 */
import { clockFaceSvg } from './clockFace';
export interface DialogueQuestion {
  riddle: Riddle;
  /** v2.30: 'clock' draws clock faces and 'money' draws coins above the answers, instead of petals. */
  theme?: 'money' | 'clock';
  ask: string; hintLabel: string; hint: string; concept: string; tryAgain: string; right: string; rightFirst: string; revealed: string; explain: string;
  onEvent?(e: 'right' | 'wrong' | 'hint'): void;
  onResolved(res: SessionResult): void;
}
export interface HudHandlers {
  onResume(): void;
  onLang(l: Lang): void;
  onWardrobe(): void;
  onMap(): void;
  /** The Bag and Hero tiles open the Hero panel on that tab. */
  onPanel(tab: 'hero' | 'bag'): void;
  onSound(on: boolean): void;
  onStartOver(): void;
  onKeepExploring(): void;
  onDialogueNext(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};

/** Original round hero portrait (spiky hair, big eyes): drawn here, not taken from any other game. */
const PORTRAIT_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#9ad47a"/><circle cx="32" cy="36" r="19" fill="#ffd9b0"/><path d="M11 34C9 14 24 6 34 8c12-1 21 9 19 26-3-8-8-12-13-13-6 4-14 4-20 0-5 2-8 6-9 13z" fill="#e0643a"/><path d="M12 22l-5-8 10 3zM30 10l2-8 5 8zM48 16l8-5-3 11z" fill="#e0643a"/><ellipse cx="25" cy="38" rx="3.4" ry="4.4" fill="#2a1d14"/><ellipse cx="39" cy="38" rx="3.4" ry="4.4" fill="#2a1d14"/><circle cx="26.2" cy="36.6" r="1.3" fill="#fff"/><circle cx="40.2" cy="36.6" r="1.3" fill="#fff"/><path d="M27 46q5 4 10 0" fill="none" stroke="#a8503a" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="44" r="3" fill="#ff9a8a" opacity=".55"/><circle cx="44" cy="44" r="3" fill="#ff9a8a" opacity=".55"/></svg>`;

/** All on-screen text and menus, as plain DOM on top of the canvas (crisp text at any size, easy to translate). */
export class Hud3D {
  readonly root: HTMLDivElement;
  private s: Strings;
  private hearts: HTMLElement[] = [];
  private levelText: HTMLElement; private xpFill: HTMLElement; private xpText: HTMLElement; private objective: HTMLElement;
  private tideLine!: HTMLElement; private tideKey = ''; private questBar: HTMLElement; private questBarFill: HTMLElement; private tileEls: Partial<Record<'bag' | 'hero', HTMLButtonElement>> = {};
  private questBox: HTMLElement; private questLabel: HTMLElement; private questToggle: HTMLButtonElement; private lastObjective = '';
  private tileLabels: { el: HTMLElement; key: 'menu' | 'map' | 'bag' | 'hero' | 'sound' }[] = []; private soundIcon!: HTMLElement;
  private heartsBox: HTMLElement; private portraitBox: HTMLElement;
  private bossBox: HTMLElement; private bossName: HTMLElement; private bossFill: HTMLElement;
  private toasts: HTMLElement; private pops: HTMLElement;
  private dlg: HTMLElement; private dlgName: HTMLElement; private dlgText: HTMLElement; private dlgMore: HTMLElement; private dlgQ: HTMLElement;
  private qSpec: DialogueQuestion | null = null; private qSession: ChallengeSession | null = null; private qTip: 'hint' | 'concept' | null = null;
  private readonly onQKey = (e: KeyboardEvent) => {
    const k = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code);
    if (k < 0 || e.repeat || !this.qSession || this.qSession.done) return;
    this.qChoose(k % 3); e.preventDefault();
  };
  private soundBtn: HTMLButtonElement; private pauseOverlay: HTMLElement; private endOverlay: HTMLElement;
  private fade: HTMLElement; private hint: HTMLElement;
  private lines: string[] = []; private lineIdx = 0; private onDone: (() => void) | null = null; private speaker = '';
  private pauseOpen = false; private confirmReset = false;
  private lastLevel = 1; private lastXpInto = 0;
  private lang: Lang;
  private soundOn = true;
  private readonly blockers: (() => boolean)[] = [];

  constructor(parent: HTMLElement, lang: Lang, private readonly h: HudHandlers, private readonly onPauseButton: () => void) {
    this.lang = lang; this.s = TEXT[lang];
    this.root = el('div', 'mq-hud', parent);
    el('div', 'mq-vignette', this.root);
    // gradients shared by the HUD icons (glossy hearts); drawn once, referenced by url(#id) from the inline icons
    const defs = el('div', 'mq-defs', this.root); defs.setAttribute('aria-hidden', 'true');
    defs.innerHTML = '<svg width="0" height="0" focusable="false"><defs><linearGradient id="mq-g-heart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8d7a"/><stop offset=".55" stop-color="#ee4638"/><stop offset="1" stop-color="#b5221e"/></linearGradient></defs></svg>';
    // ---- top-left status card: portrait with a level badge, hearts, and an XP bar with its number
    const tl = el('div', 'mq-panel mq-topleft', this.root);
    const pw = el('div', 'mq-portrait-wrap', tl);
    this.portraitBox = el('div', 'mq-portrait', pw); this.portraitBox.innerHTML = PORTRAIT_SVG; // stands in until the real hero's picture is ready
    const badge = el('div', 'mq-lvbadge', pw); this.levelText = el('span', '', badge);
    const info = el('div', 'mq-tl-info', tl);
    this.heartsBox = el('div', 'mq-hearts', info);
    const lv = el('div', 'mq-level', info);
    const bar = el('div', 'mq-xpbar', lv); this.xpFill = el('div', 'mq-xpfill', bar); this.xpText = el('span', 'mq-xptext', bar);
    // ---- quest tracker: a compact card under the status card (not a banner across the top of the play area)
    this.questBox = el('div', 'mq-panel mq-quest', this.root);
    const qh = el('div', 'mq-q-head', this.questBox);
    const qi = el('span', 'mq-q-icon', qh); qi.innerHTML = icon('scroll', 20);
    this.questLabel = el('span', 'mq-q-label', qh, this.s.ui.quest);
    this.questToggle = el('button', 'mq-q-toggle', qh); this.questToggle.type = 'button'; this.questToggle.innerHTML = icon('chevron', 18); this.questToggle.setAttribute('aria-label', this.s.ui.collapse); this.questToggle.setAttribute('aria-expanded', 'true');
    this.objective = el('div', 'mq-q-text', this.questBox);
    this.tideLine = el('div', 'mq-q-tide', this.questBox); this.tideLine.style.display = 'none';
    this.questBar = el('div', 'mq-q-bar', this.questBox); this.questBarFill = el('div', 'mq-q-barfill', this.questBar); this.questBar.style.display = 'none';
    const toggleQuest = (e: Event) => { e.stopPropagation(); e.preventDefault(); const c = this.questBox.classList.toggle('mq-collapsed'); this.questToggle.setAttribute('aria-expanded', String(!c)); };
    this.questBox.addEventListener('pointerdown', toggleQuest);
    // ---- right-hand buttons
    const tiles = el('div', 'mq-tiles', this.root);
    const tile = (cls: string, svgMarkup: string, key: 'menu' | 'map' | 'bag' | 'hero' | 'sound', fn: () => void): HTMLButtonElement => {
      const b = el('button', `mq-tile ${cls}`, tiles); b.type = 'button'; b.setAttribute('aria-label', key);
      const ic = el('span', 'mq-tile-i', b); ic.innerHTML = svgMarkup; const lab = el('span', 'mq-tile-l', b); this.tileLabels.push({ el: lab, key });
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); fn(); });
      b.addEventListener('click', e => { if (e.detail === 0) fn(); }); // Enter/Space on a focused tile (a mouse or finger click already acted on pointerdown)
      if (key === 'sound') this.soundIcon = ic; return b;
    };
    tile('mq-pause', icon('pause', 26), 'menu', () => this.onPauseButton());
    tile('mq-mapbtn', icon('map', 26), 'map', () => this.h.onMap());
    this.tileEls.bag = tile('mq-bagbtn', icon('bag', 26), 'bag', () => this.h.onPanel('bag'));
    this.tileEls.hero = tile('mq-herobtn', icon('hero', 26), 'hero', () => this.h.onPanel('hero'));
    this.soundBtn = tile('mq-sound', icon('soundOn', 26), 'sound', () => this.h.onSound(!this.soundOn));
    this.relabel();
    this.bossBox = el('div', 'mq-panel mq-boss', this.root); this.bossName = el('div', '', this.bossBox); this.bossFill = el('div', 'mq-bossfill', el('div', 'mq-bossbar', this.bossBox));
    this.toasts = el('div', 'mq-toasts', this.root); this.toasts.setAttribute('role', 'status'); this.toasts.setAttribute('aria-live', 'polite'); this.pops = el('div', 'mq-pop-layer', this.root);
    this.hint = el('div', 'mq-panel mq-hint', this.root); this.hint.style.display = 'none';
    this.dlg = el('div', 'mq-panel mq-dialogue', this.root);
    this.dlgName = el('div', 'mq-name', this.dlg); this.dlgText = el('div', 'mq-text', this.dlg); this.dlgQ = el('div', 'mq-dq', this.dlg); this.dlgQ.style.display = 'none'; this.dlgMore = el('div', 'mq-more', this.dlg);
    this.dlg.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.h.onDialogueNext(); });
    this.fade = el('div', 'mq-fade', this.root);
    this.pauseOverlay = el('div', 'mq-overlay', this.root); this.endOverlay = el('div', 'mq-overlay', this.root);
    this.setHearts(5, 5);
  }

  setStrings(lang: Lang): void { this.lang = lang; this.s = TEXT[lang]; this.setLevel(this.lastLevel, this.lastXpInto); this.relabel(); if (this.pauseOpen) this.renderPause(); }
  /** Words on the HUD that depend on the language (tile labels, quest title). */
  private relabel(): void {
    const u = this.s.ui; const words = { menu: u.menu, bag: this.s.hero.bag, hero: this.s.hero.heroTab, sound: u.sound, map: this.s.map.title };
    for (const t of this.tileLabels) { t.el.textContent = words[t.key]; (t.el.parentElement as HTMLElement).setAttribute('aria-label', words[t.key]); }
    this.questLabel.textContent = u.quest; this.questToggle.setAttribute('aria-label', u.collapse);
  }
  setHearts(hp: number, max: number): void {
    if (this.hearts.length !== max) { this.heartsBox.textContent = ''; this.hearts = Array.from({ length: max }, () => { const h = el('span', 'mq-heart', this.heartsBox); h.innerHTML = icon('heartFull', 24); return h; }); }
    this.hearts.forEach((h, i) => { const empty = i >= hp; h.classList.toggle('mq-empty', empty); h.innerHTML = icon(empty ? 'heartHollow' : 'heartFull', 24); });
  }
  /** The round portrait shows a picture of the real hero (head, hair, hat and colours as worn); `url` comes from `HeroSnapshot`. */
  setPortrait(url: string): void {
    let img = this.portraitBox.querySelector('img');
    if (!img) { this.portraitBox.textContent = ''; img = document.createElement('img'); img.alt = ''; img.draggable = false; this.portraitBox.appendChild(img); }
    img.src = url;
  }
  pulseHeart(i: number): void { const h = this.hearts[i]; if (!h) return; h.classList.add('mq-pulse'); setTimeout(() => h.classList.remove('mq-pulse'), 200); }
  setLevel(level: number, xpInto: number): void {
    this.lastLevel = level; this.lastXpInto = xpInto;
    this.levelText.textContent = String(level); (this.levelText.parentElement as HTMLElement).setAttribute('aria-label', `${this.s.ui.level} ${level}`);
    this.xpFill.style.width = `${Math.min(100, xpInto)}%`; this.xpText.textContent = `${this.s.ui.xp} ${Math.round(xpInto)}/100`;
  }
  /** Progress line under the objective for counted goals (null hides it). */
  setObjectiveProgress(c: { done: number; total: number } | null): void {
    if (!c) { this.questBar.style.display = 'none'; return; }
    this.questBar.style.display = ''; this.questBarFill.style.width = `${Math.round((c.done / c.total) * 100)}%`;
    this.questBar.setAttribute('aria-label', `${c.done}/${c.total}`);
  }
  /** A short bounce on the Bag tile when something is collected. */
  pulseTile(k: 'bag' | 'hero'): void { const b = this.tileEls[k]; if (!b) return; b.classList.remove('mq-bounce'); void b.offsetWidth; b.classList.add('mq-bounce'); }
  setObjective(t: string): void {
    if (this.lastObjective === t) return;
    this.lastObjective = t; this.objective.textContent = t;
    this.questBox.classList.remove('mq-new'); void this.questBox.offsetWidth; this.questBox.classList.add('mq-new'); // a short glow when the goal changes
  }
  /** `name` overrides the boss bar's title (the Hollow Warden); without it the Mossback's name is used. */
  showBoss(frac: number | null, name?: string): void {
    if (frac === null) { this.bossBox.style.display = 'none'; this.root.classList.remove('mq-boss-on'); return; }
    this.root.classList.add('mq-boss-on');
    this.bossBox.style.display = 'block'; this.bossName.textContent = name ?? this.s.ui.boss; this.bossFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }
  /** v2.30: the shore's tide as words plus a wave-and-arrow glyph (null hides it). Low = waves low with a down arrow, high = waves high with an up arrow. */
  setTide(text: string | null, tide: 'low' | 'high' | 'still' = 'still'): void {
    const key = text === null ? '' : `${tide}|${text}`; if (this.tideKey === key) return; this.tideKey = key;
    if (text === null) { this.tideLine.style.display = 'none'; return; }
    const arrow = tide === 'low' ? '<path d="M5 3v7m-2.5-2.5L5 10l2.5-2.5"/>' : tide === 'high' ? '<path d="M5 10V3M2.5 5.5L5 3l2.5 2.5"/>' : '';
    const wave = (y: number): string => `<path d="M11 ${y}q2-2.4 4 0t4 0t4 0"/>`;
    const water = tide === 'high' ? wave(6) + wave(9.5) : tide === 'low' ? wave(11) : wave(8.5);
    this.tideLine.className = `mq-q-tide mq-tide-${tide}`; this.tideLine.style.display = 'flex'; this.tideLine.textContent = '';
    const g = el('span', 'mq-q-tide-i', this.tideLine); g.setAttribute('aria-hidden', 'true'); g.innerHTML = `<svg viewBox="0 0 26 14" width="30" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${arrow}${water}</svg>`;
    el('span', 'mq-q-tide-t', this.tideLine, text);
  }
  toast(text: string, ms = 3600, ic?: IconName): void {
    const t = el('div', 'mq-panel mq-toast', this.toasts);
    if (ic) { t.classList.add('mq-toast-i'); el('span', 'mq-toast-ic', t).innerHTML = icon(ic, 20); }
    el('span', '', t, text);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('mq-out'), ms); setTimeout(() => t.remove(), ms + 450);
  }
  floatText(x: number, y: number, text: string, color = '#fff'): void {
    const p = el('div', 'mq-pop', this.pops, text); p.style.left = `${x}px`; p.style.top = `${y}px`; p.style.color = color;
    setTimeout(() => p.remove(), 1150);
  }
  setHint(text: string | null): void { const d = text ? 'block' : 'none'; if (this.hint.style.display !== d) this.hint.style.display = d; if (text && this.hint.textContent !== text) this.hint.textContent = text; }
  fadeTo(black: boolean): void { this.fade.style.opacity = black ? '1' : '0'; }

  // dialogue
  get dialogueOpen(): boolean { return this.lines.length > 0; }
  openDialogue(speaker: string, lines: string[], onDone: () => void, question?: DialogueQuestion): void {
    this.speaker = speaker; this.lines = lines; this.lineIdx = 0; this.onDone = onDone; this.qSpec = question ?? null; this.qSession = null; this.qTip = null;
    this.dlg.style.display = 'block'; this.renderLine();
  }
  nextDialogue(): void {
    if (!this.lines.length) return;
    if (this.qSession) { // a question is open: only a finished one lets the conversation end
      if (!this.qSession.done) return;
      const done = this.onDone; this.closeDialogue(); done?.(); return;
    }
    this.lineIdx++;
    if (this.lineIdx >= this.lines.length) {
      if (this.qSpec) { this.qSession = new ChallengeSession(this.qSpec.riddle); window.addEventListener('keydown', this.onQKey); this.renderQuestion(); return; }
      const done = this.onDone; this.closeDialogue(); done?.();
    } else this.renderLine();
  }
  closeDialogue(): void {
    this.lines = []; this.onDone = null; this.qSpec = null; this.qSession = null; this.qTip = null;
    window.removeEventListener('keydown', this.onQKey); this.dlgQ.style.display = 'none'; this.dlg.style.display = 'none';
  }
  private qChoose(k: number): void {
    const q = this.qSpec, ses = this.qSession; if (!q || !ses) return;
    const res = ses.choose(k); if (res === 'ignored') return;
    if (res === 'right') q.onEvent?.('right'); else q.onEvent?.('wrong');
    if (res === 'wrong') this.qTip = 'concept';
    if (ses.done) q.onResolved(ses.result()!);
    this.renderQuestion();
  }
  private renderQuestion(): void {
    const q = this.qSpec, ses = this.qSession; if (!q || !ses) return;
    const r = q.riddle; this.dlgName.textContent = this.speaker; this.dlgText.textContent = q.ask;
    const box = this.dlgQ; box.textContent = ''; box.style.display = 'block';
    if (q.theme === 'clock' && (r.kind === 'add' || r.kind === 'subtract')) { // v2.30: a real clock face, so a whole-hour riddle can be seen as well as read
      const pics = el('div', 'mq-dq-pics mq-dq-clocks', box); pics.setAttribute('aria-hidden', 'true');
      const face = (hour: number): void => { const f = el('span', 'mq-dq-clock', pics); f.innerHTML = `${clockFaceSvg(hour)}<b>${hour}:00</b>`; };
      if (r.kind === 'add') { face(r.a); el('span', 'mq-dq-sign', pics, `+${r.b}`); el('span', 'mq-dq-sign mq-dq-hrs', pics).innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>'; }
      else { face(r.b); el('span', 'mq-dq-sign', pics, '\u2192'); face(r.a); }
    } else if ((r.kind === 'add' || r.kind === 'subtract') && r.a + (r.kind === 'add' ? r.b : 0) <= 12) { // small pictures help the youngest children count
      const pics = el('div', 'mq-dq-pics', box); pics.setAttribute('aria-hidden', 'true');
      if (q.theme === 'money') { const coins = (n: number, cls: string): void => { for (let k = 0; k < n; k++) el('span', `mq-dq-coin ${cls}`, pics, 'RM'); }; if (r.kind === 'add') { coins(r.a, ''); el('span', 'mq-dq-sign', pics, '+'); coins(r.b, 'mq-dq-alt'); } else { coins(r.a - r.b, ''); coins(r.b, 'mq-dq-away'); } }
      else {
      const petals = (n: number, cls: string): void => { for (let k = 0; k < n; k++) el('span', `mq-dq-petal ${cls}`, pics).innerHTML = icon('petal', 20); };
      if (r.kind === 'add') { petals(r.a, ''); el('span', 'mq-dq-sign', pics, '+'); petals(r.b, 'mq-dq-alt'); } else { petals(r.a - r.b, ''); petals(r.b, 'mq-dq-away'); }
      }
    }
    const opts = el('div', 'mq-dq-opts', box);
    r.options.forEach((t, k) => {
      const b = el('button', `mq-dq-opt${ses.done && k === r.answer ? ' mq-right' : ''}${ses.wrong.has(k) ? ' mq-wrong' : ''}`, opts, t); b.type = 'button'; b.disabled = ses.done || ses.wrong.has(k);
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.qChoose(k); });
      b.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) this.qChoose(k); });
    });
    const fb = el('div', 'mq-dq-fb', box); fb.setAttribute('aria-live', 'polite');
    if (ses.phase === 'solved') { fb.classList.add('mq-good'); fb.textContent = `${ses.slips === 0 ? q.rightFirst : q.right} ${q.explain}`; }
    else if (ses.phase === 'revealed') fb.textContent = `${q.revealed} ${q.explain}`;
    else if (this.qTip === 'concept') fb.textContent = `${q.tryAgain} ${q.concept}`;
    else if (this.qTip === 'hint') fb.textContent = q.hint;
    if (!ses.done) {
      const hb = el('button', 'mq-dq-hint', box); hb.type = 'button'; hb.innerHTML = icon('sparkles', 16); el('span', '', hb, q.hintLabel); hb.disabled = ses.hintUsed;
      const ask = (): void => { if (ses.hint()) { this.qTip = 'hint'; q.onEvent?.('hint'); this.renderQuestion(); } };
      hb.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); ask(); });
      hb.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) ask(); });
    }
    this.dlgMore.innerHTML = ses.done ? icon('check', 22) : '';
  }
  private renderLine(): void {
    this.dlgQ.style.display = 'none'; this.dlgName.textContent = this.speaker; this.dlgText.textContent = '';
    this.lines[this.lineIdx].split(/(\*[^*]+\*)/).forEach((part, i) => {
      if (!part) return; const hl = part.length > 2 && part.startsWith('*') && part.endsWith('*');
      el('span', hl ? `mq-hl mq-hl${i % 4}` : '', this.dlgText, hl ? part.slice(1, -1) : part);
    });
    this.dlgMore.innerHTML = icon(this.lineIdx < this.lines.length - 1 ? 'chevronRight' : 'check', 22);
  }

  // pause menu
  get paused(): boolean { return this.pauseOpen; }
  setPauseContext(soundOn: boolean): void { this.soundOn = soundOn; this.soundBtn.classList.toggle('mq-off', !soundOn); this.soundIcon.innerHTML = icon(soundOn ? 'soundOn' : 'soundOff', 26); if (this.pauseOpen) this.renderPause(); }
  openPause(): void { this.pauseOpen = true; this.confirmReset = false; this.renderPause(); this.pauseOverlay.style.display = 'flex'; }
  closePause(): void { this.pauseOpen = false; this.pauseOverlay.style.display = 'none'; }
  /** The wardrobe covers the pause menu without ending the pause (the game stays frozen behind it). */
  hidePauseMenu(hidden: boolean): void {
    this.root.classList.toggle('mq-wd-open', hidden);
    this.pauseOverlay.style.display = this.pauseOpen && !hidden ? 'flex' : 'none'; if (this.pauseOpen && !hidden) this.renderPause();
  }
  /** Anything else that covers the game (a riddle, the wardrobe) registers here so the world freezes behind it. */
  addBlocker(fn: () => boolean): void { this.blockers.push(fn); }
  private renderPause(): void {
    const o = this.pauseOverlay; o.textContent = '';
    const card = el('div', 'mq-panel mq-card', o);
    el('h2', '', card, this.s.ui.pause);
    const resume = el('button', 'mq-big mq-go', card, this.s.ui.resume); resume.type = 'button'; resume.addEventListener('click', () => this.h.onResume());
    const chip = (parent: HTMLElement, label: string, on: boolean, fn: () => void, disabled = false) => {
      const b = el('button', `mq-chip${on ? ' mq-on' : ''}`, parent, label); b.type = 'button'; b.disabled = disabled; b.addEventListener('click', fn); return b;
    };
    const lang = el('div', 'mq-row', card); el('span', '', lang, this.s.ui.language);
    const lc = el('div', 'mq-chips', lang); chip(lc, 'English', this.lang === 'en', () => this.h.onLang('en')); chip(lc, 'Bahasa Melayu', this.lang === 'ms', () => this.h.onLang('ms'));
    const snd = el('div', 'mq-row', card); el('span', '', snd, this.s.ui.sound);
    const sc = el('div', 'mq-chips', snd); chip(sc, this.s.ui.on, this.soundOn, () => this.h.onSound(true)); chip(sc, this.s.ui.off, !this.soundOn, () => this.h.onSound(false));
    const outfit = el('button', 'mq-big mq-with-icon', card); outfit.innerHTML = `${icon('shirt', 22)}<span></span>`; (outfit.lastElementChild as HTMLElement).textContent = this.s.ui.outfit; outfit.type = 'button'; outfit.addEventListener('click', () => this.h.onWardrobe());
    const reset = el('button', 'mq-big mq-warn', card, this.confirmReset ? this.s.ui.sure : this.s.ui.startOver); reset.type = 'button';
    reset.addEventListener('click', () => { if (this.confirmReset) this.h.onStartOver(); else { this.confirmReset = true; this.renderPause(); } });
    el('div', 'mq-row', card, this.s.ui.controls);
    const ul = el('ul', 'mq-help', card); for (const l of this.s.controlsHelp) el('li', '', ul, l);
  }

  showEnd(): void {
    const o = this.endOverlay; o.textContent = ''; o.style.display = 'flex';
    const card = el('div', 'mq-panel mq-card', o);
    const eh = el('h2', 'mq-with-ic', card); eh.innerHTML = icon('moon', 26); el('span', '', eh, this.s.ui.endTitle);
    const p = el('p', '', card, this.s.ui.endBody); p.style.textAlign = 'center'; p.style.lineHeight = '1.4';
    const keep = el('button', 'mq-big', card, this.s.ui.keepExploring); keep.type = 'button'; keep.addEventListener('click', () => { this.endOverlay.style.display = 'none'; this.h.onKeepExploring(); });
    const again = el('button', 'mq-big mq-warn', card, this.s.ui.playAgain); again.type = 'button'; again.addEventListener('click', () => { this.endOverlay.style.display = 'none'; this.h.onStartOver(); });
  }
  get endOpen(): boolean { return this.endOverlay.style.display === 'flex'; }
  /** True while any menu covers the game. */
  get blocking(): boolean { return this.pauseOpen || this.endOpen || this.blockers.some(f => f()); }
}
