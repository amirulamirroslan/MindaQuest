import { describe, expect, it } from 'vitest';
import {
  ALL_BOTTLES_XP, ALL_GLASS_XP, BOTTLE_COUNT, BOTTLE_XP, CRAB_COUNT, CRAB_XP, GLASS_COUNT, GLASS_XP, GULL_COUNT, GULL_XP, HERON_XP, KEEPER_XP, LAMP_XP, MAK_XP, SHORE_STORAGE_KEY, SHORE_TOTAL_XP,
  SONG_XP, TIDE_SOLVED_XP, calmCrab, calmGull, causewayOpen, collectGlass, defeatHeron, gatesOf, heronAwake, keeperAsked, keeperClaim, keeperScript, lightLamp, loadShore, makAsked, makClaim, makScript,
  newShore, readBottle, ringBuoy, sanitizeShore, saveShore, tideSolved, type ShoreState,
} from './shoreQuest';
import { EBB_SONG, FLOOD_SONG, type BuoyId } from './shoreLayout';
import { CATALOG, itemById } from '../cosmetics/catalog';
import { LANTERN_REWARD, SAILOR_REWARDS, SHORE_REWARDS, newProgress, reduceQuest, type Progress } from './woodsQuest';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
const finishedWoods = (): Progress => ({ ...newProgress(), stage: 'complete', gateOpen: true, bossDefeated: true, unlocked: ['mossy-cloak'], xp: 330, petalIds: [0, 1, 2, 3, 4, 5], sproutsCalmed: 3, runesSolved: 3 });
/** Rings a whole song, returning the last result. */
function sing(s: ShoreState, song: readonly BuoyId[]) {
  let attempt: BuoyId[] = [], r = ringBuoy(s, attempt, song[0]);
  for (let i = 0; i < song.length; i++) { r = ringBuoy(s, attempt, song[i]); s = r.state; attempt = r.attempt; }
  return r;
}

describe('moonwake shore quest: the bells', () => {
  it('starts with a stopped tide and no way to the lighthouse', () => {
    const s = newShore(); expect(s.tide).toBe('still'); expect(causewayOpen(s)).toBe(false); expect(heronAwake(s)).toBe(false); expect(gatesOf(s)).toEqual({ tide: 'still', causeway: false });
  });
  it('turns the tide to low for the ebb song and high for the flood song, and pays each once', () => {
    let r = sing(newShore(), EBB_SONG); expect(r.outcome).toBe('ebb'); expect(r.state.tide).toBe('low'); expect(r.xp).toBe(SONG_XP); expect(r.solved).toBe(false); expect(causewayOpen(r.state)).toBe(false);
    r = sing(r.state, FLOOD_SONG); expect(r.outcome).toBe('flood'); expect(r.state.tide).toBe('high'); expect(r.xp).toBe(SONG_XP + TIDE_SOLVED_XP); expect(r.solved).toBe(true);
    expect(tideSolved(r.state)).toBe(true); expect(causewayOpen(r.state)).toBe(true);
    // ringing them again moves the tide but pays nothing
    r = sing(r.state, EBB_SONG); expect(r.state.tide).toBe('low'); expect(r.xp).toBe(0); expect(causewayOpen(r.state)).toBe(true);
  });
  it('works in either order: the flood song first, then the ebb song', () => {
    let r = sing(newShore(), FLOOD_SONG); expect(r.state.tide).toBe('high'); expect(r.xp).toBe(SONG_XP);
    r = sing(r.state, EBB_SONG); expect(r.state.tide).toBe('low'); expect(r.solved).toBe(true); expect(causewayOpen(r.state)).toBe(true);
  });
  it('forgives a wrong bell: the try starts again, nothing is lost, and the right bell then still counts', () => {
    let s = newShore(), r = ringBuoy(s, [], 'wave'); expect(r.outcome).toBe('right'); expect(r.attempt).toEqual(['wave']);
    r = ringBuoy(s, r.attempt, 'star'); expect(r.outcome).toBe('wrong'); expect(r.xp).toBe(0); expect(r.state.tide).toBe('still'); expect(r.attempt).toEqual(['star']);   // the star bell starts the flood song
    r = ringBuoy(s, [], 'shell'); expect(r.outcome).toBe('wrong'); expect(r.attempt).toEqual([]);   // no song starts with the shell bell
    r = ringBuoy(s, ['wave'], 'wave'); expect(r.outcome).toBe('wrong'); expect(r.attempt).toEqual(['wave']);
    s = sing(s, EBB_SONG).state; expect(s.tide).toBe('low');
  });
  it('says "same" when the song for the tide that is already here is rung again', () => {
    const low = sing(newShore(), EBB_SONG).state, again = sing(low, EBB_SONG);
    expect(again.outcome).toBe('same'); expect(again.xp).toBe(0); expect(again.state).toBe(low);
  });
  it('ignores an unknown bell and an over-long attempt', () => {
    const r = ringBuoy(newShore(), ['wave', 'shell', 'star', 'star'], 'wave'); expect(['right', 'wrong', 'ebb']).toContain(r.outcome);
    expect(ringBuoy(newShore(), [], 'nope' as BuoyId).outcome).toBe('wrong');
  });
});

describe('moonwake shore quest: prizes', () => {
  it('pays each piece of sea-glass once, with a bonus on the last', () => {
    let s = newShore(), xp = 0;
    for (let i = 0; i < GLASS_COUNT; i++) { const r = collectGlass(s, i); expect(r.first).toBe(true); expect(r.all).toBe(i === GLASS_COUNT - 1); s = r.state; xp += r.xp; }
    expect(xp).toBe(GLASS_COUNT * GLASS_XP + ALL_GLASS_XP);
    for (let i = 0; i < GLASS_COUNT; i++) expect(collectGlass(s, i).xp).toBe(0);
    expect(collectGlass(s, 99).xp).toBe(0); expect(collectGlass(newShore(), -1).first).toBe(false); expect(collectGlass(newShore(), 0.5).first).toBe(false);
  });
  it('pays each crab and gull once, by id, and never for a bad id', () => {
    let s = newShore();
    for (let i = 0; i < CRAB_COUNT; i++) { const r = calmCrab(s, i); expect(r.xp).toBe(CRAB_XP); s = r.state; expect(calmCrab(s, i).xp).toBe(0); }
    for (let i = 0; i < GULL_COUNT; i++) { const r = calmGull(s, i); expect(r.xp).toBe(GULL_XP); s = r.state; expect(calmGull(s, i).xp).toBe(0); }
    expect(calmCrab(s, CRAB_COUNT).xp).toBe(0); expect(calmGull(s, -2).xp).toBe(0); expect(s.crabs).toHaveLength(CRAB_COUNT); expect(s.gulls).toHaveLength(GULL_COUNT);
  });
  it('pays each message bottle once, with a bonus on the last', () => {
    let s = newShore(), xp = 0;
    for (let i = 0; i < BOTTLE_COUNT; i++) { const r = readBottle(s, i); s = r.state; xp += r.xp; expect(r.all).toBe(i === BOTTLE_COUNT - 1); }
    expect(xp).toBe(BOTTLE_COUNT * BOTTLE_XP + ALL_BOTTLES_XP); expect(readBottle(s, 0).xp).toBe(0);
  });
});

describe('moonwake shore quest: Mak Long, the Heron, the keeper and the lamp', () => {
  const allGlass = (s: ShoreState) => { for (let i = 0; i < GLASS_COUNT; i++) s = collectGlass(s, i).state; return s; };
  it('walks Mak Long through his script and pays the sum and the Sailor set exactly once', () => {
    let s = newShore(); expect(makScript(s)).toBe('intro'); s = makAsked(s); expect(makScript(s)).toBe('waiting'); expect(makAsked(s)).toBe(s);
    expect(makClaim(s).xp).toBe(0);                       // not before all the glass is found
    s = allGlass(s); expect(makScript(s)).toBe('report');
    const r = makClaim(s); expect(r.xp).toBe(MAK_XP); expect(r.unlocks).toEqual([...SAILOR_REWARDS]); expect(makScript(r.state)).toBe('thanks');
    expect(makClaim(r.state).xp).toBe(0); expect(makClaim(r.state).unlocks).toBeUndefined();
  });
  it('lets a hero who found all the glass before meeting Mak Long still be paid (the report comes first)', () => {
    const s = allGlass(newShore()); expect(makScript(s)).toBe('report'); expect(makClaim(s).xp).toBe(MAK_XP);
  });
  it('lets the Heron fall only once the causeway is up, and only once', () => {
    expect(defeatHeron(newShore()).xp).toBe(0);
    const open = sing(sing(newShore(), EBB_SONG).state, FLOOD_SONG).state; expect(heronAwake(open)).toBe(true);
    const r = defeatHeron(open); expect(r.xp).toBe(HERON_XP); expect(heronAwake(r.state)).toBe(false); expect(defeatHeron(r.state).xp).toBe(0);
  });
  it('lights the lamp only after the Heron is calm, pays once and gives the Lighthouse Lantern', () => {
    const open = sing(sing(newShore(), EBB_SONG).state, FLOOD_SONG).state;
    expect(lightLamp(open).xp).toBe(0);
    const r = lightLamp(defeatHeron(open).state); expect(r.xp).toBe(LAMP_XP); expect(r.unlocks).toEqual([LANTERN_REWARD]); expect(r.state.lampLit).toBe(true);
    expect(lightLamp(r.state).xp).toBe(0); expect(lightLamp(r.state).unlocks).toBeUndefined();
  });
  it('walks the keeper through his script and pays the clock riddle once, only when the Heron is calm', () => {
    let s = newShore(); expect(keeperScript(s)).toBe('intro'); s = keeperAsked(s); expect(keeperScript(s)).toBe('waiting'); expect(keeperClaim(s).xp).toBe(0);
    s = { ...s, heronDefeated: true }; expect(keeperScript(s)).toBe('report');
    const r = keeperClaim(s); expect(r.xp).toBe(KEEPER_XP); expect(keeperScript(r.state)).toBe('thanks'); expect(keeperClaim(r.state).xp).toBe(0);
  });
  it('has a total that adds up, and a whole-shore run pays exactly that', () => {
    let s = newShore(), xp = 0; const take = (n: number) => { xp += n; };
    let r = sing(s, EBB_SONG); s = r.state; take(r.xp); r = sing(s, FLOOD_SONG); s = r.state; take(r.xp);
    for (let i = 0; i < GLASS_COUNT; i++) { const g = collectGlass(s, i); s = g.state; take(g.xp); }
    for (let i = 0; i < CRAB_COUNT; i++) { const g = calmCrab(s, i); s = g.state; take(g.xp); }
    for (let i = 0; i < GULL_COUNT; i++) { const g = calmGull(s, i); s = g.state; take(g.xp); }
    for (let i = 0; i < BOTTLE_COUNT; i++) { const g = readBottle(s, i); s = g.state; take(g.xp); }
    take(makClaim(s).xp); s = makClaim(s).state; const h = defeatHeron(s); s = h.state; take(h.xp); take(keeperClaim(s).xp); s = keeperClaim(s).state; take(lightLamp(s).xp);
    expect(xp).toBe(SHORE_TOTAL_XP); expect(SHORE_TOTAL_XP).toBe(505); // 462 before v2.33 added three bottles, two crabs and two gulls
  });
});

describe('moonwake shore quest: the quest reducer', () => {
  it('adds shore XP and rewards only once the woods quest is done, and only known rewards, once each', () => {
    const early = reduceQuest(newProgress(), { kind: 'shore', xp: 50, unlocks: [LANTERN_REWARD] }); expect(early.xpGained).toBe(0); expect(early.state.unlocked).toEqual([]);
    const r = reduceQuest(finishedWoods(), { kind: 'shore', xp: 100, unlocks: [LANTERN_REWARD, 'not-a-reward'] });
    expect(r.xpGained).toBe(100); expect(r.state.unlocked).toContain(LANTERN_REWARD); expect(r.state.unlocked).not.toContain('not-a-reward'); expect(r.unlockedNow).toEqual([LANTERN_REWARD]);
    const again = reduceQuest(r.state, { kind: 'shore', xp: 0, unlocks: [LANTERN_REWARD] }); expect(again.unlockedNow ?? []).toEqual([]);
    const sailor = reduceQuest(finishedWoods(), { kind: 'shore', xp: 30, unlocks: [...SAILOR_REWARDS] }); expect(sailor.state.unlocked).toEqual(expect.arrayContaining([...SAILOR_REWARDS]));
    for (const u of SHORE_REWARDS) expect(typeof u).toBe('string');
  });
  it('caps one shore event and ignores bad numbers', () => {
    expect(reduceQuest(finishedWoods(), { kind: 'shore', xp: 99999 }).xpGained).toBe(300);
    expect(reduceQuest(finishedWoods(), { kind: 'shore', xp: NaN }).xpGained).toBe(0); expect(reduceQuest(finishedWoods(), { kind: 'shore', xp: -5 }).xpGained).toBe(0);
  });
});

describe('moonwake shore quest: saving', () => {
  it('round-trips through storage and survives corrupt data', () => {
    const store = mem(); let s = sing(newShore(), EBB_SONG).state; s = collectGlass(s, 3).state; s = makAsked(s);
    expect(saveShore(s, store)).toBe(true); expect(loadShore(store)).toEqual(sanitizeShore(s));
    store.setItem(SHORE_STORAGE_KEY, '{nope'); expect(loadShore(store)).toEqual(newShore()); expect(loadShore(undefined as never)).toBeTruthy();
    for (const bad of [null, 5, 'x', [], { songs: 'ebb', glass: 'x', tide: 12 }]) expect(() => sanitizeShore(bad)).not.toThrow();
  });
  it('never lets a save claim more than it earned', () => {
    expect(sanitizeShore({ lampLit: true })).toMatchObject({ lampLit: true, heronDefeated: true, songs: ['ebb', 'flood'] });                        // a lit lamp needs everything before it
    expect(sanitizeShore({ heronDefeated: true }).songs).toEqual(['ebb', 'flood']);
    expect(sanitizeShore({ songs: ['ebb'], heronDefeated: false }).songs).toEqual(['ebb']);
    expect(sanitizeShore({ mak: 2 }).mak).toBe(1); expect(sanitizeShore({ mak: 2, glass: [0, 1, 2, 3, 4, 5, 6, 7] }).mak).toBe(2);
    expect(sanitizeShore({ keeper: 2 }).keeper).toBe(1); expect(sanitizeShore({ keeper: 2, heronDefeated: true }).keeper).toBe(2);
    const x = sanitizeShore({ glass: [0, 0, 1, 99, -1, 2.5, 'a'], crabs: [9], gulls: [1, 1], bottles: [0, 7] });
    expect(x.glass).toEqual([0, 1]); expect(x.crabs).toEqual([]); expect(x.gulls).toEqual([1]); expect(x.bottles).toEqual([0]);
  });
  it('never leaves a solved puzzle with a stopped tide, and never stops a moving tide', () => {
    expect(sanitizeShore({ songs: ['ebb', 'flood'], tide: 'still' }).tide).toBe('low');
    expect(sanitizeShore({ songs: ['ebb'], tide: 'still' }).tide).toBe('low');
    expect(sanitizeShore({ songs: ['ebb', 'flood'], tide: 'high' }).tide).toBe('high');
    expect(sanitizeShore({ tide: 'sideways' }).tide).toBe('still'); expect(sanitizeShore({}).tide).toBe('still');
  });
  it('marks a save as visited once anything has happened', () => {
    expect(sanitizeShore({}).visited).toBe(false); expect(sanitizeShore({ glass: [1] }).visited).toBe(true); expect(sanitizeShore({ visited: true }).visited).toBe(true);
  });
});

describe('moonwake shore rewards in the wardrobe', () => {
  it('has a quest item for every shore reward, and the level-10 crown', () => {
    for (const id of SHORE_REWARDS) { const it = itemById(id); expect(it, id).toBeDefined(); expect(it!.access).toEqual({ type: 'quest', unlock: id }); expect(it!.collection).toBe('shore'); }
    expect(itemById('sea-crown')?.access).toEqual({ type: 'level', level: 10 });
    expect(SAILOR_REWARDS.map(id => itemById(id)!.slot).sort()).toEqual(['headgear', 'legs', 'outfit']);
    expect(itemById(LANTERN_REWARD)!.slot).toBe('offhand'); expect(CATALOG.filter(i => i.collection === 'shore')).toHaveLength(5);
  });
});
