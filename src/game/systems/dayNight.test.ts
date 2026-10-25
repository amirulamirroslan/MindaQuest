import { describe, expect, it } from 'vitest';
import { DAY_CYCLE_SECONDS, MIN_TINT_CHANNEL, parseTimeOfDay, timeOfDayAt, wrapPhase } from './dayNight';

const channels = (tint: number) => [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];

describe('day-night cycle', () => {
  it('opens in plain daylight: no tint, full daylight, so the game looks exactly as it did before', () => {
    const start = timeOfDayAt(0);
    expect(start.tint).toBe(0xffffff);
    expect(start.daylight).toBe(1);
    expect(start.night).toBe(0);
    expect(start.name).toBe('day');
  });
  it('is properly dark but still readable at night', () => {
    const night = timeOfDayAt(0.8);
    expect(night.name).toBe('night');
    expect(night.daylight).toBe(0);
    expect(night.night).toBe(1);
    expect(Math.min(...channels(night.tint))).toBeGreaterThanOrEqual(MIN_TINT_CHANNEL);
  });
  it('goes golden, then dusk, then night, then dawn, in order', () => {
    const names = [0.2, 0.5, 0.6, 0.8, 0.94].map((p) => timeOfDayAt(p).name);
    expect(names).toEqual(['day', 'golden', 'dusk', 'night', 'dawn']);
  });
  it('wraps around: the end of one day is the start of the next', () => {
    expect(timeOfDayAt(1).tint).toBe(timeOfDayAt(0).tint);
    expect(timeOfDayAt(1.25).tint).toBe(timeOfDayAt(0.25).tint);
    expect(wrapPhase(-0.25)).toBeCloseTo(0.75);
  });
  it('never jumps: neighbouring moments differ by only a few colour levels, so there is no visible flicker or pop', () => {
    let previous = timeOfDayAt(0);
    for (let i = 1; i <= 3000; i++) {
      const next = timeOfDayAt(i / 3000);
      const a = channels(previous.tint), b = channels(next.tint);
      for (let c = 0; c < 3; c++) expect(Math.abs(a[c] - b[c])).toBeLessThanOrEqual(3);
      expect(Math.abs(next.daylight - previous.daylight)).toBeLessThan(0.02);
      previous = next;
    }
  });
  it('keeps every channel and level in range', () => {
    for (let i = 0; i <= 400; i++) {
      const t = timeOfDayAt(i / 400);
      for (const c of channels(t.tint)) { expect(c).toBeGreaterThanOrEqual(MIN_TINT_CHANNEL); expect(c).toBeLessThanOrEqual(255); }
      expect(t.daylight).toBeGreaterThanOrEqual(0); expect(t.daylight).toBeLessThanOrEqual(1);
      expect(t.night).toBeGreaterThanOrEqual(0); expect(t.night).toBeLessThanOrEqual(1);
    }
  });
  it('a full day is long enough to be calm: several minutes', () => {
    expect(DAY_CYCLE_SECONDS).toBeGreaterThanOrEqual(240);
  });
  it('lets the URL set (and freeze) the time of day for repeatable screenshots', () => {
    expect(parseTimeOfDay('?tod=night')).toBe(0.8);
    expect(parseTimeOfDay('?debug&tod=0.5')).toBe(0.5);
    expect(parseTimeOfDay('?tod=1.25')).toBeCloseTo(0.25);
    expect(parseTimeOfDay('?tod=banana')).toBeNull();
    expect(parseTimeOfDay('?tod=')).toBeNull();
    expect(parseTimeOfDay('')).toBeNull();
  });
});
