import { describe, expect, it } from 'vitest';
import { buildTrailCells, TILE } from './forestLayout';
import { FootstepTracker, STRIDE, surfaceAt } from './footsteps';
import { riverCenterX } from './worldGeometry';

describe('FootstepTracker', () => {
  it('makes no steps while standing still', () => {
    const t = new FootstepTracker();
    for (let i = 0; i < 100; i++) expect(t.advance(0)).toEqual([]);
  });
  it('steps soon after starting to walk, then once per stride', () => {
    const t = new FootstepTracker();
    t.advance(0);
    let steps = 0, frames = 0;
    while (steps < 1) { steps += t.advance(170 / 60).length; frames++; }
    expect(frames).toBeLessThanOrEqual(8);
    const before = steps;
    for (let i = 0; i < 60; i++) steps += t.advance(170 / 60).length;
    expect(steps - before).toBeGreaterThanOrEqual(Math.floor(170 / STRIDE) - 1);
    expect(steps - before).toBeLessThanOrEqual(Math.ceil(170 / STRIDE) + 1);
  });
  it('alternates left and right feet', () => {
    const t = new FootstepTracker();
    const feet: number[] = [];
    for (let i = 0; i < 40; i++) feet.push(...t.advance(10));
    expect(feet.length).toBeGreaterThan(6);
    for (let i = 1; i < feet.length; i++) expect(feet[i]).toBe(-feet[i - 1]);
  });
  it('never fires a burst of steps after one long frame', () => {
    const t = new FootstepTracker();
    expect(t.advance(5000).length).toBeLessThanOrEqual(2);
    expect(t.advance(0.1).length).toBeLessThanOrEqual(1);
  });
});

describe('surfaceAt', () => {
  const trail = buildTrailCells();
  it('is wood on the repaired bridge deck and grass or dirt elsewhere', () => {
    const deckX = riverCenterX(800);
    expect(surfaceAt(deckX, 800, trail, true)).toBe('wood');
    expect(surfaceAt(deckX, 800, trail, false)).not.toBe('wood');
  });
  it('is dirt on the trail and grass off it', () => {
    const [cell] = [...trail];
    const [col, row] = cell.split(',').map(Number);
    expect(surfaceAt(col * TILE + 8, row * TILE + 8, trail, false)).toBe('dirt');
    expect(surfaceAt(30, 1250, trail, false)).toBe('grass');
  });
});
