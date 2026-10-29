import { icon } from './icons';
import { isSymbolId, symbolSvg } from './puzzleSymbols';
import { TEXT, explanationText, fill, numberWord, type Lang, type Strings } from '../data/woodsText';
import { ChallengeSession, type SessionResult } from '../learning/session';
import { answerText, explain, type Riddle } from '../systems/runePuzzle';
import { RUNES_PER_RUN } from '../systems/woodsQuest';

export interface PuzzleHandlers {
  /** A riddle of the real run was answered (rightly, or after the answer was shown). Returns the XP it paid, shown on the card. */
  onSolved(index: number, mistakes: number): number;
  /** A riddle was put in front of the child (for the practice log and so it is not repeated soon). */
  onRiddleStart(r: Riddle): void;
  /** A riddle was finished, in a real or a practice run (for the practice log and to adapt difficulty). */
  onRiddleDone(r: Riddle, res: SessionResult): void;
  /** A fresh run for "Practise again", chosen from what the child has shown. */
  newRun(): Riddle[];
  /** A practice run reached its end with this many mistakes in all. */
  onPracticeDone(mistakes: number): void;
  onSound(name: 'tap' | 'right' | 'wrong' | 'wake', step?: number): void;
  onClose(): void;
}
export interface PuzzleStart {
  /** After the quest part is done the stone is for practice: same riddles, no XP. */
  practice: boolean;
  /** Which riddle of the run to start at (riddles already answered are not asked again). */
  startIndex: number;
  /** The three riddles, already chosen from the child's practice log. */
  run: Riddle[];
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent?.appendChild(e); return e;
};

type Tip = 'hint' | 'concept' | null;

/**
 * The Rune Stone's riddles as a DOM card over the game. The rules (hints, slips, reveal, first try) live in `ChallengeSession`.
 * Gentle by design: a hint is free, a wrong answer fades that button and explains the idea (counting riddles count out loud, one
 * petal at a time), and after two slips the answer is shown, so nobody is ever stuck.
 */
export class PuzzlePanel {
  readonly root: HTMLDivElement;
  private s: Strings;
  private lang: Lang;
  private start: PuzzleStart | null = null;
  private run: Riddle[] = [];
  private i = 0;
  private session!: ChallengeSession;
  private runSlips = 0;
  private stars = 0;
  private xpLast = 0;
  private finished = false;
  private tip: Tip = null;
  private counted: number[] = [];
  private timers: number[] = [];
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(parent: HTMLElement, lang: Lang, private readonly h: PuzzleHandlers) {
    this.s = TEXT[lang]; this.lang = lang;
    this.root = el('div', 'mq-overlay mq-pz', parent);
  }

  get isOpen(): boolean { return this.start !== null; }
  setLang(lang: Lang): void { this.s = TEXT[lang]; this.lang = lang; if (this.isOpen) this.render(); }

  open(start: PuzzleStart): void {
    this.start = start; this.run = start.run;
    this.i = Math.max(0, Math.min(this.run.length - 1, start.practice ? 0 : start.startIndex));
    this.stars = 0; this.runSlips = 0; this.finished = false; this.beginRiddle();
    this.root.style.display = 'flex'; window.addEventListener('keydown', this.onKey);
    this.render();
  }

  close(): void {
    if (!this.start) return;
    this.clearTimers(); this.start = null; this.root.style.display = 'none'; this.root.textContent = ''; window.removeEventListener('keydown', this.onKey);
    this.h.onClose();
  }

  // ---------- flow ----------
  private beginRiddle(): void { this.session = new ChallengeSession(this.run[this.i]); this.tip = null; this.counted = []; this.clearTimers(); this.h.onRiddleStart(this.run[this.i]); }
  private get riddle(): Riddle { return this.run[this.i]; }
  private get phase(): 'asking' | 'solved' | 'revealed' | 'finished' { return this.finished ? 'finished' : this.session.phase; }
  private get practice(): boolean { return this.start?.practice === true; }
  private clearTimers(): void { for (const t of this.timers) window.clearTimeout(t); this.timers = []; }
  private later(ms: number, fn: () => void): void { this.timers.push(window.setTimeout(fn, ms)); }

  private choose(index: number): void {
    const r = this.riddle, res = this.session.choose(index);
    if (res === 'ignored') return; // finished, out of range, or a button already tried (faded): the 1-2-3 keys must not count it again
    if (res === 'right') {
      if (this.session.firstTry) this.stars++;
      this.xpLast = this.practice ? 0 : this.h.onSolved(this.i, this.session.slips);
      this.h.onSound('right'); this.h.onRiddleDone(r, this.session.result()!);
    } else {
      this.runSlips++; this.h.onSound('wrong'); this.tip = 'concept';
      if (res === 'revealed') { this.xpLast = this.practice ? 0 : this.h.onSolved(this.i, this.session.slips); this.h.onRiddleDone(r, this.session.result()!); }
      else if (r.kind !== 'pattern') this.autoCount();
    }
    this.render();
  }

  /** The free hint before (or between) answers. Counting riddles start counting out loud. */
  private askHint(): void {
    if (!this.session.hint()) return;
    this.tip = 'hint'; this.h.onSound('tap', 1);
    if (this.riddle.kind !== 'pattern') this.autoCount();
    this.render();
  }

  private next(): void {
    if (!this.session.done) return;
    if (this.i >= this.run.length - 1) {
      this.finished = true; this.clearTimers();
      if (this.practice) this.h.onPracticeDone(this.runSlips); else this.h.onSound('wake');
      this.render(); return;
    }
    this.i++; this.beginRiddle(); this.render();
  }

  private again(): void {
    if (!this.start) return;
    this.start = { ...this.start, practice: true }; this.run = this.h.newRun();
    this.i = 0; this.stars = 0; this.runSlips = 0; this.finished = false; this.beginRiddle(); this.render();
  }

  private key(e: KeyboardEvent): void {
    if (!this.isOpen || e.repeat) return;
    if (this.phase === 'asking' && ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code)) { this.choose(Number(e.code.slice(-1)) - 1); e.preventDefault(); }
    else if ((e.code === 'Enter') && (this.phase === 'solved' || this.phase === 'revealed') && !(e.target instanceof HTMLButtonElement)) { this.next(); e.preventDefault(); }
  }

  // ---------- counting ----------
  private tapPetal(id: number): void {
    if (this.phase !== 'asking' || this.counted.includes(id)) return;
    this.counted.push(id); this.h.onSound('tap', this.counted.length - 1);
    this.showNumbers();
  }
  /** Counts the petals out loud for the child, one every ~0.4 s (only the ones that are really there: floating-away petals are skipped). */
  private autoCount(): void {
    this.clearTimers(); this.counted = [];
    const ids = this.countableIds();
    ids.forEach((id, k) => this.later(350 + k * 420, () => { this.counted.push(id); this.h.onSound('tap', k); this.showNumbers(); }));
  }
  private countableIds(): number[] {
    const r = this.riddle;
    const n = r.kind === 'count' || r.kind === 'recognise' ? r.n : r.kind === 'subtract' ? r.a - r.b : r.kind === 'add' || r.kind === 'twostep' ? r.a + r.b : 0;
    return Array.from({ length: n }, (_, k) => k);
  }
  private showNumbers(): void {
    this.root.querySelectorAll<HTMLElement>('.mq-petal[data-id]').forEach(p => {
      const n = this.counted.indexOf(Number(p.dataset.id));
      p.classList.toggle('mq-counted', n >= 0);
      (p.querySelector('.mq-petal-num') as HTMLElement).textContent = n >= 0 ? String(n + 1) : '';
    });
  }

  /** Shows a riddle token: a drawn picture for pattern symbols, plain text for numbers and the "?" gap. */
  private token(target: HTMLElement, t: string): void {
    if (isSymbolId(t)) { target.innerHTML = symbolSvg(t, 32); target.setAttribute('aria-label', this.s.puzzle.symbol[t]); target.setAttribute('role', 'img'); } else target.textContent = t;
  }

  // ---------- drawing ----------
  private petal(parent: HTMLElement, id: number, opts: { alt?: boolean; away?: boolean } = {}): void {
    const b = el('button', `mq-petal${opts.alt ? ' mq-petal-b' : ''}${opts.away ? ' mq-away' : ''}`, parent); b.type = 'button';
    b.setAttribute('aria-label', this.s.toast.petal);
    el('span', 'mq-petal-num', b);
    if (opts.away) { b.disabled = true; el('span', 'mq-away-mark', b).innerHTML = icon('arrowUpRight', 18); } else { b.dataset.id = String(id); b.addEventListener('click', () => this.tapPetal(id)); }
  }

  private render(): void {
    const st = this.start; if (!st) return;
    const o = this.root; o.textContent = '';
    const card = el('div', 'mq-panel mq-card mq-pz-card', o);
    const head = el('div', 'mq-pz-head', card);
    const ti = el('div', 'mq-pz-title mq-with-ic', head); ti.innerHTML = icon('rune', 22); el('span', '', ti, st.practice ? this.s.puzzle.practiceTitle : this.s.puzzle.title);
    const x = el('button', 'mq-pz-x', head); x.innerHTML = icon('close', 20); x.type = 'button'; x.setAttribute('aria-label', this.s.puzzle.close); x.addEventListener('click', () => this.close());
    const dots = el('div', 'mq-dots', card);
    for (let k = 0; k < RUNES_PER_RUN; k++) {
      const solved = this.finished || k < this.i || (k === this.i && this.session.done);
      el('span', `mq-dot${solved ? ' mq-done' : k === this.i ? ' mq-now' : ''}`, dots);
    }
    if (this.finished) { this.renderFinished(card); return; }

    const r = this.riddle, p = this.s.puzzle;
    el('div', 'mq-pz-kind', card, `${fill(p.riddleOf, { n: this.i + 1, total: RUNES_PER_RUN })} · ${p.runeName[r.kind]}`);
    el('div', 'mq-pz-ask', card, this.askText(r));

    const stage = el('div', 'mq-pz-stage', card);
    if (r.kind === 'pattern') {
      const seq = el('div', 'mq-seq', stage);
      for (const t of r.sequence) this.token(el('span', 'mq-tok', seq), t);
      const done = this.session.done;
      this.token(el('span', `mq-tok mq-gap${done ? ' mq-filled' : ''}`, seq), done ? answerText(r) : '?');
    } else if (r.kind === 'count' || r.kind === 'recognise') {
      if (r.kind === 'recognise') el('div', 'mq-word', stage, numberWord(this.lang, r.n));
      const pond = el('div', 'mq-pond', stage); for (let k = 0; k < r.n; k++) this.petal(pond, k);
    } else if (r.kind === 'twostep') {
      const pond = el('div', 'mq-pond', stage);
      for (let k = 0; k < r.a; k++) this.petal(pond, k);
      el('span', 'mq-plus', pond, '+');
      for (let k = 0; k < r.b; k++) this.petal(pond, r.a + k, { alt: true });
      el('span', 'mq-plus', pond, '−');
      for (let k = 0; k < r.c; k++) this.petal(pond, -1 - k, { alt: true, away: true });
    } else if (r.kind === 'add') {
      const pond = el('div', 'mq-pond', stage);
      for (let k = 0; k < r.a; k++) this.petal(pond, k);
      el('span', 'mq-plus', pond, '+');
      for (let k = 0; k < r.b; k++) this.petal(pond, r.a + k, { alt: true });
    } else {
      const pond = el('div', 'mq-pond', stage);
      for (let k = 0; k < r.a - r.b; k++) this.petal(pond, k);
      for (let k = 0; k < r.b; k++) this.petal(pond, -1 - k, { alt: true, away: true });
    }
    if (r.kind !== 'pattern') {
      const row = el('div', 'mq-count-row', stage);
      el('span', 'mq-tap-note', row, p.tapToCount);
      const re = el('button', 'mq-mini mq-with-ic', row); re.innerHTML = icon('reset', 16); el('span', '', re, p.startOverCount); re.type = 'button';
      re.addEventListener('click', () => { this.clearTimers(); this.counted = []; this.showNumbers(); });
    }

    const opts = el('div', 'mq-opts', card);
    r.options.forEach((t, k) => {
      const right = k === r.answer;
      const done = this.session.done, wrong = this.session.wrong.has(k);
      const cls = `mq-opt${done && right ? ' mq-right' : ''}${wrong ? ' mq-wrong' : ''}`;
      const b = el('button', cls, opts); this.token(b, t); b.type = 'button'; b.disabled = done || wrong;
      b.addEventListener('click', () => this.choose(k));
    });

    const fb = el('div', 'mq-pz-feedback', card); fb.setAttribute('aria-live', 'polite');
    if (this.session.phase === 'solved') {
      fb.classList.add('mq-good');
      fb.textContent = `${this.session.slips === 0 ? p.correctFirst : p.correct}${this.xpLast > 0 ? `  +${this.xpLast} ${p.xp}` : ''}`;
    } else if (this.session.phase === 'revealed') {
      fb.textContent = fill(p.revealed, { n: answerText(r) });
    } else if (this.tip === 'concept') {
      fb.classList.add('mq-pz-tip'); fb.textContent = `${p.tryAgain} ${this.conceptText(r)}`;
    } else if (this.tip === 'hint') {
      fb.classList.add('mq-pz-tip'); fb.textContent = this.hintText(r);
    }
    if (!this.session.done) {
      const hb = el('button', 'mq-mini mq-hint-btn mq-with-ic', card); hb.type = 'button'; hb.innerHTML = icon('sparkles', 16); el('span', '', hb, p.hintLabel);
      hb.disabled = this.session.hintUsed; hb.addEventListener('click', () => this.askHint());
    }
    if (this.session.done) {
      el('div', 'mq-pz-explain', card, explanationText(this.lang, explain(r)));
      const last = this.i >= this.run.length - 1;
      const go = el('button', 'mq-big', card, last ? (this.practice ? p.next : p.finish) : p.next); go.type = 'button'; go.addEventListener('click', () => this.next());
    }
    if (st.practice) el('div', 'mq-pz-note', card, p.practiceNote);
    // keep the counted numbers when the card is redrawn (for example after a wrong answer)
    if (this.counted.length) this.showNumbers();
  }

  private askText(r: Riddle): string {
    const p = this.s.puzzle;
    switch (r.kind) {
      case 'count': return p.askCount;
      case 'recognise': return fill(p.askRecognise, { w: numberWord(this.lang, r.n) });
      case 'pattern': return p.askPattern;
      case 'add': return fill(p.askAdd, { a: r.a, b: r.b });
      case 'subtract': return fill(p.askSubtract, { a: r.a, b: r.b });
      case 'twostep': return fill(p.askTwoStep, { a: r.a, b: r.b, c: r.c });
    }
  }
  /** A nudge, asked for before answering. */
  private hintText(r: Riddle): string { const p = this.s.puzzle; return r.kind === 'pattern' && r.rule !== 'up' && r.rule !== 'down' ? p.hint.pattern : r.kind === 'pattern' ? p.hintStep : p.hint[r.kind]; }
  /** The idea behind the riddle, shown after a wrong answer. */
  private conceptText(r: Riddle): string { const c = this.s.puzzle.concept; return r.kind === 'pattern' ? (r.rule === 'up' || r.rule === 'down' ? c.step : c.repeat) : c[r.kind]; }

  private renderFinished(card: HTMLElement): void {
    const p = this.s.puzzle;
    el('div', 'mq-pz-big', card).innerHTML = icon(this.practice ? 'sparkles' : 'moon', 56);
    el('p', 'mq-pz-ask', card, this.practice ? p.practiceDone : p.allAwake);
    const total = this.run.length;
    const starRow = el('div', 'mq-stars', card); starRow.innerHTML = icon('star', 34).repeat(this.stars) + icon('star', 34, 'mq-i mq-star-off').repeat(Math.max(0, total - this.stars)); starRow.setAttribute('aria-label', `${this.stars}/${total}`);
    if (this.practice) { const a = el('button', 'mq-big', card, p.practiceAgain); a.type = 'button'; a.addEventListener('click', () => this.again()); }
    const c = el('button', `mq-big${this.practice ? '' : ' mq-go'}`, card, p.close); c.type = 'button'; c.addEventListener('click', () => this.close());
  }
}
