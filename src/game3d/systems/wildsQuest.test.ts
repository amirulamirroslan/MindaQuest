import { describe, expect, it } from 'vitest';
import { WILDS_TEXT } from '../data/wildsText';
import { ACORN_SPOTS, CHEST_SPOTS, LANTERN_SPOTS, PEARL_SPOTS, PUMPKIN_SPOTS, TABLET_SPOTS, ZONES } from './expansion';
import { visibleChests, visibleWildsMarks } from './wildsMap';
import {
  ACORN_COUNT, ALL_ACORNS_XP, ITEM_XP, NPC_XP, WILDS_STORAGE_KEY, WILDS_TOTAL_XP, asked, claim, collectAcorn, collectPearl, collectPumpkin, discoverZone, errandDone, exploredAt, exploredShare, lightLantern,
  loadWilds, markExplored, newWilds, openChest, readTablet, sanitizeWilds, saveWilds, script, thornsOpen, zoneAt, type WildsState,
} from './wildsQuest';
import { WILDS_EVENT_MAX_XP, newProgress, reduceQuest } from './woodsQuest';

const store = (): { getItem(k: string): string | null; setItem(k: string, v: string): void; data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } }; };

describe('rewards are paid once', () => {
  it('pays each acorn once and a bonus for all of them', () => {
    let s = newWilds(), xp = 0;
    for (let i = 0; i < ACORN_COUNT; i++) { const r = collectAcorn(s, i); expect(r.first).toBe(true); s = r.state; xp += r.xp; expect(collectAcorn(s, i).xp).toBe(0); }
    expect(xp).toBe(ACORN_COUNT * 2 + ALL_ACORNS_XP); expect(collectAcorn(s, 0).first).toBe(false);
  });
  it('ignores ids that do not exist', () => { const s = newWilds(); expect(collectAcorn(s, 99).first).toBe(false); expect(collectAcorn(s, -1).first).toBe(false); expect(collectPearl(s, 1.5).first).toBe(false); expect(openChest(s, 40).xp).toBe(0); expect(discoverZone(s, 'nowhere').xp).toBe(0); });
  it('pays a chest and a zone once', () => { let r = openChest(newWilds(), 5); expect(r.xp).toBe(CHEST_SPOTS[5].xp); expect(openChest(r.state, 5).xp).toBe(0); r = openChest(r.state, 0); expect(r.state.chests).toEqual([0, 5]); const d = discoverZone(newWilds(), 'grove'); expect(d.xp).toBe(10); expect(discoverZone(d.state, 'grove').xp).toBe(0); });
  it('adds up to a sane total', () => { expect(WILDS_TOTAL_XP).toBeGreaterThan(300); expect(WILDS_TOTAL_XP).toBeLessThan(600); });
  it('turns into quest XP at any stage, capped per event', () => {
    const p = newProgress(); const a = reduceQuest(p, { kind: 'wilds', xp: 30 }); expect(a.state.xp).toBe(30); expect(a.xpGained).toBe(30);
    expect(reduceQuest(p, { kind: 'wilds', xp: 5000 }).xpGained).toBe(WILDS_EVENT_MAX_XP); expect(reduceQuest(p, { kind: 'wilds', xp: -4 }).xpGained).toBe(0); expect(reduceQuest(p, { kind: 'wilds', xp: NaN }).xpGained).toBe(0);
    expect(a.state.stage).toBe(p.stage); expect(a.state.petalIds).toEqual(p.petalIds);
  });
});

describe('the three errands', () => {
  const finish = (who: 'tani' | 'lumut' | 'din'): WildsState => {
    let s = newWilds();
    if (who === 'tani') PUMPKIN_SPOTS.forEach((_, i) => { s = collectPumpkin(s, i).state; }); else if (who === 'din') PEARL_SPOTS.forEach((_, i) => { s = collectPearl(s, i).state; }); else LANTERN_SPOTS.forEach((_, i) => { s = lightLantern(s, i).state; });
    return s;
  };
  for (const who of ['tani', 'lumut', 'din'] as const) it(`${who}: intro, waiting, report, thanks, and pays 30 once`, () => {
    let s = newWilds(); expect(script(s, who)).toBe('intro'); s = asked(s, who); expect(script(s, who)).toBe('waiting'); expect(claim(s, who).xp).toBe(0);   // cannot claim without the items
    s = { ...finish(who), [who]: 1 }; expect(errandDone(s, who)).toBe(true); expect(script(s, who)).toBe('report');
    const r = claim(s, who); expect(r.xp).toBe(NPC_XP); expect(script(r.state, who)).toBe('thanks'); expect(claim(r.state, who).xp).toBe(0);
  });
  it('opens the thorns only after Kak Lumut is thanked', () => { let s: WildsState = { ...finish('lumut'), lumut: 1 }; expect(thornsOpen(s)).toBe(false); s = claim(s, 'lumut').state; expect(thornsOpen(s)).toBe(true); });
  it('pays small item rewards', () => { expect(collectPumpkin(newWilds(), 0).xp).toBe(ITEM_XP); expect(lightLantern(newWilds(), 1).xp).toBe(ITEM_XP); expect(readTablet(newWilds(), 2).xp).toBe(5); });
  it('keeps the item counts the text and the world agree on', () => { expect([ACORN_SPOTS.length, PUMPKIN_SPOTS.length, PEARL_SPOTS.length, LANTERN_SPOTS.length, TABLET_SPOTS.length, CHEST_SPOTS.length]).toEqual([14, 4, 4, 3, 3, 7]); });
});

describe('saving and old saves', () => {
  it('starts empty when nothing is saved (every older save keeps working)', () => { expect(loadWilds(store())).toEqual(newWilds()); expect(loadWilds(undefined as never)).toEqual(newWilds()); });
  it('round-trips', () => {
    const st = store(); let s = collectAcorn(newWilds(), 3).state; s = openChest(s, 2).state; s = discoverZone(s, 'mirror').state; s = markExplored(s, 60, 10, 12);
    expect(saveWilds(s, st)).toBe(true); expect(Object.keys(st.data)).toEqual([WILDS_STORAGE_KEY]); expect(loadWilds(st)).toEqual(s);
  });
  it('repairs corrupt or hand-edited saves', () => {
    const st = store(); st.data[WILDS_STORAGE_KEY] = '{nope'; expect(loadWilds(st)).toEqual(newWilds());
    const bad = sanitizeWilds({ zones: ['mirror', 'mirror', 'zzz', 4], acorns: [1, 1, 50, 'a', -2], chests: [0, 9], tani: 2, lumut: 7, din: 'x', explored: 'zz' });
    expect(bad.zones).toEqual(['mirror']); expect(bad.acorns).toEqual([1]); expect(bad.chests).toEqual([0]); expect(bad.tani).toBe(1); expect(bad.lumut).toBe(0); expect(bad.din).toBe(0); expect(bad.explored).toBe('');
    expect(sanitizeWilds(null)).toEqual(newWilds()); expect(sanitizeWilds('x')).toEqual(newWilds());
  });
  it('does not throw when storage fails', () => { expect(saveWilds(newWilds(), { setItem() { throw new Error('full'); } })).toBe(false); expect(loadWilds({ getItem() { throw new Error('blocked'); } })).toEqual(newWilds()); });
});

describe('fog of war', () => {
  it('shows the original glade from the start and hides everything else', () => {
    const s = newWilds(); expect(exploredAt(s, 0, 0)).toBe(true); expect(exploredAt(s, 20, 20)).toBe(true); expect(exploredAt(s, 70, 14)).toBe(false); expect(exploredAt(s, -66, 2)).toBe(false); expect(exploredAt(s, 500, 500)).toBe(false);
    expect(exploredShare(s)).toBeGreaterThan(0.15); expect(exploredShare(s)).toBeLessThan(0.3);
  });
  it('marks squares around the hero, once', () => {
    const s = newWilds(), a = markExplored(s, 70, 14, 12); expect(a).not.toBe(s); expect(exploredAt(a, 70, 14)).toBe(true); expect(exploredAt(a, 78, 14)).toBe(true); expect(exploredAt(a, 100, 14)).toBe(false);
    expect(markExplored(a, 70, 14, 12)).toBe(a);   // nothing new: the very same state, so nothing needs saving
    expect(exploredShare(a)).toBeGreaterThan(exploredShare(s));
  });
  it('fits in a small save', () => { let s = newWilds(); for (let x = -95; x <= 95; x += 10) for (let z = -95; z <= 95; z += 10) s = markExplored(s, x, z, 12); expect(JSON.stringify(s).length).toBeLessThan(1200); });
  it('finds which region the hero stands in', () => { expect(zoneAt(68, 14)).toBe('mirror'); expect(zoneAt(0, 76)).toBe('hearthfield'); expect(zoneAt(0, 0)).toBeNull(); for (const z of ZONES) expect(zoneAt(z.x, z.z), z.id).not.toBeNull(); });
});

describe('what the map shows', () => {
  it('shows no new places at the start, then each place as it is seen', () => {
    const s = newWilds(); expect(visibleWildsMarks(s)).toEqual([]); expect(visibleChests(s)).toEqual([]);
    const m = markExplored(s, 68, 14, 14); expect(visibleWildsMarks(m).map(x => x.kind)).toContain('mirror'); expect(visibleChests(m).map(c => c.id)).toContain(0);
  });
  it('keeps hidden places off the map until they are found', () => {
    let s = markExplored(newWilds(), -52, -56, 14); expect(visibleWildsMarks(s).map(x => x.kind)).not.toContain('grove'); expect(visibleChests(s).map(c => c.id)).not.toContain(5);
    s = discoverZone(s, 'grove').state; expect(visibleWildsMarks(s).map(x => x.kind)).toContain('grove'); expect(visibleChests(s).find(c => c.id === 5)?.open).toBe(false);
    expect(visibleChests(openChest(s, 5).state).find(c => c.id === 5)?.open).toBe(true);
  });
});

describe('words', () => {
  const en = WILDS_TEXT.en, ms = WILDS_TEXT.ms;
  const shape = (v: unknown): unknown => Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  it('has the same shape in English and Malay', () => { expect(shape(ms)).toEqual(shape(en)); });
  it('names every region, and every errand has the right number of lines', () => {
    for (const z of ZONES) { expect(en.zones[z.id].length).toBeGreaterThan(2); expect(ms.zones[z.id].length).toBeGreaterThan(2); expect(ms.labels[z.id].length).toBeGreaterThan(2); }
    for (const t of [en, ms]) { expect(t.tablet.lines).toHaveLength(TABLET_SPOTS.length); for (const who of ['tani', 'lumut', 'din'] as const) { expect(t[who].intro.length).toBeGreaterThan(1); expect(t[who].report.length).toBeGreaterThan(0); } }
  });
  it('has the sum questions for the people who ask one, with {a} and {b}', () => { for (const t of [en, ms]) for (const who of ['tani', 'din'] as const) for (const k of ['add', 'subtract'] as const) { expect(t[who].ask![k]).toContain('{a}'); expect(t[who].ask![k]).toContain('{b}'); } });
  it('has no emoji', () => { expect(JSON.stringify(WILDS_TEXT)).not.toMatch(/\p{Extended_Pictographic}/u); });
});
