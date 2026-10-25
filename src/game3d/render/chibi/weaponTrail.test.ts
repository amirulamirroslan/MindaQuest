import { describe, expect, it } from 'vitest';
import { catmull, trailAlpha } from './WeaponTrail';

describe('weapon trail maths (v2.12)', () => {
  it('catmull-rom passes through its control points at t = 0 and 1', () => {
    expect(catmull(0, 1, 3, 4, 0)).toBeCloseTo(1); expect(catmull(0, 1, 3, 4, 1)).toBeCloseTo(3);
  });
  it('a straight line stays straight', () => { for (const t of [0.25, 0.5, 0.75]) expect(catmull(0, 1, 2, 3, t)).toBeCloseTo(1 + t); });
  it('alpha is the peak when new, fades monotonically and is gone at the end of its life', () => {
    expect(trailAlpha(0, 0.2, 0.9)).toBeCloseTo(0.9); expect(trailAlpha(0.2, 0.2, 0.9)).toBe(0); expect(trailAlpha(0.5, 0.2, 0.9)).toBe(0);
    expect(trailAlpha(0.05, 0.2, 1)).toBeGreaterThan(trailAlpha(0.1, 0.2, 1));
  });
});
