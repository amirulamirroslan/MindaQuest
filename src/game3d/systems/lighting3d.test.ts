import { describe, expect, it } from 'vitest';
import { DAY_CYCLE_SECONDS, ambientStrength, fireflyLevel, lampLevel, lerpHex, lookForPhase, phaseAt } from './lighting3d';

const phases = Array.from({ length: 301 }, (_, i) => i / 300);

describe('3D day-night look', () => {
  it('starts in warm daylight with a cool fill (v2.13 painterly pair)', () => {
    const l = lookForPhase(0);
    expect(l.hemiIntensity).toBe(1.18); expect(l.sunIntensity).toBe(2.15); expect(l.fog).toBe(0xe3ebc6); expect(l.fogNear).toBe(32); expect(l.fogFar).toBe(92);
    expect(l.hemiSky).toBe(0xeef0ff); expect(l.hemiGround).toBe(0x5f8a45); expect(l.sun).toBe(0xffdc98); expect(l.sunPos).toEqual([-42, 38, 24]); expect(l.exposure).toBe(1.1);
    expect(l.sky).toEqual([0x5aa3da, 0xb4dcee, 0xf4f0cc, 0xe2ecc0]);
  });
  it('wraps around: phase 1 is phase 0, and the day is five minutes', () => {
    expect(lookForPhase(1)).toEqual(lookForPhase(0)); expect(lookForPhase(1.25)).toEqual(lookForPhase(0.25)); expect(lookForPhase(-0.75)).toEqual(lookForPhase(0.25));
    expect(DAY_CYCLE_SECONDS).toBe(300); expect(phaseAt(0)).toBe(0); expect(phaseAt(150)).toBeCloseTo(0.5, 6); expect(phaseAt(300)).toBeCloseTo(0, 6); expect(phaseAt(60, 0.9)).toBeCloseTo(0.1, 6);
  });
  it('never gets too dark to play in', () => {
    for (const p of phases) { const l = lookForPhase(p); expect(ambientStrength(l), String(p)).toBeGreaterThanOrEqual(1.6); expect(l.hemiIntensity, String(p)).toBeGreaterThanOrEqual(0.8); expect(l.fogFar - l.fogNear).toBeGreaterThan(48); }
  });
  it('really is darker and bluer at night than by day', () => {
    const day = lookForPhase(0.2), night = lookForPhase(0.8);
    expect(ambientStrength(night)).toBeLessThan(ambientStrength(day) * 0.7);
    expect(night.fog & 255).toBeGreaterThan((night.fog >> 16) & 255); // blue beats red in the night fog
    expect(night.sunPos[2]).toBeLessThan(0); expect(day.sunPos[2]).toBeGreaterThan(0); // the moon is on the other side from the sun
  });
  it('changes smoothly: no jump between neighbouring moments', () => {
    const dist = (a: number, b: number) => Math.hypot(((a >> 16) & 255) - ((b >> 16) & 255), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255));
    for (let i = 1; i < phases.length; i++) {
      const a = lookForPhase(phases[i - 1]), b = lookForPhase(phases[i]);
      expect(Math.abs(a.hemiIntensity - b.hemiIntensity)).toBeLessThan(0.08); expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.12);
      expect(dist(a.fog, b.fog)).toBeLessThan(26); expect(dist(a.sky[0], b.sky[0])).toBeLessThan(26);
    }
  });
  it('lights the lamps at dusk and brings out fireflies only after dark', () => {
    expect(lampLevel(0.2)).toBe(0); expect(lampLevel(0.8)).toBeGreaterThan(0.95); expect(lampLevel(0.58)).toBeGreaterThan(0.2);
    expect(fireflyLevel(0.2)).toBe(0); expect(fireflyLevel(0.5)).toBe(0); expect(fireflyLevel(0.8)).toBeGreaterThan(0.95);
    for (const p of phases) { expect(lampLevel(p)).toBeGreaterThanOrEqual(0); expect(lampLevel(p)).toBeLessThanOrEqual(1); expect(fireflyLevel(p)).toBeLessThanOrEqual(1); }
  });
  it('mixes colours per channel', () => { expect(lerpHex(0x000000, 0xff8040, 0.5)).toBe(0x804020); expect(lerpHex(0x123456, 0x654321, 0)).toBe(0x123456); expect(lerpHex(0x123456, 0x654321, 1)).toBe(0x654321); });
});
