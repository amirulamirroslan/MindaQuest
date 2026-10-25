/**
 * Third-person movement maths for the 3D game (pure: no Three.js, no DOM). Units are metres and seconds.
 * Replaces the 2D isometric screen-to-ground conversion in `systems/isometric.ts`, which does not apply in 3D.
 */
export interface Vec2 { x: number; z: number }

/** Ground speeds in m/s. The hero is ~1.2 m tall, so walking is about 3 body-heights per second. Tune only these. */
export const WALK_SPEED_3D = 3.6;
export const RUN_SPEED_3D = 5.8;
export const MAX_FRAME_SECONDS = 0.05;
/** Stick deflection above which a touch stick or analogue input counts as a run. */
export const RUN_THRESHOLD = 0.85;

/** Bounds a frame time (seconds). Background tabs and GC pauses must not teleport the hero or slam the camera. */
export function clampDeltaSeconds(dt: number, max = MAX_FRAME_SECONDS): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(dt, max);
}

/**
 * Ground velocity from a 2D input (x = right, y = forward, each -1..1) relative to the camera heading.
 * `cameraYaw` is the camera's rotation about the Y axis in radians; at yaw 0 the camera looks along -Z.
 * Magnitude is input length (capped at 1) so a half-pushed stick walks slower; diagonals are never faster.
 */
export function cameraRelativeVelocity(inputX: number, inputY: number, cameraYaw: number, speed: number): Vec2 {
  const len = Math.hypot(inputX, inputY);
  if (len < 1e-6) return { x: 0, z: 0 };
  const scale = Math.min(len, 1) / len;
  const ix = inputX * scale;
  const iy = inputY * scale;
  const s = Math.sin(cameraYaw);
  const c = Math.cos(cameraYaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  return { x: (c * ix - s * iy) * speed, z: (-s * ix - c * iy) * speed };
}

/** Speed for an input magnitude: walk for gentle input, run when pushed (or Shift held on keyboard). */
export function speedForInput(magnitude: number, forceRun = false): number {
  if (magnitude <= 1e-6) return 0;
  return forceRun || magnitude >= RUN_THRESHOLD ? RUN_SPEED_3D : WALK_SPEED_3D;
}

/** Frame-rate-independent exponential smoothing factor: the same on-screen feel at 30, 60 or 144 fps. */
export function smoothingFactor(ratePerSecond: number, dt: number): number {
  return 1 - Math.exp(-Math.max(0, ratePerSecond) * Math.max(0, dt));
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = (a + Math.PI) % twoPi;
  if (r < 0) r += twoPi;
  return r - Math.PI;
}

/** Turns `angle` toward `target` along the shortest way, at most `maxStep` radians. */
export function turnToward(angle: number, target: number, maxStep: number): number {
  const diff = wrapAngle(target - angle);
  if (Math.abs(diff) <= maxStep) return wrapAngle(target);
  return wrapAngle(angle + Math.sign(diff) * maxStep);
}

/** Heading (rotation about Y, 0 = facing +Z) for a ground direction. */
export const headingOf = (dx: number, dz: number): number => Math.atan2(dx, dz);

/** Walk-cycle playback rate so feet do not slide: proportional to ground speed against the speed the clip was authored for. */
export function walkAnimationRate(groundSpeed: number, authoredSpeed: number): number {
  if (authoredSpeed <= 0) return 1;
  return Math.min(Math.max(groundSpeed / authoredSpeed, 0.4), 1.8);
}

/**
 * Follow camera placement. The camera sits `distance` behind the target along `yaw`, raised by `pitch`,
 * and looks at a point slightly above the hero's feet. `blocked` is the clear distance found by a ray from the
 * target toward the camera; the camera is pulled in to it (never closer than `minDistance`) so it does not clip walls or trees.
 */
export function followCameraOffset(yaw: number, pitch: number, distance: number, blocked?: number, minDistance = 1.6) {
  const d = blocked === undefined ? distance : Math.max(minDistance, Math.min(distance, blocked));
  const horizontal = Math.cos(pitch) * d;
  return { x: Math.sin(yaw) * horizontal, y: Math.sin(pitch) * d, z: Math.cos(yaw) * horizontal, distance: d };
}

/**
 * Pitch/distance preset per layout. v2.9 brings the camera in about 22 % so the hero fills more of the picture (about 150 px tall on
 * a 720 p desktop, was about 115) while the village, the trail and the enemies stay in view. Phones sit a little further back and
 * higher so the hero is not hidden by thumbs.
 */
export function cameraPreset(layout: 'phone-portrait' | 'phone-landscape' | 'tablet' | 'desktop') {
  switch (layout) {
    // In portrait the screen is narrow, so the camera sits higher with a wider field of view: about 4.8 m of ground across the screen
    // (v2.4 showed 6 m; an earlier 3.5 m made walking look far too fast).
    // v2.11: every layout sits further back (phones most) so the hero is not crowding the screen under the HUD and thumbs.
    case 'phone-portrait': return { distance: 11.2, pitch: 1.0, fov: 60 };
    case 'phone-landscape': return { distance: 7.6, pitch: 0.92, fov: 48 };
    case 'tablet': return { distance: 7.3, pitch: 0.88, fov: 48 };
    default: return { distance: 6.9, pitch: 0.82, fov: 46 };
  }
}

/**
 * v2.11: how close the camera may be pulled in when a bush, tree or wall is behind the hero, as a share of the layout's distance.
 * Before, the floor was a flat 1.6 m, so standing with your back to a bush put the camera almost on the hero's head.
 */
export const MIN_CAMERA_RATIO = 0.7;

/** When the camera is pulled in (ratio < 1) it also climbs, so it looks down over the obstacle instead of zooming into the hero. */
export function blockedCameraPitch(pitch: number, ratio: number, maxPitch = 1.35): number {
  const r = Math.min(1, Math.max(0, ratio));
  return Math.min(maxPitch, pitch + (1 - r) * 1.3);
}
