import { describe, expect, it } from 'vitest';
import { actionLabel, bridgePrompt, objectiveLabel, talkPrompt } from './questText';

describe('questText', () => {
  it('gives a clear objective for every quest stage', () => {
    expect(objectiveLabel('unstarted', false)).toMatch(/Lina/);
    expect(objectiveLabel('collecting', false)).toMatch(/timber/i);
    expect(objectiveLabel('collecting', true)).toMatch(/Repair/);
    expect(objectiveLabel('bridge-repaired', false)).toMatch(/Cross/);
    expect(objectiveLabel('complete', false)).toMatch(/complete/i);
  });
  it('reports timber progress while the bridge is broken', () => {
    expect(bridgePrompt('collecting', false, 4, 12, 'E')).toBe('Bridge broken  ·  Timber 4/12');
    expect(bridgePrompt('collecting', true, 12, 12, 'E')).toBe('E  ·  Repair the bridge');
  });
  it('uses the right action label for touch and keyboard', () => {
    expect(actionLabel(true)).toBe('USE');
    expect(actionLabel(false)).toBe('E');
    expect(talkPrompt('USE')).toBe('USE  ·  Talk to Lina');
  });
});
