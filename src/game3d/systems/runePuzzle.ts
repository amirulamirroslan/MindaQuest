/**
 * The Rune Stone's riddles (pure and deterministic for a given seed, so every rule is unit-tested without a screen).
 * A run is three riddles: count the petals, finish a pattern, then add or take away. Difficulty comes in three tiers
 * (see `Tier` in woodsQuest.ts) and adapts between runs: a smooth run steps up, a rough one steps down.
 *
 * Nothing here can fail a child: a wrong answer only earns a hint, and after `REVEAL_AFTER` slips the screen shows the answer.
 */
import { mulberry32 } from './layout3d';
import type { Tier } from './woodsQuest';

/** Each riddle has three buttons, so a child can only ever slip twice. The second slip shows the answer and why (before v2.17 this was 3, which could never happen). */
export const REVEAL_AFTER = 2;
export const OPTIONS_PER_RIDDLE = 3;
/** Symbol ids for picture patterns (drawn as SVG by `ui/puzzleSymbols.ts`): all easy to tell apart, none relies on colour alone. */
export const PATTERN_SYMBOLS = ['blossom', 'leaf', 'mushroom', 'star', 'moon', 'butterfly', 'ladybug', 'apple'] as const;

export type RiddleKind = 'count' | 'recognise' | 'pattern' | 'add' | 'subtract' | 'twostep';
/** ab / aab / abb / abc repeat a picture unit; step counts up or down by a fixed amount. */
export type PatternRule = 'ab' | 'aab' | 'abb' | 'abc' | 'up' | 'down';

interface Base { tier: Tier; /** What the answer buttons say. */ options: string[]; /** Index into `options` of the right one. */ answer: number }
export interface CountRiddle extends Base { kind: 'count'; n: number }
export interface PatternRiddle extends Base { kind: 'pattern'; rule: PatternRule; /** What is shown before the gap. */ sequence: string[]; step: number }
export interface SumRiddle extends Base { kind: 'add' | 'subtract'; a: number; b: number }
/** Number recognition: a number word is shown ("five") and the child picks the digit that says it. */
export interface RecogniseRiddle extends Base { kind: 'recognise'; n: number }
/** Multi-step reasoning (Challenge tier only): add `b` to `a`, then take `c` away. */
export interface TwoStepRiddle extends Base { kind: 'twostep'; a: number; b: number; c: number }
export type Riddle = CountRiddle | RecogniseRiddle | PatternRiddle | SumRiddle | TwoStepRiddle;

type Rnd = () => number;
const pick = <T>(rnd: Rnd, items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
const int = (rnd: Rnd, lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
function shuffle<T>(rnd: Rnd, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Two wrong numbers near the right one (never negative, never the answer, never each other). */
function numberDistractors(rnd: Rnd, answer: number, near: readonly number[]): number[] {
  const pool = [...new Set(near.map(d => answer + d))].filter(v => v >= 0 && v !== answer);
  const out: number[] = [];
  for (const v of shuffle(rnd, pool)) { if (out.length < OPTIONS_PER_RIDDLE - 1) out.push(v); }
  for (let d = 1; out.length < OPTIONS_PER_RIDDLE - 1; d++) { for (const v of [answer + d, answer - d]) if (v >= 0 && v !== answer && !out.includes(v) && out.length < OPTIONS_PER_RIDDLE - 1) out.push(v); }
  return out;
}

/** Puts the right option among the wrong ones in a random place. */
function withOptions(rnd: Rnd, right: string, wrong: string[]): { options: string[]; answer: number } {
  const options = shuffle(rnd, [right, ...wrong]);
  return { options, answer: options.indexOf(right) };
}

const COUNT_RANGE: Record<Tier, [number, number]> = { 1: [3, 6], 2: [6, 10], 3: [9, 14] };

export function makeCount(tier: Tier, rnd: Rnd): CountRiddle {
  const [lo, hi] = COUNT_RANGE[tier];
  const n = int(rnd, lo, hi);
  return { kind: 'count', tier, n, ...withOptions(rnd, String(n), numberDistractors(rnd, n, [-2, -1, 1, 2]).map(String)) };
}

const UNITS: Record<'ab' | 'aab' | 'abb' | 'abc', number[]> = { ab: [0, 1], aab: [0, 0, 1], abb: [0, 1, 1], abc: [0, 1, 2] };

export function makePattern(tier: Tier, rnd: Rnd): PatternRiddle {
  if (tier === 3) {
    const down = rnd() < 0.35;
    const step = pick(rnd, [2, 3, 5, 10]);
    // whole-number runs like 2 4 6 8, 1 3 5 7 or 40 35 30 25; never below zero
    const offset = step === 10 ? 0 : int(rnd, 0, 2);
    const first = down ? step * int(rnd, 5, 8) + offset : step * int(rnd, 0, 1) + offset;
    const dir = down ? -step : step;
    const shown = [0, 1, 2, 3].map(i => first + dir * i);
    const answer = first + dir * 4;
    const wrong = numberDistractors(rnd, answer, [-1, 1, step, -step, dir > 0 ? -step - 1 : step + 1]);
    return { kind: 'pattern', tier, rule: down ? 'down' : 'up', sequence: shown.map(String), step, ...withOptions(rnd, String(answer), wrong.map(String)) };
  }
  const rule = tier === 1 ? 'ab' : pick(rnd, ['aab', 'abb', 'abc'] as const);
  const unit = UNITS[rule];
  const symbols = shuffle(rnd, [...PATTERN_SYMBOLS]);
  const used = Math.max(...unit) + 1;
  // show a little over two full repeats, ending part-way through the next one
  const length = unit.length * 2 + int(rnd, 1, unit.length - 1);
  const sequence = Array.from({ length }, (_, i) => symbols[unit[i % unit.length]]);
  const right = symbols[unit[length % unit.length]];
  const wrong = [...symbols.slice(0, used).filter(s => s !== right), ...symbols.slice(used)].slice(0, OPTIONS_PER_RIDDLE - 1);
  return { kind: 'pattern', tier, rule, sequence, step: 0, ...withOptions(rnd, right, wrong) };
}

export function makeSum(kind: 'add' | 'subtract', tier: Tier, rnd: Rnd): SumRiddle {
  let a: number, b: number;
  if (kind === 'add') {
    const max = tier === 1 ? 6 : tier === 2 ? 10 : 20;
    const total = int(rnd, tier === 3 ? 11 : 3, max);
    a = int(rnd, 1, total - 1); b = total - a;
  } else {
    const max = tier === 1 ? 6 : tier === 2 ? 10 : 20;
    a = int(rnd, tier === 3 ? 11 : 3, max); b = int(rnd, 1, a - 1);
  }
  const answer = kind === 'add' ? a + b : a - b;
  return { kind, tier, a, b, ...withOptions(rnd, String(answer), numberDistractors(rnd, answer, [-2, -1, 1, 2, kind === 'add' ? b : -b]).map(String)) };
}

/** One run of three riddles: counting, then a pattern, then adding or taking away. The same `seed` and `tier` always give the same run. */
export function makeRun(seed: number, tier: Tier): Riddle[] {
  const rnd = mulberry32(seed);
  return [makeCount(tier, rnd), makePattern(tier, rnd), makeSum(rnd() < 0.5 ? 'add' : 'subtract', tier, rnd)];
}

export function makeRecognise(tier: Tier, rnd: Rnd): RecogniseRiddle {
  const n = int(rnd, 1, tier === 1 ? 6 : 10);
  return { kind: 'recognise', tier, n, ...withOptions(rnd, String(n), numberDistractors(rnd, n, [-2, -1, 1, 2]).map(String)) };
}

/** a + b - c, with a + b never above 20 and at least one left. A common slip (forgetting to take away) is always among the wrong options. */
export function makeTwoStep(rnd: Rnd): TwoStepRiddle {
  const a = int(rnd, 4, 10), b = int(rnd, 3, Math.min(9, 20 - a)), total = a + b, c = int(rnd, 2, Math.min(total - 1, 9)), answer = total - c;
  const other = numberDistractors(rnd, answer, [-2, -1, 1, 2]).find(v => v !== total) as number; // the second wrong option is always one away from the answer
  return { kind: 'twostep', tier: 3, a, b, c, ...withOptions(rnd, String(answer), [String(total), String(other)]) };
}

/** What a riddle "is", for telling whether a child has just seen it (kind and numbers, or kind and pictures). */
export function signatureOf(r: Riddle): string {
  switch (r.kind) {
    case 'count': return `count:${r.n}`;
    case 'recognise': return `word:${r.n}`;
    case 'add': return `add:${r.a}+${r.b}`;
    case 'subtract': return `sub:${r.a}-${r.b}`;
    case 'twostep': return `two:${r.a}+${r.b}-${r.c}`;
    case 'pattern': return `pat:${r.rule}:${r.sequence.join(',')}`;
  }
}

/** Which riddles a run is made of: chosen from what the child has shown (see `learning/profile.ts`), not at random. */
export interface RunPlan {
  counting: { kind: 'count' | 'recognise'; tier: Tier };
  pattern: { tier: Tier };
  maths: { kind: 'add' | 'subtract' | 'twostep'; tier: Tier };
}

/**
 * Makes one riddle that has not been seen lately. `avoid` is the recent signatures, oldest first: the first fresh candidate wins; when
 * every candidate was seen (a small tier has few riddles) the one seen longest ago is used.
 */
export function pickFresh<T extends Riddle>(make: (rnd: Rnd) => T, seed: number, avoid: readonly string[]): T {
  let best: T | null = null, bestAge = Infinity;
  for (let k = 0; k < 16; k++) {
    const r = make(mulberry32((seed + Math.imul(k, 0x9e3779b1)) >>> 0));
    const age = avoid.lastIndexOf(signatureOf(r)); // -1 = not seen; a lower index = seen longer ago
    if (age < bestAge) { best = r; bestAge = age; if (age < 0) break; }
  }
  return best as T;
}

/** A run of three for a plan: counting (or number words), a pattern, then adding / taking away / two steps. The same seed, plan and `avoid` always give the same run. */
export function makePlannedRun(seed: number, plan: RunPlan, avoid: readonly string[] = []): Riddle[] {
  return [
    pickFresh(rnd => plan.counting.kind === 'recognise' ? makeRecognise(plan.counting.tier, rnd) : makeCount(plan.counting.tier, rnd), seed, avoid),
    pickFresh(rnd => makePattern(plan.pattern.tier, rnd), seed + 101, avoid),
    pickFresh<Riddle>(rnd => plan.maths.kind === 'twostep' ? makeTwoStep(rnd) : makeSum(plan.maths.kind, plan.maths.tier, rnd), seed + 202, avoid),
  ];
}

export const isRight = (r: Riddle, choice: number): boolean => choice === r.answer;

/** Why the answer is right, as data (the words live in `woodsText`), so every explanation is checked against the riddle's real answer. */
export type Explanation =
  | { kind: 'count' | 'recognise'; n: number }
  | { kind: 'twostep'; a: number; b: number; c: number; mid: number; n: number }
  | { kind: 'add' | 'subtract'; a: number; b: number; n: number }
  | { kind: 'repeat' }
  | { kind: 'up' | 'down'; step: number; n: number };
export function explain(r: Riddle): Explanation {
  const n = Number(answerText(r));
  switch (r.kind) {
    case 'count': return { kind: 'count', n: r.n };
    case 'recognise': return { kind: 'recognise', n: r.n };
    case 'twostep': return { kind: 'twostep', a: r.a, b: r.b, c: r.c, mid: r.a + r.b, n };
    case 'add': case 'subtract': return { kind: r.kind, a: r.a, b: r.b, n };
    case 'pattern': return r.rule === 'up' || r.rule === 'down' ? { kind: r.rule, step: r.step, n } : { kind: 'repeat' };
  }
}
export const answerText = (r: Riddle): string => r.options[r.answer];
