/**
 * Pure logic for the Adventurer hero sprite: which of the 8 facings to show, which walk frame to show and
 * which resolution of the sprite atlas to draw. No Phaser here so all of it is unit-tested.
 */
export const FACINGS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'] as const;
export type Facing8 = typeof FACINGS[number];

/** Number of frames in each direction's walk cycle (the pack has `walk_<dir>_01` .. `_07`). */
export const WALK_FRAME_COUNT = 7;
/** On-screen distance, in px of world space, covered by one full walk cycle (two steps). */
export const WALK_STRIDE_PX = 72;
/** How far past a sector edge (degrees) the stick must swing before the facing changes. Stops flicker on slides. */
export const FACING_HYSTERESIS_DEG = 9;

const SECTOR = 45;

/** Angle of a screen vector in degrees, 0 = east, 90 = south (screen y points down), range [0, 360). */
export function screenAngle(x: number, y: number): number {
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Facing for a screen-space movement vector. A zero vector keeps `previous`. With a `previous` facing the new
 * one is only taken once the vector leaves that facing's 45 degree sector by `FACING_HYSTERESIS_DEG`.
 */
export function facingFor(x: number, y: number, previous?: Facing8): Facing8 {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return previous ?? 'south';
  const angle = screenAngle(x, y);
  if (previous) {
    const centre = FACINGS.indexOf(previous) * SECTOR;
    if (angularDistance(angle, centre) <= SECTOR / 2 + FACING_HYSTERESIS_DEG) return previous;
  }
  return FACINGS[Math.round(angle / SECTOR) % FACINGS.length];
}

/** Walk-cycle position (0..1, wraps) after covering `distancePx` on screen. Frames follow the ground, so feet do not skate. */
export function advanceWalkPhase(phase: number, distancePx: number): number {
  if (!Number.isFinite(distancePx) || distancePx <= 0) return phase;
  const next = (phase + distancePx / WALK_STRIDE_PX) % 1;
  return next < 0 ? next + 1 : next;
}

export function walkFrameName(facing: Facing8, phase: number): string {
  const index = Math.min(WALK_FRAME_COUNT - 1, Math.floor((((phase % 1) + 1) % 1) * WALK_FRAME_COUNT));
  return `walk_${facing}_${String(index + 1).padStart(2, '0')}`;
}

export const idleFrameName = (facing: Facing8) => `idle_${facing}`;

/** Every frame name the atlas must contain. */
export function allFrameNames(): string[] {
  return FACINGS.flatMap((f) => [idleFrameName(f), ...Array.from({ length: WALK_FRAME_COUNT }, (_, i) => `walk_${f}_${String(i + 1).padStart(2, '0')}`)]);
}

/** Native size of an atlas frame, and the on-screen size the hero is drawn at relative to the world. */
export const HERO_FRAME = 204;
export const HERO_SCALE = 0.33;
/** Foot position inside a frame as a fraction of its size (idle feet sit at y = 176 of 204, x is centred). */
export const HERO_ORIGIN = { x: 0.5, y: 176 / 204 } as const;
/** The half-size atlas is used while the sprite is drawn at 0.5x its native pixels or smaller on the device. */
export const LOW_LOD_MAX_DEVICE_SCALE = 0.5;

export type HeroLod = 'hi' | 'lo';
/** `worldZoom` is the camera zoom in device pixels per world pixel (it already includes the render scale). */
export function pickHeroLod(worldZoom: number): HeroLod {
  const deviceScale = HERO_SCALE * (Number.isFinite(worldZoom) && worldZoom > 0 ? worldZoom : 1);
  return deviceScale <= LOW_LOD_MAX_DEVICE_SCALE ? 'lo' : 'hi';
}
