import { describe, expect, it } from 'vitest';
import { mulberry32 } from './layout3d';
import { OPTIONS_PER_RIDDLE, PATTERN_SYMBOLS, answerText, isRight, makeCount, makePattern, makeRun, makeSum, type PatternRiddle, type Riddle } from './runePuzzle';
import type { Tier } from './woodsQuest';

const TIERS: Tier[] = [1, 2, 3];
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);

/** Recomputes the right answer for counting and sums from the riddle's raw numbers, without trusting `answer`. Patterns have their own tests below. */
function expected(r: Exclude<Riddle, PatternRiddle>): string {
  switch (r.kind) {
    case 'count': case 'recognise': return String(r.n);
    case 'twostep': return String(r.a + r.b - r.c);
    case 'add': return String(r.a + r.b);
    case 'subtract': return String(r.a - r.b);
  }
}

describe('rune riddles', () => {
  it('always has the right answer among three different options', () => {
    for (const tier of TIERS) for (const seed of SEEDS) for (const r of makeRun(seed, tier)) {
      expect(r.options.length, `${r.kind} ${seed}`).toBe(OPTIONS_PER_RIDDLE);
      expect(new Set(r.options).size, `${r.kind} ${seed} ${r.options}`).toBe(OPTIONS_PER_RIDDLE);
      expect(r.answer).toBeGreaterThanOrEqual(0); expect(r.answer).toBeLessThan(OPTIONS_PER_RIDDLE);
      if (r.kind !== 'pattern') expect(answerText(r), `${r.kind} ${seed}`).toBe(expected(r));
      else expect(r.options).toContain(answerText(r));
      expect(isRight(r, r.answer)).toBe(true);
      expect(isRight(r, (r.answer + 1) % OPTIONS_PER_RIDDLE)).toBe(false);
    }
  });
  it('is the same run for the same seed and a different run for another', () => {
    expect(makeRun(42, 2)).toEqual(makeRun(42, 2));
    expect(JSON.stringify(makeRun(42, 2))).not.toBe(JSON.stringify(makeRun(43, 2)));
  });
  it('runs counting, then a pattern, then adding or taking away', () => {
    for (const seed of SEEDS.slice(0, 40)) { const [a, b, c] = makeRun(seed, 1); expect(a.kind).toBe('count'); expect(b.kind).toBe('pattern'); expect(['add', 'subtract']).toContain(c.kind); }
    const kinds = new Set(SEEDS.map(s => makeRun(s, 1)[2].kind)); expect(kinds).toEqual(new Set(['add', 'subtract']));
  });
  it('keeps numbers inside each tier\'s range and never negative', () => {
    for (const seed of SEEDS) {
      const rnd = mulberry32(seed);
      const c1 = makeCount(1, rnd), c2 = makeCount(2, rnd), c3 = makeCount(3, rnd);
      expect(c1.n).toBeGreaterThanOrEqual(3); expect(c1.n).toBeLessThanOrEqual(6);
      expect(c2.n).toBeGreaterThanOrEqual(6); expect(c2.n).toBeLessThanOrEqual(10);
      expect(c3.n).toBeGreaterThanOrEqual(9); expect(c3.n).toBeLessThanOrEqual(14);
      for (const kind of ['add', 'subtract'] as const) {
        const s1 = makeSum(kind, 1, rnd), s2 = makeSum(kind, 2, rnd), s3 = makeSum(kind, 3, rnd);
        expect(kind === 'add' ? s1.a + s1.b : s1.a).toBeLessThanOrEqual(6);
        expect(kind === 'add' ? s2.a + s2.b : s2.a).toBeLessThanOrEqual(10);
        expect(kind === 'add' ? s3.a + s3.b : s3.a).toBeLessThanOrEqual(20); expect(kind === 'add' ? s3.a + s3.b : s3.a).toBeGreaterThanOrEqual(11);
        for (const s of [s1, s2, s3]) { expect(s.a).toBeGreaterThanOrEqual(1); expect(s.b).toBeGreaterThanOrEqual(1); if (kind === 'subtract') expect(s.b).toBeLessThan(s.a); }
      }
      for (const r of [c1, c2, c3, makeSum('add', 1, rnd), makeSum('subtract', 3, rnd), makePattern(3, rnd)]) for (const o of r.options) if (/^\d+$/.test(o)) expect(Number(o)).toBeGreaterThanOrEqual(0);
    }
  });
  it('makes picture patterns that really repeat, and the right answer continues them', () => {
    for (const seed of SEEDS) for (const tier of [1, 2] as Tier[]) {
      const r: PatternRiddle = makePattern(tier, mulberry32(seed));
      const unitLen = r.rule === 'ab' ? 2 : 3;
      expect(r.sequence.length, r.rule).toBeGreaterThan(unitLen * 2);
      r.sequence.forEach((s, i) => expect(s, `${r.rule} ${seed}`).toBe(r.sequence[i % unitLen]));
      expect(r.options[r.answer], `${r.rule} ${seed}`).toBe(r.sequence[r.sequence.length % unitLen]);
      for (const s of [...r.sequence, ...r.options]) expect(PATTERN_SYMBOLS as readonly string[]).toContain(s);
      if (r.rule === 'aab') expect(r.sequence[0]).toBe(r.sequence[1]);
      if (r.rule === 'abb') expect(r.sequence[1]).toBe(r.sequence[2]);
      if (r.rule === 'abc') expect(new Set(r.sequence.slice(0, 3)).size).toBe(3);
    }
    expect(SEEDS.every(s => makePattern(1, mulberry32(s)).rule === 'ab')).toBe(true);
    expect(new Set(SEEDS.map(s => makePattern(2, mulberry32(s)).rule))).toEqual(new Set(['aab', 'abb', 'abc']));
  });
  it('makes number patterns that count up or down by a steady step', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const r = makePattern(3, mulberry32(seed));
      expect(['up', 'down']).toContain(r.rule); seen.add(r.rule);
      const nums = r.sequence.map(Number);
      expect(nums.length).toBe(4);
      for (let i = 1; i < nums.length; i++) expect(nums[i] - nums[i - 1]).toBe(r.rule === 'up' ? r.step : -r.step);
      expect(Number(r.options[r.answer])).toBe(nums[3] + (r.rule === 'up' ? r.step : -r.step));
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0); expect(Number(r.options[r.answer])).toBeGreaterThanOrEqual(0);
      expect([2, 3, 5, 10]).toContain(r.step);
    }
    expect(seen).toEqual(new Set(['up', 'down']));
  });
});
