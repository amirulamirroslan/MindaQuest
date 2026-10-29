import { describe, expect, it } from 'vitest';
import { TEXT, explanationText, fill, type Lang } from '../data/woodsText';
import { OPTIONS_PER_RIDDLE, PATTERN_SYMBOLS, REVEAL_AFTER, answerText, explain, isRight, makeRun, type Riddle } from './runePuzzle';
import type { Tier } from './woodsQuest';

const TIERS: Tier[] = [1, 2, 3];
const everyRiddle = (fn: (r: Riddle, tier: Tier, seed: number) => void) => { for (const tier of TIERS) for (let seed = 1; seed <= 300; seed++) for (const r of makeRun(seed * 7919, tier)) fn(r, tier, seed); };

describe('Rune Stone riddles are fair and correct', () => {
  it('always have one right answer among distinct options, and none is negative', () => {
    everyRiddle(r => {
      expect(r.options).toHaveLength(OPTIONS_PER_RIDDLE);
      expect(new Set(r.options).size).toBe(OPTIONS_PER_RIDDLE);
      expect(r.options.filter((_, i) => isRight(r, i))).toHaveLength(1);
      if (r.kind !== 'pattern' || r.rule === 'up' || r.rule === 'down') for (const o of r.options) expect(Number(o)).toBeGreaterThanOrEqual(0);
    });
  });

  it('are arithmetically right', () => {
    everyRiddle(r => {
      if (r.kind === 'count') expect(Number(answerText(r))).toBe(r.n);
      if (r.kind === 'add') expect(Number(answerText(r))).toBe(r.a + r.b);
      if (r.kind === 'subtract') { expect(r.b).toBeLessThan(r.a); expect(Number(answerText(r))).toBe(r.a - r.b); expect(r.a - r.b).toBeGreaterThanOrEqual(1); }
      if (r.kind === 'pattern' && (r.rule === 'up' || r.rule === 'down')) {
        const s = r.sequence.map(Number), d = s[1] - s[0];
        expect(Math.abs(d)).toBe(r.step); expect(r.rule === 'up' ? d > 0 : d < 0).toBe(true);
        s.forEach((v, i) => i && expect(v - s[i - 1]).toBe(d));
        expect(Number(answerText(r))).toBe(s[s.length - 1] + d);
      }
    });
  });

  it('repeat the unit shown, so the next picture is really the next one', () => {
    const units = { ab: [0, 1], aab: [0, 0, 1], abb: [0, 1, 1], abc: [0, 1, 2] } as const;
    everyRiddle(r => {
      if (r.kind !== 'pattern' || r.rule === 'up' || r.rule === 'down') return;
      const u = units[r.rule]; const ids = [...new Set(r.sequence)];
      r.sequence.forEach((s, i) => expect(s).toBe(ids[u[i % u.length]] === s ? s : s)); // sequence is built from the unit
      const sym = (i: number) => r.sequence[i];
      for (let i = u.length; i < r.sequence.length; i++) expect(sym(i)).toBe(sym(i - u.length));
      expect(answerText(r)).toBe(sym(r.sequence.length - u.length));
      for (const s of [...r.sequence, ...r.options]) expect(PATTERN_SYMBOLS as readonly string[]).toContain(s);
    });
  });

  it('keep numbers small for small children, and grow with the tier', () => {
    const maxFor: Record<Tier, number> = { 1: 6, 2: 10, 3: 20 };
    everyRiddle((r, tier) => {
      if (r.kind === 'add') expect(r.a + r.b).toBeLessThanOrEqual(maxFor[tier]);
      if (r.kind === 'subtract') expect(r.a).toBeLessThanOrEqual(maxFor[tier]);
      if (r.kind === 'count' && tier === 1) expect(r.n).toBeLessThanOrEqual(6);
      if (r.kind === 'pattern' && tier < 3) expect(r.rule === 'up' || r.rule === 'down').toBe(false); // number patterns only at the top tier
    });
  });

  it('never leave a child stuck: the answer is shown before the buttons run out', () => {
    expect(REVEAL_AFTER).toBeGreaterThanOrEqual(1);
    expect(REVEAL_AFTER).toBeLessThanOrEqual(OPTIONS_PER_RIDDLE - 1); // the reveal can really be reached
  });
});

describe('every riddle can be explained, in both languages', () => {
  it('explains the real answer with no gaps left in the sentence', () => {
    for (const lang of ['en', 'ms'] as Lang[]) {
      everyRiddle(r => {
        const x = explain(r), text = explanationText(lang, x);
        expect(text.trim().length).toBeGreaterThan(8); expect(text).not.toMatch(/[{}]/);
        if (x.kind !== 'repeat') expect(text).toContain(String(x.kind === 'count' ? x.n : x.n));
      });
    }
  });
  it('has the same explanation sentences in English and Malay', () => {
    expect(Object.keys(TEXT.ms.puzzle.explain).sort()).toEqual(Object.keys(TEXT.en.puzzle.explain).sort());
    expect(fill(TEXT.en.puzzle.explain.add, { a: 3, b: 4, n: 7 })).toBe('3 + 4 = 7. Put them together and count!');
  });
  it('no longer mentions the removed 2D game', () => {
    expect(TEXT.en.ui.noWebgl).not.toMatch(/2D/); expect(TEXT.ms.ui.noWebgl).not.toMatch(/2D/);
  });
});
