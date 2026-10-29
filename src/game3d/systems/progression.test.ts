import { HOLLOW_TOTAL_XP } from './hollowQuest';
import { SHORE_TOTAL_XP } from './shoreQuest';
import { describe, expect, it } from 'vitest';
import { defaultCosmetics, isOwned } from '../cosmetics/inventory';
import { CATALOG, itemById } from '../cosmetics/catalog';
import { objectiveLine } from '../data/woodsText';
import { objectiveProgress } from './hudData';
import { makeRun } from './runePuzzle';
import {
  BONUS_XP_CAP, BOSS_XP, COMPLETION_REWARD, COMPLETION_XP, PETALS_NEEDED, PATROL_XP, PETAL_XP, RUNES_PER_RUN, RUNE_STAR_XP, RUNE_XP, SPROUTS_NEEDED, SPROUT_XP,
  levelForXp, loadProgress, newProgress, reduceQuest, sanitizeProgress, saveProgress, type Progress, type QuestEvent,
} from './woodsQuest';

/** A phone's storage in memory: every event below is saved and re-loaded, as if the page was closed and opened again. */
function device() {
  const mem: Record<string, string> = {};
  const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
  let p: Progress = newProgress();
  let xpPaid = 0; const log: string[] = [];
  return {
    get p() { return p; }, get xpPaid() { return xpPaid; }, log,
    send(e: QuestEvent) {
      const r = reduceQuest(p, e); xpPaid += r.xpGained; p = r.state;
      saveProgress(p, store); p = loadProgress(store); // "reload the page"
      log.push(p.stage); return r;
    },
  };
}

describe('the whole Whispering Woods quest, from the first word to the final reward', () => {
  it('plays start to finish, saving after every step, with the right XP, level and reward', () => {
    const d = device();
    expect(d.p.stage).toBe('talk'); expect(objectiveProgress(d.p)).toBeNull();

    // petals cannot be taken before the Elder has asked
    d.send({ kind: 'petal', id: 0 }); expect(d.p.petalIds).toEqual([]); expect(d.xpPaid).toBe(0);
    d.send({ kind: 'talked' }); expect(d.p.stage).toBe('petals');

    for (let i = 0; i < PETALS_NEEDED; i++) {
      d.send({ kind: 'petal', id: i }); d.send({ kind: 'petal', id: i }); // the same petal twice pays once
      if (i < PETALS_NEEDED - 1) expect(objectiveProgress(d.p)).toEqual({ done: i + 1, total: PETALS_NEEDED });
    }
    expect(d.p.stage).toBe('sprouts'); expect(d.xpPaid).toBe(PETALS_NEEDED * PETAL_XP);
    expect(objectiveLine('en', d.p)).toContain(`0/${SPROUTS_NEEDED}`);

    for (let i = 0; i < SPROUTS_NEEDED; i++) d.send({ kind: 'enemyDefeated', enemy: 'sprout' });
    expect(d.p.stage).toBe('runes');

    // the Rune Stone: the first riddle takes one slip (so it earns no star), the others are right first time
    const run = makeRun(12345, d.p.runeTier); expect(run).toHaveLength(RUNES_PER_RUN);
    d.send({ kind: 'runeSolved', index: 1, mistakes: 0 }); expect(d.p.runesSolved).toBe(0); // out of order: refused
    for (let i = 0; i < RUNES_PER_RUN; i++) d.send({ kind: 'runeSolved', index: i, mistakes: i === 0 ? 1 : 0 });
    expect(d.p.stage).toBe('boss'); expect(d.p.runesSolved).toBe(RUNES_PER_RUN);
    expect(d.p.runeTier).toBe(2); // one slip in the whole run is a smooth run: the next riddles are a little harder
    expect(d.p.gateOpen).toBe(false);

    // the Old Mossback counts once
    d.send({ kind: 'enemyDefeated', enemy: 'mossback' }); d.send({ kind: 'enemyDefeated', enemy: 'mossback' });
    expect(d.p.stage).toBe('return'); expect(d.p.gateOpen).toBe(false);
    expect(isOwned(itemById(COMPLETION_REWARD)!, defaultCosmetics(), { level: levelForXp(d.p.xp), unlocked: d.p.unlocked })).toBe(false);

    const end = d.send({ kind: 'returned' }); d.send({ kind: 'returned' }); // claiming twice pays once
    expect(end.unlockedNow).toEqual([COMPLETION_REWARD]); expect(d.p.stage).toBe('complete'); expect(d.p.gateOpen).toBe(true);
    expect(d.p.unlocked).toEqual([COMPLETION_REWARD]);
    expect(isOwned(itemById(COMPLETION_REWARD)!, defaultCosmetics(), { level: levelForXp(d.p.xp), unlocked: d.p.unlocked })).toBe(true);

    const expected = PETALS_NEEDED * PETAL_XP + SPROUTS_NEEDED * SPROUT_XP + RUNES_PER_RUN * RUNE_XP + (RUNES_PER_RUN - 1) * RUNE_STAR_XP + BOSS_XP + COMPLETION_XP;
    expect(d.p.xp).toBe(expected); expect(d.xpPaid).toBe(expected); // what the child was shown is what was saved
    expect(levelForXp(d.p.xp)).toBe(4);
    expect(d.log).not.toContain('hacked');
  });

  it('pays nothing for repeats after the quest is done', () => {
    const d = device();
    const all: QuestEvent[] = [{ kind: 'talked' }, ...Array.from({ length: PETALS_NEEDED }, (_, i) => ({ kind: 'petal' as const, id: i })),
      ...Array.from({ length: SPROUTS_NEEDED }, () => ({ kind: 'enemyDefeated' as const, enemy: 'sprout' as const })),
      ...Array.from({ length: RUNES_PER_RUN }, (_, i) => ({ kind: 'runeSolved' as const, index: i, mistakes: 0 })),
      { kind: 'enemyDefeated', enemy: 'mossback' }, { kind: 'returned' }];
    all.forEach(e => d.send(e));
    const xp = d.p.xp;
    for (const e of all.filter(e => !(e.kind === 'enemyDefeated' && e.enemy === 'sprout'))) d.send(e); // everything except the sprout patrol
    expect(d.p.xp).toBe(xp);
    d.send({ kind: 'practised', mistakes: 0 }); expect(d.p.xp).toBe(xp); // practice never pays
  });

  const finished = (): ReturnType<typeof device> => {
    const d = device();
    [{ kind: 'talked' }, ...Array.from({ length: PETALS_NEEDED }, (_, i) => ({ kind: 'petal' as const, id: i })),
      ...Array.from({ length: SPROUTS_NEEDED }, () => ({ kind: 'enemyDefeated' as const, enemy: 'sprout' as const })),
      ...Array.from({ length: RUNES_PER_RUN }, (_, i) => ({ kind: 'runeSolved' as const, index: i, mistakes: 0 })),
      { kind: 'enemyDefeated', enemy: 'mossback' }, { kind: 'returned' }].forEach(e => d.send(e as QuestEvent));
    return d;
  };
  const sprout: QuestEvent = { kind: 'enemyDefeated', enemy: 'sprout' };

  it('the woods patrol: a returning sprout pays PATROL_XP after the quest, and nothing before it', () => {
    const early = device(); early.send({ kind: 'talked' }); early.send(sprout); expect(early.p.xp).toBe(0); expect(early.p.bonusXp).toBe(0);
    const d = finished(); const before = d.p.xp; d.send(sprout);
    expect(d.p.xp).toBe(before + PATROL_XP); expect(d.p.bonusXp).toBe(PATROL_XP);
  });
  it('the patrol pool runs out exactly at the cap and the last payment is trimmed, never more', () => {
    const d = finished(); const before = d.p.xp;
    for (let i = 0; i < 60; i++) d.send(sprout);
    expect(d.p.bonusXp).toBe(BONUS_XP_CAP); expect(d.p.xp).toBe(before + BONUS_XP_CAP);
    d.send(sprout); expect(d.p.xp).toBe(before + BONUS_XP_CAP);
  });
  it('quest plus patrol reaches level 5, so every level reward in the wardrobe can be earned', () => {
    const d = finished(); for (let i = 0; i < 60; i++) d.send(sprout);
    expect(levelForXp(d.p.xp)).toBeGreaterThanOrEqual(5);
    // the woods alone earn every level reward up to level 5; the Sea-glass Crown (level 10, v2.29) is the prize for going on through the Hollow and the shore
    const woodsMax = Math.max(...CATALOG.map(i => (i.access.type === 'level' && i.access.level <= 5 ? i.access.level : 0)));
    expect(levelForXp(d.p.xp)).toBeGreaterThanOrEqual(woodsMax);
    const maxLevel = Math.max(...CATALOG.map(i => (i.access.type === 'level' ? i.access.level : 0)));
    expect(maxLevel).toBe(10);
    expect(levelForXp(d.p.xp + HOLLOW_TOTAL_XP + SHORE_TOTAL_XP)).toBeGreaterThanOrEqual(maxLevel);
    expect(levelForXp(d.p.xp + HOLLOW_TOTAL_XP)).toBeLessThan(maxLevel + 3);
  });
  it('bonus XP survives a save, and a hand-edited save cannot exceed the cap or carry bonus into an unfinished quest', () => {
    const d = finished(); d.send(sprout); expect(d.p.bonusXp).toBe(PATROL_XP); // `device` saves and reloads after every event
    expect(sanitizeProgress({ ...d.p, bonusXp: 99999 }).bonusXp).toBe(BONUS_XP_CAP);
    expect(sanitizeProgress({ stage: 'petals', bonusXp: 50 }).bonusXp).toBe(0);
    expect(newProgress().bonusXp).toBe(0);
  });
});

describe('saves never strand a child', () => {
  it('moves on when the saved numbers already finish the saved stage', () => {
    expect(sanitizeProgress({ stage: 'petals', petalIds: [0, 1, 2, 3, 4, 5] }).stage).toBe('sprouts');
    expect(sanitizeProgress({ stage: 'sprouts', petalIds: [0, 1, 2, 3, 4, 5], sproutsCalmed: 3 }).stage).toBe('runes');
    const boss = sanitizeProgress({ stage: 'boss', bossDefeated: true }); expect(boss.stage).toBe('return'); // the boss would never come back
  });
  it('always opens the gate and keeps the reward for a finished quest', () => {
    const p = sanitizeProgress({ stage: 'complete', gateOpen: false, unlocked: [] });
    expect(p.gateOpen).toBe(true); expect(p.unlocked).toContain(COMPLETION_REWARD); expect(p.bossDefeated).toBe(true);
  });
  it('does not open the gate early, whatever a save claims', () => {
    expect(sanitizeProgress({ stage: 'return', gateOpen: true }).gateOpen).toBe(false);
  });
});
