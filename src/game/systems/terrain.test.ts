import { describe, expect, it } from 'vitest';
import { classifyGround, GRASS_FRAMES, grassFrame, valueNoise } from './terrain';

describe('terrain', () => {
  it('is deterministic', () => {
    expect(grassFrame(12, 7)).toBe(grassFrame(12, 7));
    expect(valueNoise(3.3, 9.1, 5)).toBe(valueNoise(3.3, 9.1, 5));
  });
  it('varies the meadow in soft patches rather than one flat tile or per-tile speckle', () => {
    const counts = new Map<string, number>();
    let isolated = 0, total = 0;
    for (let row = 0; row < 60; row++) {
      for (let col = 0; col < 60; col++) {
        const frame = grassFrame(col, row);
        expect(GRASS_FRAMES).toContain(frame);
        counts.set(frame, (counts.get(frame) ?? 0) + 1);
        total++;
        const around = [grassFrame(col + 1, row), grassFrame(col - 1, row), grassFrame(col, row + 1), grassFrame(col, row - 1)];
        if (around.every((other) => other !== frame)) isolated++;
      }
    }
    expect(counts.size).toBe(3);
    expect(counts.get('grass-10')! / total).toBeGreaterThan(0.3);
    expect(isolated / total).toBeLessThan(0.03);
  });
  it('puts water inside the river, a sand beach beside it, and grass further away', () => {
    const probe = (col: number) => ({ river: col >= 10 && col <= 14, path: false });
    expect(classifyGround(12, 5, probe).kind).toBe('water');
    expect(classifyGround(9, 5, probe).kind).toBe('sand');
    expect(classifyGround(15, 5, probe).kind).toBe('sand');
    expect(classifyGround(5, 5, probe).kind).toBe('grass');
  });
  it('lets the trail win over the beach where they meet', () => {
    const probe = (col: number) => ({ river: col >= 10, path: col === 9 });
    expect(classifyGround(9, 3, probe).kind).toBe('path');
  });
});
