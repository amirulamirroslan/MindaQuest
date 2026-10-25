import { describe, expect, it } from 'vitest';
import { gustLevel, windAt } from './wind';

describe('wind', () => {
  it('stays within [-1, 1] and the gust level within [0, 1] at any time and place', () => {
    for (let t = 0; t < 120000; t += 733) {
      for (const x of [-200, 0, 380, 800, 1600, 4000]) expect(Math.abs(windAt(t, x))).toBeLessThanOrEqual(1);
      expect(gustLevel(t)).toBeGreaterThanOrEqual(0);
      expect(gustLevel(t)).toBeLessThanOrEqual(1);
    }
  });
  it('is the same for the same time and place (so it is a field, not noise)', () => {
    expect(windAt(5000, 300)).toBe(windAt(5000, 300));
  });
  it('rolls across the map: a far-away spot sways differently from a near one', () => {
    let different = 0;
    for (let t = 0; t < 20000; t += 500) if (Math.abs(windAt(t, 100) - windAt(t, 900)) > 0.3) different++;
    expect(different).toBeGreaterThan(5);
  });
  it('really moves: it is not stuck near zero', () => {
    let peak = 0;
    for (let t = 0; t < 30000; t += 100) peak = Math.max(peak, Math.abs(windAt(t, 500)));
    expect(peak).toBeGreaterThan(0.7);
  });
});
