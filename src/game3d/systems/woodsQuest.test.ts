import { describe, expect, it } from 'vitest';
import {
  COMPLETION_XP, PETALS_NEEDED, RUNES_PER_RUN, RUNE_STAR_XP, RUNE_XP, SPROUTS_NEEDED, levelForXp, loadProgress, newProgress, nextTier, objectiveText, reduceQuest, sanitizeProgress, saveProgress,
  type Progress, type QuestEvent,
} from './woodsQuest';

const play = (events: QuestEvent[], from: Progress = newProgress()) => events.reduce((p, e) => reduceQuest(p, e).state, from);
const petals = (n: number): QuestEvent[] => Array.from({ length: n }, (_, i) => ({ kind: 'petal' as const, id: i }));
const sprouts = (n: number): QuestEvent[] => Array.from({ length: n }, () => ({ kind: 'enemyDefeated' as const, enemy: 'sprout' as const }));
const runes = (n: number, mistakes = 0, from = 0): QuestEvent[] => Array.from({ length: n }, (_, i) => ({ kind: 'runeSolved' as const, index: from + i, mistakes }));

describe('woods quest', () => {
  it('walks the whole path and opens the gate with a reward only at the end', () => {
    let p = play([{ kind: 'talked' }]); expect(p.stage).toBe('petals');
    p = play(petals(PETALS_NEEDED), p); expect(p.stage).toBe('sprouts');
    p = play(sprouts(SPROUTS_NEEDED), p); expect(p.stage).toBe('runes'); expect(p.gateOpen).toBe(false);
    p = play(runes(RUNES_PER_RUN), p); expect(p.stage).toBe('boss'); expect(p.gateOpen).toBe(false);
    p = play([{ kind: 'enemyDefeated', enemy: 'mossback' }], p); expect(p.stage).toBe('return'); expect(p.gateOpen).toBe(false);
    const r = reduceQuest(p, { kind: 'returned' });
    expect(r.state.stage).toBe('complete'); expect(r.state.gateOpen).toBe(true); expect(r.xpGained).toBe(COMPLETION_XP);
    expect(r.unlockedNow).toEqual(['mossy-cloak']); expect(reduceQuest(r.state, { kind: 'returned' }).xpGained).toBe(0);
  });
  it('petals count once, and cannot be collected before the Elder asks', () => {
    expect(play([{ kind: 'petal', id: 1 }]).petalIds).toEqual([]);
    let p = play([{ kind: 'talked' }, { kind: 'petal', id: 1 }, { kind: 'petal', id: 1 }]); expect(p.petalIds).toEqual([1]); expect(p.xp).toBe(5);
    p = play([{ kind: 'enemyDefeated', enemy: 'mossback' }, { kind: 'enemyDefeated', enemy: 'mossback' }], p); expect(p.xp).toBe(65);
  });
  it('shows the right objective and levels up', () => {
    expect(objectiveText(newProgress())).toMatch(/Elder/);
    expect(objectiveText(play([{ kind: 'talked' }, ...petals(2)]))).toContain('2/6');
    expect(levelForXp(0)).toBe(1); expect(levelForXp(100)).toBe(2);
    expect(reduceQuest({ ...newProgress(), stage: 'return', xp: 95 }, { kind: 'returned' }).levelUp).toBe(true);
  });
  it('saves, loads and survives corrupt data', () => {
    const mem: Record<string, string> = {};
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    const p = play([{ kind: 'talked' }, ...petals(3)]);
    expect(saveProgress(p, store)).toBe(true); expect(loadProgress(store)).toEqual(p);
    expect(loadProgress({ getItem: () => '{nope' })).toEqual(newProgress());
    const bad = sanitizeProgress({ stage: 'hacked', petalIds: [1, 1, 'x', -4, 2], xp: -9, gateOpen: true, sproutsCalmed: 1e9 });
    expect(bad.stage).toBe('talk'); expect(bad.petalIds).toEqual([1, 2]); expect(bad.xp).toBe(0); expect(bad.gateOpen).toBe(false); expect(bad.sproutsCalmed).toBe(0); // nothing can be calmed before the sprouts stage
    expect(sanitizeProgress({ stage: 'runes', sproutsCalmed: 1e9 }).sproutsCalmed).toBe(99);
    expect(saveProgress(p, undefined)).toBe(false);
  });

  it('asks the Rune Stone riddles in order, only at the Rune Stone stage', () => {
    const atRunes = play([{ kind: 'talked' }, ...petals(PETALS_NEEDED), ...sprouts(SPROUTS_NEEDED)]);
    expect(atRunes.stage).toBe('runes'); expect(atRunes.runesSolved).toBe(0);
    expect(reduceQuest(atRunes, { kind: 'runeSolved', index: 1, mistakes: 0 }).state).toBe(atRunes); // out of order: ignored
    expect(reduceQuest(newProgress(), { kind: 'runeSolved', index: 0, mistakes: 0 }).xpGained).toBe(0); // too early: ignored
    const one = reduceQuest(atRunes, { kind: 'runeSolved', index: 0, mistakes: 0 });
    expect(one.state.runesSolved).toBe(1); expect(one.state.stage).toBe('runes'); expect(one.xpGained).toBe(RUNE_XP + RUNE_STAR_XP);
    expect(reduceQuest(one.state, { kind: 'runeSolved', index: 0, mistakes: 0 }).xpGained).toBe(0); // the same riddle never pays twice
    const slip = reduceQuest(one.state, { kind: 'runeSolved', index: 1, mistakes: 2 });
    expect(slip.xpGained).toBe(RUNE_XP); // mistakes cost only the bonus, never the base reward
    expect(objectiveText(atRunes)).toContain('0/3'); expect(objectiveText(slip.state)).toContain('2/3');
  });
  it('wakes the Old Mossback when the third riddle is solved, and adapts the difficulty', () => {
    const atRunes = play([{ kind: 'talked' }, ...petals(PETALS_NEEDED), ...sprouts(SPROUTS_NEEDED)]);
    const smooth = play(runes(3, 0), atRunes); expect(smooth.stage).toBe('boss'); expect(smooth.runeTier).toBe(2); expect(smooth.runeMistakes).toBe(0);
    const rough = play(runes(3, 2), { ...atRunes, runeTier: 3 }); expect(rough.runeTier).toBe(2);
    const middling = play([...runes(1, 1), ...runes(1, 1, 1), ...runes(1, 0, 2)], atRunes); expect(middling.runeTier).toBe(1);
    expect(nextTier(1, 5)).toBe(1); expect(nextTier(3, 0)).toBe(3); expect(nextTier(2, 3)).toBe(2); expect(nextTier(2, 1)).toBe(3); expect(nextTier(2, 5)).toBe(1);
  });
  it('lets a child practise after the quest part, for no XP', () => {
    const afterRunes = play([{ kind: 'talked' }, ...petals(PETALS_NEEDED), ...sprouts(SPROUTS_NEEDED), ...runes(3, 0)]);
    const r = reduceQuest(afterRunes, { kind: 'practised', mistakes: 0 });
    expect(r.xpGained).toBe(0); expect(r.state.xp).toBe(afterRunes.xp); expect(r.state.runeTier).toBe(3);
    const before = play([{ kind: 'talked' }]);
    expect(reduceQuest(before, { kind: 'practised', mistakes: 0 }).state).toBe(before);
  });
  it('keeps saves made before the Rune Stone existed, and sanitises the new fields', () => {
    const old = sanitizeProgress({ stage: 'boss', petalIds: [0, 1, 2, 3, 4, 5], sproutsCalmed: 3, bossDefeated: false, xp: 120, gateOpen: false, unlocked: [] });
    expect(old.stage).toBe('boss'); expect(old.runesSolved).toBe(RUNES_PER_RUN); expect(old.runeTier).toBe(1);
    expect(sanitizeProgress({ stage: 'sprouts', runesSolved: 3 }).runesSolved).toBe(0);
    expect(sanitizeProgress({ stage: 'runes', runesSolved: 99, runeMistakes: -4, runeTier: 'x' })).toMatchObject({ runesSolved: 2, runeMistakes: 0, runeTier: 1 });
    expect(sanitizeProgress({ stage: 'runes', runesSolved: 1, runeMistakes: 2, runeTier: 3 })).toMatchObject({ runesSolved: 1, runeMistakes: 2, runeTier: 3 });
  });
});
