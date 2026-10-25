import { describe, expect, it } from 'vitest';
import { clampThumb, stickVector } from './touchStick';

describe('touchStick', () => {
  it('ignores tiny thumb movements inside the dead zone', () => {
    expect(stickVector(3, 2, 40)).toEqual({ x: 0, y: 0 });
    expect(stickVector(0, 0, 40)).toEqual({ x: 0, y: 0 });
  });
  it('returns unit vectors in all eight-ish directions, including diagonals', () => {
    expect(stickVector(30, 0, 40)).toEqual({ x: 1, y: 0 });
    expect(stickVector(0, -30, 40)).toEqual({ x: 0, y: -1 });
    const diagonal = stickVector(30, 30, 40);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(diagonal.x).toBeCloseTo(diagonal.y);
  });
  it('is safe for a zero radius', () => {
    expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
  });
  it('keeps the visual thumb inside the base', () => {
    expect(clampThumb(100, 0, 40)).toEqual({ x: 40, y: 0 });
    expect(clampThumb(10, 10, 40)).toEqual({ x: 10, y: 10 });
  });
});
