import { describe, expect, it } from 'vitest';
import { SETTINGS, initialQuality, nextQuality, outlineWanted } from './quality';

const desktop = { touch: false, cores: 8, memoryGb: 8, devicePixelRatio: 1, width: 1920, height: 1080 };
describe('quality tiers', () => {
  it('desktop starts high, a weak desktop medium', () => {
    expect(initialQuality(desktop)).toBe('high');
    expect(initialQuality({ ...desktop, cores: 2 })).toBe('medium');
  });
  it('phones start lower and a big dense screen goes lowest', () => {
    expect(initialQuality({ touch: true, cores: 8, memoryGb: 6, devicePixelRatio: 2, width: 390, height: 844 })).toBe('medium');
    expect(initialQuality({ touch: true, cores: 4, devicePixelRatio: 2, width: 390, height: 844 })).toBe('low');
    expect(initialQuality({ touch: true, cores: 8, memoryGb: 8, devicePixelRatio: 2, width: 1024, height: 1366 })).toBe('low');
  });
  it('the URL override wins and junk is ignored', () => {
    expect(initialQuality(desktop, 'low')).toBe('low');
    expect(initialQuality(desktop, 'ultra')).toBe('high');
  });
  it('steps down only when slow and never up', () => {
    expect(nextQuality('high', 60)).toBe('high');
    expect(nextQuality('high', 20)).toBe('medium');
    expect(nextQuality('medium', 20)).toBe('low');
    expect(nextQuality('low', 5)).toBe('low');
  });
  it('lower tiers cost less', () => {
    expect(SETTINGS.low.shadowMap).toBeLessThan(SETTINGS.medium.shadowMap); expect(SETTINGS.low.shadowMap).toBeGreaterThan(0);
    expect(SETTINGS.high.grass).toBeGreaterThan(SETTINGS.medium.grass);
    expect(SETTINGS.medium.detailRadius).toBeGreaterThan(SETTINGS.low.detailRadius);
  });
  it('the hero outline is on in every tier (so phones look the same as desktop), and the URL can still force it either way', () => {
    expect(outlineWanted('high')).toBe(true); expect(outlineWanted('medium')).toBe(true); expect(outlineWanted('low')).toBe(true);
    expect(outlineWanted('low', '0')).toBe(false); expect(outlineWanted('low', '1')).toBe(true); expect(outlineWanted('high', '0')).toBe(false); expect(outlineWanted('high', 'junk')).toBe(true);
  });
});
