import { describe, expect, it } from 'vitest';
import { advanceWalkPhase, allFrameNames, FACINGS, facingFor, HERO_SCALE, idleFrameName, pickHeroLod, WALK_STRIDE_PX, walkFrameName } from './heroFacing';

describe('facingFor', () => {
  it('maps the 8 screen directions to the 8 facings', () => {
    const cases: Array<[number, number, string]> = [[1, 0, 'east'], [1, 1, 'south-east'], [0, 1, 'south'], [-1, 1, 'south-west'], [-1, 0, 'west'], [-1, -1, 'north-west'], [0, -1, 'north'], [1, -1, 'north-east']];
    for (const [x, y, want] of cases) expect(facingFor(x, y)).toBe(want);
  });
  it('keeps the previous facing when not moving', () => {
    expect(facingFor(0, 0, 'west')).toBe('west');
    expect(facingFor(0, 0)).toBe('south');
  });
  it('ignores non-finite input', () => {
    expect(facingFor(Number.NaN, 1, 'north')).toBe('north');
  });
  it('does not flicker near a sector boundary but does turn once clearly past it', () => {
    // 22.5 degrees is the south-east / east boundary; 27 degrees is inside the hysteresis band.
    const near = (deg: number) => facingFor(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 'east');
    expect(near(27)).toBe('east');
    expect(near(40)).toBe('south-east');
    expect(facingFor(Math.cos(0.4), Math.sin(0.4), 'south-east')).toBe('south-east');
  });
  it('returns every facing for a full sweep', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 360; d += 5) seen.add(facingFor(Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)));
    expect(seen.size).toBe(FACINGS.length);
  });
});

describe('walk phase and frames', () => {
  it('advances by distance, wraps, and ignores bad distances', () => {
    expect(advanceWalkPhase(0, WALK_STRIDE_PX / 2)).toBeCloseTo(0.5);
    expect(advanceWalkPhase(0.75, WALK_STRIDE_PX / 2)).toBeCloseTo(0.25);
    expect(advanceWalkPhase(0.3, 0)).toBe(0.3);
    expect(advanceWalkPhase(0.3, Number.NaN)).toBe(0.3);
    expect(advanceWalkPhase(0.3, -5)).toBe(0.3);
  });
  it('picks all 7 walk frames over one cycle and never leaves the range', () => {
    const frames = new Set<string>();
    for (let p = 0; p < 1; p += 0.01) frames.add(walkFrameName('south', p));
    expect([...frames].sort()).toEqual(Array.from({ length: 7 }, (_, i) => `walk_south_0${i + 1}`));
    expect(walkFrameName('east', 1)).toBe('walk_east_01');
    expect(walkFrameName('east', -0.01)).toBe('walk_east_07');
  });
  it('lists exactly the 64 frames the pack ships', () => {
    const names = allFrameNames();
    expect(names).toHaveLength(64);
    expect(new Set(names).size).toBe(64);
    expect(names).toContain(idleFrameName('north-west'));
  });
});

describe('pickHeroLod', () => {
  it('uses the small atlas on a 1x desktop and the full one on a high-density phone', () => {
    expect(pickHeroLod(1.2)).toBe('lo');
    expect(pickHeroLod(2.3)).toBe('hi');
    expect(pickHeroLod(0.5 / HERO_SCALE)).toBe('lo');
    expect(pickHeroLod(Number.NaN)).toBe('lo');
  });
});
