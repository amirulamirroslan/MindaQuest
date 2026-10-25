import { describe, expect, it } from 'vitest';
import { Spring, bump, clamp01, easeOutBack, easeOutCubic, recoilImpulse, sproutStyle } from './charAnim';
import { ENEMY_DEFS } from './enemies';

describe('charAnim', () => {
  it('easing curves hit their end points', () => {
    expect(easeOutCubic(0)).toBe(0); expect(easeOutCubic(1)).toBe(1);
    expect(easeOutBack(1)).toBeCloseTo(1, 6); expect(bump(0)).toBeCloseTo(0, 6); expect(bump(0.5)).toBeCloseTo(1, 6); expect(clamp01(5)).toBe(1);
  });
  it('a spring settles on its target and stays finite on a long frame', () => {
    const s = new Spring(160, 12); s.kick(6);
    for (let i = 0; i < 240; i++) s.step(1 / 60);
    expect(Math.abs(s.value)).toBeLessThan(1e-3);
    s.kick(50); s.step(5); expect(Number.isFinite(s.value)).toBe(true);
  });
  it('every sprout id gets a stable temperament and a sensible size', () => {
    const seen = new Set<string>();
    for (let id = 1; id <= 12; id++) { const a = sproutStyle(id), b = sproutStyle(id); expect(a).toEqual(b); expect(a.scale).toBeGreaterThanOrEqual(0.92); expect(a.scale).toBeLessThanOrEqual(1.08); seen.add(a.temperament); }
    expect(seen.size).toBe(3);
  });
  it('heavier creatures are shoved less, and later combo hits shove more', () => {
    expect(recoilImpulse(0, 4)).toBeLessThan(recoilImpulse(0, 1)); expect(recoilImpulse(2, 1)).toBeGreaterThan(recoilImpulse(0, 1));
  });
  it('the boss gets a longer send-off than a sprout', () => { expect(ENEMY_DEFS.mossback.deathTime).toBeGreaterThan(ENEMY_DEFS.sprout.deathTime * 2); });
});
