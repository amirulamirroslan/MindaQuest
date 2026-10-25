import { describe, expect, it } from 'vitest';
import { ColliderGrid, isClear, rayClearDistance, resolveCircles } from './colliders';
import { initialPixelRatio, nextPixelRatio, MIN_PIXEL_RATIO } from './adaptiveRes';

describe('colliders', () => {
  const grid = new ColliderGrid([{ x: 5, z: 0, r: 1 }, { x: -3, z: 4, r: 0.5 }]);
  it('pushes a body out of a circle along the line between centres', () => {
    const r = resolveCircles(grid, 4.2, 0, 0.5);
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(3.5, 5);
    expect(isClear(grid, r.x, r.z, 0.5)).toBe(true);
  });
  it('leaves free bodies alone', () => { expect(resolveCircles(grid, 0, 0, 0.5)).toEqual({ x: 0, z: 0, hit: false }); });
  it('finds the clear distance of a ray', () => {
    expect(rayClearDistance(grid, 0, 0, 1, 0, 10, 0)).toBeCloseTo(4, 5);
    expect(rayClearDistance(grid, 0, 0, 1, 0, 10, 0.5)).toBeCloseTo(3.5, 5);
    expect(rayClearDistance(grid, 0, 0, -1, 0, 10, 0)).toBe(10);
    expect(rayClearDistance(grid, 0, 0, 1, 0, 3, 0)).toBe(3);
  });
  it('ignores circles the ray starts inside', () => { expect(rayClearDistance(grid, 5, 0, 1, 0, 10, 0)).toBe(10); });
});

describe('adaptive resolution', () => {
  it('caps the device ratio at 2 and honours an override', () => {
    expect(initialPixelRatio(3)).toBe(2);
    expect(initialPixelRatio(1.5)).toBe(1.5);
    expect(initialPixelRatio(undefined)).toBe(1);
    expect(initialPixelRatio(2, 1)).toBe(1);
  });
  it('only steps down, and not below the floor', () => {
    expect(nextPixelRatio(2, 30)).toBe(1.75);
    expect(nextPixelRatio(2, 60)).toBe(2);
    expect(nextPixelRatio(MIN_PIXEL_RATIO, 10)).toBe(MIN_PIXEL_RATIO);
  });
});
