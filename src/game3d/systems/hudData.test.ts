import { describe, expect, it } from 'vitest';
import { bagCounts, equippedList, journalSteps, levelInfo, nextLevelUnlock, objectiveProgress, questFraction } from './hudData';
import { newProgress, PETALS_NEEDED } from './woodsQuest';
import { DEFAULT_EQUIPPED } from '../cosmetics/catalog';

const at = (patch: object) => ({ ...newProgress(), ...patch });

describe('hud data', () => {
  it('counts only the counted objectives', () => {
    expect(objectiveProgress(newProgress())).toBeNull();
    expect(objectiveProgress(at({ stage: 'petals', petalIds: [1, 2] }))).toEqual({ done: 2, total: PETALS_NEEDED });
    expect(objectiveProgress(at({ stage: 'sprouts', sproutsCalmed: 9 }))).toEqual({ done: 3, total: 3 });
    expect(objectiveProgress(at({ stage: 'boss' }))).toBeNull();
  });
  it('builds a journal with one current step', () => {
    const j = journalSteps(at({ stage: 'sprouts', sproutsCalmed: 1 }));
    expect(j.map(s => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo', 'todo']);
    expect(j[2].count).toEqual({ done: 1, total: 3 });
    expect(j.filter(s => s.count).length).toBe(1);
  });
  it('quest fraction runs 0..1', () => {
    expect(questFraction(newProgress())).toBe(0);
    expect(questFraction(at({ stage: 'complete' }))).toBe(1);
    expect(questFraction(at({ stage: 'petals', petalIds: [1, 2, 3] }))).toBeGreaterThan(questFraction(at({ stage: 'petals' })));
  });
  it('reads the bag from saved progress', () => {
    const b = bagCounts(at({ stage: 'runes', petalIds: [0, 1, 2, 3, 4, 5], sproutsCalmed: 3, runesSolved: 1, unlocked: ['mossy-cloak'] }));
    expect(b.petals.done).toBe(6); expect(b.sprouts.done).toBe(3); expect(b.riddles.done).toBe(1); expect(b.rewards).toEqual(['mossy-cloak']); expect(b.mossbackCalmed).toBe(false);
  });
  it('level info matches the 100 XP levels', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, xpInto: 0, xpToNext: 100, fraction: 0 });
    expect(levelInfo(250)).toMatchObject({ level: 3, xpInto: 50, xpToNext: 50, fraction: 0.5 });
  });
  it('finds the next level reward', () => {
    const n = nextLevelUnlock(1); expect(n).not.toBeNull(); expect(n!.level).toBeGreaterThan(1);
    expect(nextLevelUnlock(999)).toBeNull();
  });
  it('lists every slot', () => { expect(equippedList(DEFAULT_EQUIPPED).length).toBe(8); });
});
