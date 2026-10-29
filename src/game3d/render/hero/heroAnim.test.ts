import { describe, expect, it } from 'vitest';
import { ATTACK_CLIP, STRIDE, attackClipTime, locomotionPlan, rollClipTime, specialClipTime } from './heroAnim';

describe('hero animation plan', () => {
  it('blend weights always sum to 1', () => {
    for (let s = 0; s <= 9; s += 0.25) { const p = locomotionPlan(s); expect(p.idle + p.walk + p.jog + p.sprint).toBeCloseTo(1, 6); }
  });
  it('stands still when stopped and sprints when fast', () => {
    expect(locomotionPlan(0).idle).toBe(1);
    expect(locomotionPlan(STRIDE.sprint * 1.2).sprint).toBeGreaterThan(0.9);
  });
  it('lands the sword on the logic hit frame', () => {
    expect(attackClipTime(0, 0.33)).toBeCloseTo(ATTACK_CLIP.start);
    expect(attackClipTime(0.33, 0.33)).toBeCloseTo(ATTACK_CLIP.hit);
    expect(attackClipTime(1, 0.33)).toBeCloseTo(ATTACK_CLIP.end);
    expect(specialClipTime(0.43, 0.43)).toBeCloseTo(ATTACK_CLIP.hit);
  });
  it('the roll covers its whole clip', () => { expect(rollClipTime(0)).toBeLessThan(rollClipTime(1)); });
});
