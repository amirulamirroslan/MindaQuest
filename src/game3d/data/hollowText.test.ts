import { describe, expect, it } from 'vitest';
import { HOLLOW_TEXT, hollowFill, hollowObjective, orderText } from './hollowText';
import { TEXT } from './woodsText';
import { ECHO_ORDER } from '../systems/hollowLayout';
import { calmShardling, collectShard, glimAsked, newHollow, readTablet, SHARDLING_COUNT, SHARD_COUNT, TABLET_COUNT } from '../systems/hollowQuest';

describe('crystal hollow text', () => {
  it('has the same shape in both languages and no empty strings', () => {
    const walk = (o: unknown, path: string, out: string[]) => {
      if (typeof o === 'string') { if (!o.trim()) out.push(`${path} is empty`); return; }
      if (Array.isArray(o)) { if (!o.length) out.push(`${path} is empty`); o.forEach((v, i) => walk(v, `${path}[${i}]`, out)); return; }
      for (const [k, v] of Object.entries(o as object)) walk(v, `${path}.${k}`, out);
    };
    const problems: string[] = []; walk(HOLLOW_TEXT.en, 'en', problems); walk(HOLLOW_TEXT.ms, 'ms', problems);
    expect(problems).toEqual([]);
    const shape = (o: unknown): unknown => (typeof o === 'string' ? 's' : Array.isArray(o) ? o.map(shape) : Object.fromEntries(Object.entries(o as object).map(([k, v]) => [k, shape(v)])));
    expect(shape(HOLLOW_TEXT.ms)).toEqual(shape(HOLLOW_TEXT.en));
  });
  it('keeps the same {placeholders} in both languages', () => {
    const holes = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join(',');
    const pairs: [string, string][] = [];
    for (const k of Object.keys(HOLLOW_TEXT.en.objective) as (keyof typeof HOLLOW_TEXT.en.objective)[]) pairs.push([HOLLOW_TEXT.en.objective[k], HOLLOW_TEXT.ms.objective[k]]);
    for (const k of Object.keys(HOLLOW_TEXT.en.toast) as (keyof typeof HOLLOW_TEXT.en.toast)[]) pairs.push([HOLLOW_TEXT.en.toast[k], HOLLOW_TEXT.ms.toast[k]]);
    for (const [en, ms] of pairs) expect(holes(ms), en).toBe(holes(en));
  });
  it('gives the Elder two lines per state, like the woods text', () => {
    for (const l of ['en', 'ms'] as const) { expect(HOLLOW_TEXT[l].elderComplete.length).toBe(TEXT[l].elder.complete.length); expect(HOLLOW_TEXT[l].elderAfter.length).toBe(2); }
  });
  it('walks the objective card through the Hollow, in both languages', () => {
    for (const l of ['en', 'ms'] as const) {
      const t = HOLLOW_TEXT[l].objective; let h = newHollow();
      expect(hollowObjective(l, h, { inside: false, step: 0, muralSeen: false })).toBe(t.gate);
      expect(hollowObjective(l, h, { inside: true, step: 0, muralSeen: false })).toBe(t.findMural);
      const strike = hollowObjective(l, h, { inside: true, step: 1, muralSeen: true });
      expect(strike).toContain('(1/3)'); for (const c of ECHO_ORDER) expect(strike).toContain(HOLLOW_TEXT[l].colour[c]);
      expect(strike).toContain(orderText(l)); expect(strike).not.toMatch(/\{/);
      h = { ...h, doorOpen: true }; expect(hollowObjective(l, h, { inside: true, step: 0, muralSeen: true })).toBe(t.warden);
      h = { ...h, wardenDefeated: true }; expect(hollowObjective(l, h, { inside: true, step: 0, muralSeen: true })).toBe(t.heart);
      h = { ...h, heartDone: true }; expect(hollowObjective(l, h, { inside: true, step: 0, muralSeen: true })).toContain(`(0/${SHARD_COUNT})`);
      // Glim's request comes first once he has been met: the count, then the report
      const g = glimAsked(h); expect(hollowObjective(l, g, { inside: true, step: 0, muralSeen: true })).toContain(`(0/${SHARDLING_COUNT})`);
      let all = g; for (let i = 0; i < SHARDLING_COUNT; i++) all = calmShardling(all, i).state; expect(hollowObjective(l, all, { inside: true, step: 0, muralSeen: true })).toBe(t.glimReport);
      for (let i = 0; i < SHARD_COUNT; i++) h = collectShard(h, i).state;
      expect(hollowObjective(l, h, { inside: true, step: 0, muralSeen: true })).toContain(`(0/${TABLET_COUNT})`); // then the hidden tablets
      for (let i = 0; i < TABLET_COUNT; i++) h = readTablet(h, i).state;
      expect(hollowObjective(l, h, { inside: true, step: 0, muralSeen: true })).toBe(t.peace);
      expect(hollowObjective(l, h, { inside: false, step: 0, muralSeen: true })).toBe(''); // finished: the woods card goes back to its own text
    }
  });
  it('keeps the same placeholders in Glim\'s lines, and offers a sum for add and take-away in both languages', () => {
    const holes = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of ['add', 'subtract'] as const) { expect(holes(HOLLOW_TEXT.ms.glim.ask[k])).toBe(holes(HOLLOW_TEXT.en.glim.ask[k])); expect(holes(HOLLOW_TEXT.en.glim.ask[k])).toBe('{a},{b}'); }
    for (const k of ['intro', 'waiting', 'report', 'thanks'] as const) { expect(HOLLOW_TEXT.ms.glim[k].length, k).toBe(HOLLOW_TEXT.en.glim[k].length); HOLLOW_TEXT.en.glim[k].forEach((line, i) => expect(holes(HOLLOW_TEXT.ms.glim[k][i]), `${k}[${i}]`).toBe(holes(line))); }
    expect(HOLLOW_TEXT.en.glim.waiting.join(' ')).toContain('{n}');
    expect(HOLLOW_TEXT.en.tablet.lines).toHaveLength(TABLET_COUNT); expect(HOLLOW_TEXT.ms.tablet.lines).toHaveLength(TABLET_COUNT);
    for (const l of ['en', 'ms'] as const) { expect(HOLLOW_TEXT[l].boss.length).toBeGreaterThan(3); expect(HOLLOW_TEXT[l].labels.glim).toBeTruthy(); }
    expect(HOLLOW_TEXT.ms.glim.intro.join(' ')).not.toBe(HOLLOW_TEXT.en.glim.intro.join(' ')); // really translated
  });
  it('fills numbers and leaves unknown holes visible', () => { expect(hollowFill('{n} of {total}', { n: 2, total: 5 })).toBe('2 of 5'); expect(hollowFill('{x}', {})).toBe('{x}'); });
});
