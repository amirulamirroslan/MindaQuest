import { describe, expect, it } from 'vitest';
import { parseTierOverride, performanceTierFor, profileFor } from './performance';

describe('performance profile', () => {
  it('uses the lighter decorative load on touch devices and the full one on desktop', () => {
    expect(performanceTierFor({ touch: true })).toBe('lite');
    expect(performanceTierFor({ touch: false })).toBe('full');
  });
  it('lets the URL override the tier', () => {
    expect(parseTierOverride('?perf=full')).toBe('full');
    expect(parseTierOverride('?debug&perf=lite')).toBe('lite');
    expect(parseTierOverride('?perf=banana')).toBeNull();
    expect(parseTierOverride('')).toBeNull();
    expect(performanceTierFor({ touch: true, override: 'full' })).toBe('full');
  });
  it('lite never removes an effect entirely, it only thins it out', () => {
    const full = profileFor('full'), lite = profileFor('lite');
    for (const key of ['glints', 'ripples', 'streaks', 'fireflies'] as const) {
      expect(lite[key]).toBeGreaterThan(0);
      expect(lite[key]).toBeLessThan(full[key]);
    }
    expect(lite.foamStep).toBeGreaterThan(full.foamStep);
  });
  it('the living-world extras are thinned on lite too, but every creature still appears', () => {
    const full = profileFor('full'), lite = profileFor('lite');
    for (const key of ['leaves', 'butterflies', 'nightFireflies'] as const) {
      expect(lite[key]).toBeGreaterThan(0);
      expect(lite[key]).toBeLessThan(full[key]);
    }
    expect(lite.fishGap[0]).toBeGreaterThan(full.fishGap[0]);
    expect(lite.birdGap[0]).toBeGreaterThan(full.birdGap[0]);
    for (const profile of [full, lite]) {
      expect(profile.fishGap[0]).toBeLessThan(profile.fishGap[1]);
      expect(profile.birdGap[0]).toBeLessThan(profile.birdGap[1]);
    }
  });
});
