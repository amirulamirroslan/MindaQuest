import { describe, expect, it } from 'vitest';
import {
  ALL_SHARDS_XP, ALL_TABLETS_XP, DOOR_XP, GLIM_XP, GLOWCAP_COUNT, HEART_XP, HOLLOW_STORAGE_KEY, HOLLOW_TOTAL_XP, SHARDLING_COUNT, SHARDLING_XP, SHARD_COUNT, SHARD_XP, TABLET_COUNT, TABLET_XP, WARDEN_XP,
  calmShardling, collectShard, defeatWarden, glimAsked, glimClaim, glimScript, hollowPerfect, lightGlowcap, loadHollow, markVisited,
  newHollow, readTablet, sanitizeHollow, saveHollow, secretOpen, strikeEcho, touchHeart, wardenAwake,
} from './hollowQuest';
import { ECHO_ORDER } from './hollowLayout';
import { itemById } from '../cosmetics/catalog';
import { HOLLOW_PERFECT_REWARD, HOLLOW_REWARD, WARDEN_REWARD, newProgress, reduceQuest, sanitizeProgress, levelForXp, type Progress } from './woodsQuest';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
const finishedWoods = (): Progress => ({ ...newProgress(), stage: 'complete', gateOpen: true, bossDefeated: true, unlocked: ['mossy-cloak'], xp: 330, petalIds: [0, 1, 2, 3, 4, 5], sproutsCalmed: 3, runesSolved: 3 });

describe('crystal hollow quest', () => {
  it('pays each Moon Shard once, with a bonus on the last', () => {
    let s = newHollow(), xp = 0;
    for (let i = 0; i < SHARD_COUNT; i++) { const r = collectShard(s, i); expect(r.first).toBe(true); expect(r.all).toBe(i === SHARD_COUNT - 1); s = r.state; xp += r.xp; }
    expect(xp).toBe(SHARD_COUNT * SHARD_XP + ALL_SHARDS_XP);
    for (let i = 0; i < SHARD_COUNT; i++) { const again = collectShard(s, i); expect(again.xp).toBe(0); expect(again.state).toBe(s); }
    expect(collectShard(s, 99).xp).toBe(0); expect(collectShard(newHollow(), -1).first).toBe(false); expect(collectShard(newHollow(), 1.5).first).toBe(false);
  });
  it('opens the secret nook only when every glowcap has been touched', () => {
    let s = newHollow();
    for (let i = 0; i < GLOWCAP_COUNT; i++) { const r = lightGlowcap(s, i); expect(r.first).toBe(true); expect(r.opened).toBe(i === GLOWCAP_COUNT - 1); s = r.state; expect(secretOpen(s)).toBe(i === GLOWCAP_COUNT - 1); }
    expect(lightGlowcap(s, 0).first).toBe(false); expect(lightGlowcap(s, 0).opened).toBe(false); expect(lightGlowcap(s, 7).state).toBe(s);
  });
  it('opens the Heart Door for the right order, forgives a wrong crystal, and pays once', () => {
    let s = newHollow(), step = 0;
    let r = strikeEcho(s, step, ECHO_ORDER[0]); expect(r.outcome).toBe('right'); s = r.state; step = r.step; expect(step).toBe(1);
    const wrong = ECHO_ORDER[2]; r = strikeEcho(s, step, wrong); expect(r.outcome).toBe('wrong'); expect(r.step).toBe(0); expect(r.xp).toBe(0); expect(r.state.doorOpen).toBe(false); step = r.step;
    for (let i = 0; i < ECHO_ORDER.length; i++) { r = strikeEcho(s, step, ECHO_ORDER[i]); s = r.state; step = r.step; if (i < ECHO_ORDER.length - 1) expect(r.outcome).toBe('right'); }
    expect(r.outcome).toBe('solved'); expect(r.xp).toBe(DOOR_XP); expect(s.doorOpen).toBe(true);
    const later = strikeEcho(s, 0, ECHO_ORDER[0]); expect(later.outcome).toBe('ignored'); expect(later.xp).toBe(0);
  });
  it('gives the Heartstone reward only through the open door, after the Warden, and only once', () => {
    expect(touchHeart(newHollow()).xp).toBe(0);
    expect(touchHeart({ ...newHollow(), doorOpen: true }).xp).toBe(0); // the Warden still guards it
    const open = { ...newHollow(), doorOpen: true, wardenDefeated: true }, r = touchHeart(open);
    expect(r.xp).toBe(HEART_XP); expect(r.unlock).toBe(HOLLOW_REWARD); expect(r.state.heartDone).toBe(true);
    expect(touchHeart(r.state).xp).toBe(0); expect(touchHeart(r.state).unlock).toBeUndefined();
  });
  it('totals 426 XP (386 before v2.32 added three shards and two tablets), which a woods-complete hero (330 + 120 patrol) turns into a level', () => {
    expect(HOLLOW_TOTAL_XP).toBe(426); expect(levelForXp(330 + 120 + HOLLOW_TOTAL_XP)).toBeGreaterThanOrEqual(9);
    expect(SHARD_COUNT).toBe(8); expect(TABLET_COUNT).toBe(5);
    expect(SHARDLING_COUNT * SHARDLING_XP + WARDEN_XP + GLIM_XP + TABLET_COUNT * TABLET_XP + ALL_TABLETS_XP).toBe(186); // what v2.28 added (176) plus the two new tablets
  });
  it('saves, loads and survives corrupt data', () => {
    const store = mem(); let s = markVisited(newHollow()); s = collectShard(s, 2).state; s = lightGlowcap(s, 1).state;
    expect(saveHollow(s, store)).toBe(true); expect(loadHollow(store)).toEqual(s);
    s = calmShardling(s, 3).state; s = readTablet(s, 1).state; s = { ...s, glim: 1 }; saveHollow(s, store); expect(loadHollow(store)).toEqual(s); // the new fields survive a reload
    store.setItem(HOLLOW_STORAGE_KEY, '{nope'); expect(loadHollow(store)).toEqual(newHollow());
    expect(sanitizeHollow(null)).toEqual(newHollow()); expect(sanitizeHollow('x')).toEqual(newHollow());
    const odd = sanitizeHollow({ shards: [0, 0, 1, 9, -2, 'a', 3.5], glowcaps: [2, 2, 5], doorOpen: 'yes', heartDone: true });
    expect(odd.shards).toEqual([0, 1]); expect(odd.glowcaps).toEqual([2]); expect(odd.doorOpen).toBe(true); expect(odd.visited).toBe(true); // a finished Heartstone implies the open door
    expect(loadHollow(undefined)).toEqual(newHollow());
  });
});

describe('crystal hollow v2.28 quest rules', () => {
  it('pays each Shardling once, remembers it, ignores bad ids, and says when all are calm', () => {
    let s = newHollow(), xp = 0;
    for (let i = 0; i < SHARDLING_COUNT; i++) { const r = calmShardling(s, i); expect(r.first).toBe(true); expect(r.all).toBe(i === SHARDLING_COUNT - 1); s = r.state; xp += r.xp; }
    expect(xp).toBe(SHARDLING_COUNT * SHARDLING_XP);
    for (let i = 0; i < SHARDLING_COUNT; i++) { const again = calmShardling(s, i); expect(again.xp).toBe(0); expect(again.first).toBe(false); expect(again.state).toBe(s); }
    for (const bad of [-1, 6, 1.5, NaN]) expect(calmShardling(newHollow(), bad).xp).toBe(0);
  });
  it('pays the Warden once, only through the open door, with the Warden\'s Mantle', () => {
    expect(defeatWarden(newHollow()).xp).toBe(0); expect(wardenAwake(newHollow())).toBe(false);
    const open = { ...newHollow(), doorOpen: true }; expect(wardenAwake(open)).toBe(true);
    const r = defeatWarden(open); expect(r.xp).toBe(WARDEN_XP); expect(r.unlock).toBe(WARDEN_REWARD); expect(r.state.wardenDefeated).toBe(true); expect(wardenAwake(r.state)).toBe(false);
    const again = defeatWarden(r.state); expect(again.xp).toBe(0); expect(again.unlock).toBeUndefined(); expect(again.state).toBe(r.state);
  });
  it('pays each Moon Tablet once, with a bonus on the last', () => {
    let s = newHollow(), xp = 0;
    for (let i = 0; i < TABLET_COUNT; i++) { const r = readTablet(s, i); expect(r.all).toBe(i === TABLET_COUNT - 1); s = r.state; xp += r.xp; }
    expect(xp).toBe(TABLET_COUNT * TABLET_XP + ALL_TABLETS_XP); expect(readTablet(s, 0).xp).toBe(0); expect(readTablet(s, 9).xp).toBe(0);
  });
  it('walks Glim through his request: intro, waiting, report once every Shardling is calm, then thanks, paid once', () => {
    let s = newHollow(); expect(glimScript(s)).toBe('intro'); expect(glimClaim(s).xp).toBe(0);
    s = glimAsked(s); expect(s.glim).toBe(1); expect(glimScript(s)).toBe('waiting'); expect(glimAsked(s)).toBe(s);
    for (let i = 0; i < SHARDLING_COUNT - 1; i++) s = calmShardling(s, i).state;
    expect(glimScript(s)).toBe('waiting'); expect(glimClaim(s).xp).toBe(0);
    s = calmShardling(s, SHARDLING_COUNT - 1).state; expect(glimScript(s)).toBe('report');
    const r = glimClaim(s); expect(r.xp).toBe(GLIM_XP); expect(r.state.glim).toBe(2); expect(glimScript(r.state)).toBe('thanks'); expect(glimClaim(r.state).xp).toBe(0);
    // a hero who calmed everything before ever meeting him still gets the report (and the same single payment)
    let early = newHollow(); for (let i = 0; i < SHARDLING_COUNT; i++) early = calmShardling(early, i).state; expect(glimScript(early)).toBe('report'); expect(glimClaim(early).xp).toBe(GLIM_XP);
  });
  it('migrates a v2.22 to v2.27 save: finished Heartstone = Warden already beaten; open door only = the Warden will be met; no new field is trusted blindly', () => {
    const old = sanitizeHollow({ visited: true, shards: [0], glowcaps: [], doorOpen: true, heartDone: true });
    expect(old.wardenDefeated).toBe(true); expect(old.heartDone).toBe(true); expect(old.shardlings).toEqual([]); expect(old.glim).toBe(0); expect(old.tablets).toEqual([]);
    const mid = sanitizeHollow({ visited: true, doorOpen: true, heartDone: false }); expect(mid.wardenDefeated).toBe(false); expect(wardenAwake(mid)).toBe(true);
    expect(sanitizeHollow({ wardenDefeated: true }).wardenDefeated).toBe(false); // no door, no Warden
    expect(sanitizeHollow({ glim: 2 }).glim).toBe(1); /* thanks need every Shardling calm */ expect(sanitizeHollow({ glim: 0 }).glim).toBe(0); expect(sanitizeHollow({ glim: 2, shardlings: [0, 1, 2, 3, 4, 5] }).glim).toBe(2); expect(sanitizeHollow({ glim: 7 }).glim).toBe(0);
    expect(sanitizeHollow({ shardlings: [0, 0, 9, -1, 'x'], tablets: [2, 2, 5] })).toMatchObject({ shardlings: [0], tablets: [2], visited: true });
  });
  it('plays the whole Hollow end to end through the real reducers: every prize paid exactly once, in total HOLLOW_TOTAL_XP, surviving a save and reload in the middle', () => {
    const store = mem(); let h = markVisited(newHollow()), p = finishedWoods(), earned = 0;
    const pay = (xp: number, unlock?: string) => { const r = reduceQuest(p, { kind: 'hollow', xp, unlock }); p = r.state; earned += r.xpGained; };
    for (let i = 0; i < SHARDLING_COUNT; i++) { const r = calmShardling(h, i); h = r.state; pay(r.xp); }
    h = glimAsked(h); { const r = glimClaim(h); h = r.state; pay(r.xp); }
    for (let i = 0; i < TABLET_COUNT; i++) { const r = readTablet(h, i); h = r.state; pay(r.xp); }
    for (let i = 0; i < SHARD_COUNT; i++) { const r = collectShard(h, i); h = r.state; pay(r.xp); }
    expect(touchHeart(h).xp).toBe(0);
    let step = 0; for (const c of ECHO_ORDER) { const r = strikeEcho(h, step, c); h = r.state; step = r.step; if (r.xp) pay(r.xp); }
    expect(h.doorOpen).toBe(true); expect(touchHeart(h).xp).toBe(0); // the Warden first
    saveHollow(h, store); h = loadHollow(store);
    { const r = defeatWarden(h); h = r.state; pay(r.xp, r.unlock); }
    { const r = touchHeart(h); h = r.state; pay(r.xp, r.unlock); }
    expect(earned).toBe(HOLLOW_TOTAL_XP); expect(p.xp).toBe(330 + HOLLOW_TOTAL_XP); for (const id of ['mossy-cloak', HOLLOW_REWARD, WARDEN_REWARD]) expect(p.unlocked).toContain(id);
    // nothing can be farmed: replay every action and nothing more is paid
    const before = p.xp;
    for (let i = 0; i < SHARDLING_COUNT; i++) pay(calmShardling(h, i).xp); pay(glimClaim(h).xp); for (let i = 0; i < TABLET_COUNT; i++) pay(readTablet(h, i).xp); for (let i = 0; i < SHARD_COUNT; i++) pay(collectShard(h, i).xp);
    pay(defeatWarden(h).xp, WARDEN_REWARD); pay(touchHeart(h).xp, HOLLOW_REWARD); pay(strikeEcho(h, 0, ECHO_ORDER[0]).xp);
    expect(p.xp).toBe(before); expect(p.unlocked.filter(x => x === WARDEN_REWARD)).toHaveLength(1);
    saveHollow(h, store); expect(loadHollow(store)).toEqual(h);
  });
});

describe('hollow XP in the woods quest reducer', () => {
  it('adds XP and the reward once, after the woods are complete', () => {
    const r = reduceQuest(finishedWoods(), { kind: 'hollow', xp: HEART_XP, unlock: HOLLOW_REWARD });
    expect(r.xpGained).toBe(HEART_XP); expect(r.state.xp).toBe(430); expect(r.unlockedNow).toEqual([HOLLOW_REWARD]); expect(r.state.unlocked).toEqual(['mossy-cloak', HOLLOW_REWARD]);
    const again = reduceQuest(r.state, { kind: 'hollow', xp: 0, unlock: HOLLOW_REWARD }); expect(again.unlockedNow).toEqual([]); expect(again.state).toBe(r.state);
  });
  it('can raise the level and reports it', () => {
    const p = { ...finishedWoods(), xp: 395 }; expect(reduceQuest(p, { kind: 'hollow', xp: 10 }).levelUp).toBe(true);
  });
  it('hands out the Warden\'s Mantle once, and never pays the Hollow\'s creatures through the woods rules', () => {
    const r = reduceQuest(finishedWoods(), { kind: 'hollow', xp: 80, unlock: WARDEN_REWARD }); expect(r.unlockedNow).toEqual([WARDEN_REWARD]);
    expect(reduceQuest(r.state, { kind: 'hollow', xp: 0, unlock: WARDEN_REWARD }).state).toBe(r.state);
    for (const enemy of ['shardling', 'warden'] as const) { const early = { ...newProgress(), stage: 'boss' as const }; const out = reduceQuest(early, { kind: 'enemyDefeated', enemy }); expect(out.state).toBe(early); expect(out.state.bossDefeated).toBe(false); const done = finishedWoods(); expect(reduceQuest(done, { kind: 'enemyDefeated', enemy }).state).toBe(done); }
  });
  it('ignores the event before the woods are complete, and ignores bad numbers and unknown rewards', () => {
    const mid = { ...newProgress(), stage: 'runes' as const, xp: 50 };
    expect(reduceQuest(mid, { kind: 'hollow', xp: 100, unlock: HOLLOW_REWARD }).state).toBe(mid);
    const done = finishedWoods();
    expect(reduceQuest(done, { kind: 'hollow', xp: NaN }).state).toBe(done); expect(reduceQuest(done, { kind: 'hollow', xp: -50 }).state).toBe(done);
    expect(reduceQuest(done, { kind: 'hollow', xp: 0, unlock: 'mossy-cloak-2' }).state).toBe(done);
    expect(reduceQuest(done, { kind: 'hollow', xp: 1e9 }).xpGained).toBe(300);
  });
  it('leaves the patrol bonus pool and the earlier stages alone', () => {
    const r = reduceQuest({ ...finishedWoods(), bonusXp: 64 }, { kind: 'hollow', xp: 50 });
    expect(r.state.bonusXp).toBe(64); expect(r.state.stage).toBe('complete'); expect(r.state.gateOpen).toBe(true);
  });
  it('a saved hero who earned the reward keeps it through sanitising', () => {
    const r = reduceQuest(finishedWoods(), { kind: 'hollow', xp: 100, unlock: HOLLOW_REWARD }).state;
    const back = sanitizeProgress(JSON.parse(JSON.stringify(r))); expect(back.unlocked).toContain(HOLLOW_REWARD); expect(back.xp).toBe(430);
  });
});

describe('v2.31.3 Hollow 100%', () => {
  const all = { ...newHollow(), heartDone: true, shards: Array.from({ length: SHARD_COUNT }, (_, i) => i), shardlings: Array.from({ length: SHARDLING_COUNT }, (_, i) => i), tablets: Array.from({ length: TABLET_COUNT }, (_, i) => i), glim: 2 as const };
  it('needs the Heartstone, every shard, Shardling and tablet, and Glim thanked', () => {
    expect(hollowPerfect(all)).toBe(true);
    for (const miss of [{ heartDone: false }, { shards: all.shards.slice(1) }, { shardlings: [0] }, { tablets: all.tablets.slice(1) }, { glim: 1 as const }]) expect(hollowPerfect({ ...all, ...miss })).toBe(false);
  });
  it('pays the Heartstone Cloak once, with no XP, and only after the quest is complete', () => {
    const p = finishedWoods();
    const r = reduceQuest(p, { kind: 'hollow', xp: 0, unlock: HOLLOW_PERFECT_REWARD });
    expect(r.unlockedNow).toEqual([HOLLOW_PERFECT_REWARD]); expect(r.xpGained).toBe(0);
    expect(reduceQuest(r.state, { kind: 'hollow', xp: 0, unlock: HOLLOW_PERFECT_REWARD }).state).toBe(r.state);
    expect(itemById(HOLLOW_PERFECT_REWARD)?.slot).toBe('cape');
  });
});

