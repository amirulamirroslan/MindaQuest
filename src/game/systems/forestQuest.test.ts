import { describe, expect, it } from 'vitest';
import { BRIDGE_REWARD_XP, ForestQuest, TIMBER_GOAL } from './forestQuest';

describe('ForestQuest', () => {
  it('requires meeting the trail keeper before timber can be collected', () => {
    const quest = new ForestQuest();
    expect(quest.collect('timber-1')).toBe(false);
    expect(quest.start()).toBe(true);
    expect(quest.stage).toBe('collecting');
  });

  it('counts each timber piece once and caps progress at the goal', () => {
    const quest = new ForestQuest();
    quest.start();
    for (let i = 0; i < TIMBER_GOAL; i++) expect(quest.collect(`timber-${i}`)).toBe(true);
    expect(quest.collect('timber-0')).toBe(false);
    expect(quest.collect('extra')).toBe(false);
    expect(quest.timberCount).toBe(TIMBER_GOAL);
  });

  it('remembers collected pieces throughout the current game session', () => {
    const quest = new ForestQuest();
    quest.start();
    expect(quest.collect('timber-01')).toBe(true);
    expect(quest.hasCollected('timber-01')).toBe(true);
    expect(quest.collect('timber-01')).toBe(false);
    expect(quest.timberCount).toBe(1);
  });

  it('blocks repairs until all 12 pieces are collected', () => {
    const quest = new ForestQuest();
    quest.start();
    for (let i = 0; i < TIMBER_GOAL - 1; i++) quest.collect(`timber-${i}`);
    expect(quest.canRepairBridge).toBe(false);
    expect(quest.repairBridge()).toBe(false);
    quest.collect('timber-last');
    expect(quest.canRepairBridge).toBe(true);
    expect(quest.repairBridge()).toBe(true);
    expect(quest.stage).toBe('bridge-repaired');
  });

  it('grants XP only once after crossing the repaired bridge', () => {
    const quest = new ForestQuest();
    quest.start();
    expect(quest.completeAfterCrossing()).toBe(false);
    for (let i = 0; i < TIMBER_GOAL; i++) quest.collect(`timber-${i}`);
    quest.repairBridge();
    expect(quest.xp).toBe(0);
    expect(quest.completeAfterCrossing()).toBe(true);
    expect(quest.completeAfterCrossing()).toBe(false);
    expect(quest.xp).toBe(BRIDGE_REWARD_XP);
    expect(quest.stage).toBe('complete');
  });
});
