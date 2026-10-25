import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOLLOW_AT_60HZ, clampDelta, followLerp, groundVelocity, MAX_FRAME_DELTA_MS, normalizeDirection,
  screenSpeed, slideVelocity, WALK_SPEED, walkAnimationScale,
} from './movement';
import { worldVelocityToScreen } from './isometric';

/** Simulates holding a direction for `seconds` at a fixed frame rate, the way the scene integrates it. */
function walkDistance(screenX: number, screenY: number, fps: number, seconds = 2, jitter = (_frame: number) => 0) {
  const v = groundVelocity(screenX, screenY);
  let x = 0, y = 0, elapsed = 0, frame = 0;
  while (elapsed < seconds * 1000) {
    const delta = 1000 / fps + jitter(frame++);
    elapsed += delta;
    const dt = clampDelta(delta) / 1000;
    x += v.x * dt; y += v.y * dt;
  }
  return { x, y, elapsed, speed: Math.hypot(x, y) / (elapsed / 1000) };
}

describe('normalizeDirection', () => {
  it('returns zero for no input', () => expect(normalizeDirection(0, 0)).toEqual({ x: 0, y: 0 }));
  it('keeps straight input at unit length', () => expect(normalizeDirection(0, -1)).toEqual({ x: 0, y: -1 }));
  it('normalizes diagonal input', () => {
    const d = normalizeDirection(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(d.x).toBeCloseTo(Math.SQRT1_2);
    expect(d.y).toBeCloseTo(Math.SQRT1_2);
  });
  it('normalizes huge and tiny inputs alike', () => {
    expect(Math.hypot(...Object.values(normalizeDirection(900, 900)))).toBeCloseTo(1);
    expect(Math.hypot(...Object.values(normalizeDirection(1e-9, 1e-9)))).toBeCloseTo(1);
  });
});

describe('clampDelta', () => {
  it('passes normal frame times through', () => expect(clampDelta(16.7)).toBe(16.7));
  it('caps long hitches and background-tab resumes', () => {
    expect(clampDelta(1000)).toBe(MAX_FRAME_DELTA_MS);
    expect(clampDelta(60_000)).toBe(MAX_FRAME_DELTA_MS);
  });
  it('turns invalid values into zero', () => {
    for (const bad of [-5, 0, Number.NaN, Infinity, -Infinity]) expect(clampDelta(bad)).toBe(0);
  });
});

describe('groundVelocity', () => {
  it('is zero without input', () => expect(groundVelocity(0, 0)).toEqual({ x: 0, y: 0 }));
  it('has the same ground speed in every direction (no diagonal or axis bias)', () => {
    for (let angle = 0; angle < 360; angle += 5) {
      const a = (angle * Math.PI) / 180;
      const v = groundVelocity(Math.cos(a), Math.sin(a));
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(WALK_SPEED, 6);
    }
  });
  it('ignores input magnitude, so keyboard, stick and over-driven input match', () => {
    const slow = groundVelocity(0.3, 0), fast = groundVelocity(40, 0), key = groundVelocity(1, 0);
    expect(slow.x).toBeCloseTo(key.x); expect(fast.y).toBeCloseTo(key.y);
    const diagonalKeys = groundVelocity(1, 1), diagonalStick = groundVelocity(Math.SQRT1_2, Math.SQRT1_2);
    expect(diagonalKeys.x).toBeCloseTo(diagonalStick.x);
  });
  it('maps screen directions onto the isometric ground plane', () => {
    // Right on screen is +x/-y on the ground, down on screen is +x/+y.
    const right = groundVelocity(1, 0), down = groundVelocity(0, 1);
    expect(right.x).toBeGreaterThan(0); expect(right.y).toBeLessThan(0);
    expect(down.x).toBeGreaterThan(0); expect(down.y).toBeGreaterThan(0);
  });
  it('gives the intended walking pace on screen', () => {
    const sideways = screenSpeed(groundVelocity(1, 0).x, groundVelocity(1, 0).y);
    const vertical = screenSpeed(groundVelocity(0, 1).x, groundVelocity(0, 1).y);
    expect(sideways).toBeGreaterThan(100); expect(sideways).toBeLessThan(140);
    // True isometric foreshortening: ground speed is constant, so vertical screen speed is half.
    expect(vertical / sideways).toBeCloseTo(0.5, 2);
  });
  it('is far slower than the old 185 px/s on-screen speed', () => {
    const v = groundVelocity(1, 0);
    expect(screenSpeed(v.x, v.y)).toBeLessThan(185 * 0.75);
  });
});

describe('frame-rate independence', () => {
  const rates = [20, 30, 45, 60, 75, 90, 120, 144, 240];
  it('covers the same ground in the same time at any refresh rate', () => {
    const reference = walkDistance(1, 0, 60).speed;
    expect(reference).toBeCloseTo(WALK_SPEED, 3);
    for (const fps of rates) expect(walkDistance(1, 0, fps).speed).toBeCloseTo(reference, 3);
  });
  it('is not faster on high-refresh displays', () => {
    expect(walkDistance(1, 1, 144).speed / walkDistance(1, 1, 60).speed).toBeCloseTo(1, 3);
    expect(walkDistance(1, 1, 240).speed / walkDistance(1, 1, 60).speed).toBeCloseTo(1, 3);
  });
  it('stays accurate with uneven frame times', () => {
    const uneven = walkDistance(1, 0, 60, 2, (frame) => (frame % 2 === 0 ? 6 : -6));
    expect(uneven.speed / WALK_SPEED).toBeCloseTo(1, 2);
  });
  it('cannot teleport after a long pause', () => {
    const v = groundVelocity(1, 0);
    const dt = clampDelta(30_000) / 1000;
    expect(Math.hypot(v.x * dt, v.y * dt)).toBeLessThanOrEqual(WALK_SPEED * (MAX_FRAME_DELTA_MS / 1000) + 1e-9);
  });
});

describe('slideVelocity', () => {
  const wallAtX = (limit: number) => (dx: number) => dx < limit;
  it('moves freely when the way is clear', () => expect(slideVelocity(100, 50, 0.016, () => true)).toEqual({ x: 100, y: 50 }));
  it('stops when nothing fits', () => expect(slideVelocity(100, 50, 0.016, () => false)).toEqual({ x: 0, y: 0 }));
  it('slides along a wall instead of sticking', () => {
    const fits = (dx: number, _dy: number) => dx <= 0; // blocked whenever moving +x
    expect(slideVelocity(100, 80, 0.016, fits)).toEqual({ x: 0, y: 80 });
  });
  it('slides on the other axis too', () => {
    const fits = (_dx: number, dy: number) => dy <= 0;
    expect(slideVelocity(100, 80, 0.016, fits)).toEqual({ x: 100, y: 0 });
  });
  it('does nothing without input', () => expect(slideVelocity(0, 0, 0.016, wallAtX(1))).toEqual({ x: 0, y: 0 }));
});

describe('followLerp', () => {
  it('equals the tuned value at 60 fps', () => expect(followLerp(1000 / 60)).toBeCloseTo(CAMERA_FOLLOW_AT_60HZ, 6));
  it('converges at the same real-time rate at any frame rate', () => {
    const converge = (fps: number) => {
      let remaining = 1;
      for (let frame = 0; frame < Math.round(fps / 2); frame++) remaining *= 1 - followLerp(1000 / fps);
      return remaining;
    };
    for (const fps of [30, 60, 120, 144]) expect(converge(fps)).toBeCloseTo(converge(60), 2);
  });
  it('never exceeds 1 and ignores hitches beyond the clamp', () => {
    expect(followLerp(60_000)).toBeLessThan(1);
    expect(followLerp(60_000)).toBeCloseTo(followLerp(MAX_FRAME_DELTA_MS));
    expect(followLerp(0)).toBe(0);
    expect(followLerp(Number.NaN)).toBe(0);
  });
});

describe('walkAnimationScale', () => {
  it('plays the cycle at normal speed at the reference pace', () => expect(walkAnimationScale(120)).toBeCloseTo(1));
  it('slows the feet when the hero moves slowly on screen', () => expect(walkAnimationScale(60)).toBeLessThan(1));
  it('stays within sane bounds', () => {
    expect(walkAnimationScale(5)).toBe(0.6);
    expect(walkAnimationScale(5000)).toBe(1.15);
    expect(walkAnimationScale(0)).toBe(1);
    expect(walkAnimationScale(Number.NaN)).toBe(1);
  });
  it('matches projection maths', () => {
    const v = groundVelocity(0, 1);
    expect(screenSpeed(v.x, v.y)).toBeCloseTo(Math.hypot(worldVelocityToScreen(v.x, v.y).x, worldVelocityToScreen(v.x, v.y).y));
  });
});
