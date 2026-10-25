import { screenDirectionToWorld, worldVelocityToScreen } from './isometric';

export interface Direction { x: number; y: number }

/**
 * Walking speed along the ground, in world units per second. Keyboard and touch both use it.
 *
 * The world is a 2:1 isometric projection, so one ground unit is 0.707 px wide but only 0.354 px tall on
 * screen. At 170 u/s the hero covers ~120 screen px/s sideways (about 2.6 hero heights per second, a brisk
 * walk), ~60 px/s straight up or down the screen and ~95 px/s along the tile axes. Tune only this constant.
 */
export const WALK_SPEED = 170;
/** Largest time slice any movement or camera maths will accept, in ms (20 fps). */
export const MAX_FRAME_DELTA_MS = 50;
/** On-screen speed the 4-frame walk cycle was drawn for; animation speed is scaled relative to it. */
export const WALK_ANIMATION_REFERENCE_SPEED = 120;
/** Camera follow smoothing expressed as the per-frame lerp it has at 60 fps. */
export const CAMERA_FOLLOW_AT_60HZ = 0.085;

/** Normalizes input so diagonal movement is not faster than straight movement. */
export function normalizeDirection(x: number, y: number): Direction {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

/**
 * Bounds a frame time. Background tabs, a suspended phone or a long GC pause can report seconds in one
 * frame; using that directly would teleport the hero or slam the camera. Bad values become 0.
 */
export function clampDelta(deltaMs: number, maxMs = MAX_FRAME_DELTA_MS): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs, maxMs);
}

/**
 * Ground velocity for a screen-space input. The input is normalized on screen (so diagonals are not
 * faster), converted to the ground plane, then normalized again so every direction has exactly `speed`
 * ground speed. Without the second step the conversion stretched some directions by up to 2.8x.
 */
export function groundVelocity(screenX: number, screenY: number, speed = WALK_SPEED): Direction {
  const input = normalizeDirection(screenX, screenY);
  const world = screenDirectionToWorld(input.x, input.y);
  const unit = normalizeDirection(world.x, world.y);
  return { x: unit.x * speed, y: unit.y * speed };
}

/**
 * Keeps whichever axes still fit. `fits(dx, dy)` answers whether the hero could stand after moving by
 * that offset, so a hero pushing diagonally into a riverbank slides along it instead of sticking.
 */
export function slideVelocity(vx: number, vy: number, lookaheadSeconds: number, fits: (dx: number, dy: number) => boolean): Direction {
  if (vx === 0 && vy === 0) return { x: 0, y: 0 };
  const dx = vx * lookaheadSeconds, dy = vy * lookaheadSeconds;
  if (fits(dx, dy)) return { x: vx, y: vy };
  if (vx !== 0 && fits(dx, 0)) return { x: vx, y: 0 };
  if (vy !== 0 && fits(0, dy)) return { x: 0, y: vy };
  return { x: 0, y: 0 };
}

/** Camera follow factor that behaves the same at any frame rate (equals `base` at 60 fps). */
export function followLerp(deltaMs: number, base = CAMERA_FOLLOW_AT_60HZ): number {
  const dt = clampDelta(deltaMs);
  if (dt === 0) return 0;
  return 1 - Math.pow(1 - base, dt / (1000 / 60));
}

/** On-screen speed (px/s) of a ground velocity. */
export function screenSpeed(vx: number, vy: number): number {
  const v = worldVelocityToScreen(vx, vy);
  return Math.hypot(v.x, v.y);
}

/** Walk-cycle playback rate so the feet keep up with the ground: slower when the hero moves slower on screen. */
export function walkAnimationScale(speedPxPerSecond: number): number {
  if (!Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0) return 1;
  return Math.min(1.15, Math.max(0.6, speedPxPerSecond / WALK_ANIMATION_REFERENCE_SPEED));
}
