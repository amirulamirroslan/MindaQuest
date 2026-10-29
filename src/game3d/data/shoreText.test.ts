import { describe, expect, it } from 'vitest';
import { SHORE_TEXT, ebbText, floodText, shoreFill, shoreObjective, singularHour } from './shoreText';
import { TEXT } from './woodsText';
import { BOTTLE_COUNT, CRAB_COUNT, GLASS_COUNT, GULL_COUNT, collectGlass, defeatHeron, keeperAsked, lightLamp, makAsked, newShore, readBottle, type ShoreState } from '../systems/shoreQuest';

describe('moonwake shore text', () => {
  it('has the same shape in both languages and no empty strings', () => {
    const walk = (o: unknown, path: string, out: string[]) => {
      if (typeof o === 'string') { if (!o.trim()) out.push(`${path} is empty`); return; }
      if (Array.isArray(o)) { if (!o.length) out.push(`${path} is empty`); o.forEach((v, i) => walk(v, `${path}[${i}]`, out)); return; }
      for (const [k, v] of Object.entries(o as object)) walk(v, `${path}.${k}`, out);
    };
    const problems: string[] = []; walk(SHORE_TEXT.en, 'en', problems); walk(SHORE_TEXT.ms, 'ms', problems); expect(problems).toEqual([]);
    const shape = (o: unknown): unknown => (typeof o === 'string' ? 's' : Array.isArray(o) ? o.map(shape) : Object.fromEntries(Object.entries(o as object).map(([k, v]) => [k, shape(v)])));
    expect(shape(SHORE_TEXT.ms)).toEqual(shape(SHORE_TEXT.en));
  });
  it('keeps the same {placeholders} in both languages, line by line', () => {
    const holes = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join(',');
    const pairs: [string, string][] = [];
    for (const g of ['objective', 'toast'] as const) for (const k of Object.keys(SHORE_TEXT.en[g]) as never[]) pairs.push([SHORE_TEXT.en[g][k], SHORE_TEXT.ms[g][k]]);
    for (const w of ['mak', 'keeper'] as const) {
      for (const k of ['add', 'subtract'] as const) { pairs.push([SHORE_TEXT.en[w].ask[k], SHORE_TEXT.ms[w].ask[k]]); expect(holes(SHORE_TEXT.en[w].ask[k])).toBe('{a},{b}'); }
      for (const k of ['intro', 'waiting', 'report', 'thanks'] as const) { expect(SHORE_TEXT.ms[w][k].length).toBe(SHORE_TEXT.en[w][k].length); SHORE_TEXT.en[w][k].forEach((l, i) => pairs.push([l, SHORE_TEXT.ms[w][k][i]])); }
    }
    pairs.push([SHORE_TEXT.en.board.ebb, SHORE_TEXT.ms.board.ebb], [SHORE_TEXT.en.board.flood, SHORE_TEXT.ms.board.flood]);
    for (const [en, ms] of pairs) expect(holes(ms), en).toBe(holes(en));
    expect(SHORE_TEXT.en.mak.waiting.join(' ')).toContain('{n}');
    expect(SHORE_TEXT.en.bottle.lines).toHaveLength(BOTTLE_COUNT); expect(SHORE_TEXT.ms.bottle.lines).toHaveLength(BOTTLE_COUNT);
    expect(SHORE_TEXT.ms.mak.intro.join(' ')).not.toBe(SHORE_TEXT.en.mak.intro.join(' '));
    for (const l of ['en', 'ms'] as const) { expect(SHORE_TEXT[l].elderToShore.length).toBe(TEXT[l].elder.complete.length); expect(SHORE_TEXT[l].elderShoreDone).toHaveLength(2); }
  });
  it('names all three bells in both songs, the flood song backwards', () => {
    for (const l of ['en', 'ms'] as const) { const e = ebbText(l).split(', '), f = floodText(l).split(', '); expect(e).toHaveLength(3); expect([...e].reverse()).toEqual(f); for (const b of Object.values(SHORE_TEXT[l].buoy)) expect(e).toContain(b); }
  });
  it('walks the objective card through the shore, in both languages', () => {
    for (const l of ['en', 'ms'] as const) {
      const t = SHORE_TEXT[l].objective; let s: ShoreState = newShore();
      expect(shoreObjective(l, s, { inside: false, rung: 0, boardSeen: false })).toBe(t.gate);
      expect(shoreObjective(l, s, { inside: true, rung: 0, boardSeen: false })).toBe(t.findMak);
      s = makAsked(s); expect(shoreObjective(l, s, { inside: true, rung: 0, boardSeen: false })).toBe(t.readBoard);
      const ring = shoreObjective(l, s, { inside: true, rung: 1, boardSeen: true }); expect(ring).toContain('(1/3)'); expect(ring).toContain(ebbText(l)); expect(ring).not.toMatch(/\{/);
      expect(shoreObjective(l, s, { inside: true, rung: 1, boardSeen: false })).not.toContain(ebbText(l));      // the order is learned from the board, not the card
      const one: ShoreState = { ...s, songs: ['ebb'], tide: 'low' }; const other = shoreObjective(l, one, { inside: true, rung: 0, boardSeen: false }); expect(other).toContain('(0/3)');
      s = { ...s, songs: ['ebb', 'flood'], tide: 'low' }; expect(shoreObjective(l, s, { inside: true, rung: 0, boardSeen: true })).toBe(t.heron);
      s = defeatHeron(s).state; expect(shoreObjective(l, s, { inside: true, rung: 0, boardSeen: true })).toBe(t.lamp);
      s = lightLamp(s).state; expect(shoreObjective(l, s, { inside: true, rung: 0, boardSeen: true })).toContain(`(0/${GLASS_COUNT})`);
      expect(shoreObjective(l, s, { inside: false, rung: 0, boardSeen: true })).toBe('');
      let all = s; for (let i = 0; i < GLASS_COUNT; i++) all = collectGlass(all, i).state; expect(shoreObjective(l, all, { inside: true, rung: 0, boardSeen: true })).toBe(t.glassReport);
      expect(shoreObjective(l, keeperAsked({ ...s, mak: 2 }), { inside: true, rung: 0, boardSeen: true })).toBe(t.keeperReport);
      const done: ShoreState = { ...s, mak: 2, keeper: 2, crabs: Array.from({ length: CRAB_COUNT }, (_, i) => i), gulls: Array.from({ length: GULL_COUNT }, (_, i) => i) };
      expect(shoreObjective(l, done, { inside: true, rung: 0, boardSeen: true })).toContain(`(0/${BOTTLE_COUNT})`);
      let b = done; for (let i = 0; i < BOTTLE_COUNT; i++) b = readBottle(b, i).state; expect(shoreObjective(l, b, { inside: true, rung: 0, boardSeen: true })).toBe(t.peace);
    }
  });
  it('fills numbers and leaves unknown holes visible', () => { expect(shoreFill('{n} of {total}', { n: 2, total: 5 })).toBe('2 of 5'); expect(shoreFill('{x}', {})).toBe('{x}'); });
});

describe('v2.30 wording', () => {
  for (const lang of ['en', 'ms'] as const) {
    it(`${lang}: the change question never mentions a banknote (RM3, RM7 and RM13 notes do not exist)`, () => {
      const t = SHORE_TEXT[lang];
      const money = [t.mak.ask.subtract, t.sums.money.hint.subtract, t.sums.money.concept.subtract].join(' ').toLowerCase();
      expect(money).not.toMatch(/\bnote\b|wang kertas/);
    });
    it(`${lang}: the tide line has three non-empty states`, () => {
      for (const k of ['low', 'high', 'still'] as const) expect(SHORE_TEXT[lang].tide[k].length).toBeGreaterThan(2);
      expect(SHORE_TEXT[lang].tide.low).not.toBe(SHORE_TEXT[lang].tide.high);
    });
  }
  it('ms: the Tide Board is called the tides board, not the high-tide board', () => {
    expect(SHORE_TEXT.ms.board.title).toBe('Papan Pasang Surut');
  });
});

describe('singularHour', () => {
  it('fixes only a lone hour', () => {
    expect(singularHour('It rings again 1 hours later.')).toBe('It rings again 1 hour later.');
    expect(singularHour('It rings again 3 hours later.')).toBe('It rings again 3 hours later.');
    expect(singularHour('It rings again 11 hours later.')).toBe('It rings again 11 hours later.');
    expect(singularHour('Loceng berbunyi lagi 1 jam kemudian.')).toBe('Loceng berbunyi lagi 1 jam kemudian.');
  });
});
