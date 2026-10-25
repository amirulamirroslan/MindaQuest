import { describe, expect, it } from 'vitest';
import { RUN_SPEED_3D, WALK_SPEED_3D, approach, cameraPreset, cameraRelativeVelocity, clampDeltaSeconds, followCameraOffset, MIN_CAMERA_RATIO, blockedCameraPitch, smoothingFactor, speedForInput, turnToward, walkAnimationRate, wrapAngle } from './movement3d';

describe('movement3d', () => {
  it('forward input moves away from the camera at every camera yaw', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, -2]) {
      const v = cameraRelativeVelocity(0, 1, yaw, 4);
      const cam = followCameraOffset(yaw, 0.4, 7); // camera position relative to hero
      expect(v.x * cam.x + v.z * cam.z).toBeLessThan(0); // velocity points away from the camera
      expect(Math.hypot(v.x, v.z)).toBeCloseTo(4);
    }
  });
  it('diagonals are not faster and half-pushed sticks are slower', () => {
    expect(Math.hypot(...Object.values(cameraRelativeVelocity(1, 1, 0.3, 3)))).toBeCloseTo(3);
    expect(Math.hypot(...Object.values(cameraRelativeVelocity(0, 0.5, 0, 3)))).toBeCloseTo(1.5);
    expect(cameraRelativeVelocity(0, 0, 1, 3)).toEqual({ x: 0, z: 0 });
  });
  it('right input moves to the camera right', () => {
    const v = cameraRelativeVelocity(1, 0, 0, 2);
    expect(v.x).toBeCloseTo(2); expect(v.z).toBeCloseTo(0);
  });
  it('clamps bad and huge frame times', () => {
    expect(clampDeltaSeconds(NaN)).toBe(0); expect(clampDeltaSeconds(-1)).toBe(0); expect(clampDeltaSeconds(5)).toBe(0.05); expect(clampDeltaSeconds(0.016)).toBe(0.016);
  });
  it('smoothing reaches the same place at 30, 60 and 144 fps', () => {
    for (const fps of [30, 60, 144]) {
      let x = 0; const dt = 1 / fps;
      for (let i = 0; i < fps; i++) x += (1 - x) * smoothingFactor(8, dt);
      expect(x).toBeCloseTo(1 - Math.exp(-8), 5);
    }
  });
  it('walk vs run and animation rate', () => {
    expect(speedForInput(0)).toBe(0); expect(speedForInput(0.5)).toBe(WALK_SPEED_3D); expect(speedForInput(1)).toBe(RUN_SPEED_3D); expect(speedForInput(0.5, true)).toBe(RUN_SPEED_3D);
    expect(walkAnimationRate(WALK_SPEED_3D, WALK_SPEED_3D)).toBe(1); expect(walkAnimationRate(100, 1)).toBe(1.8); expect(walkAnimationRate(0, 1)).toBe(0.4);
  });
  it('turns the short way and never overshoots', () => {
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(wrapAngle(3.1)); // crosses +-PI rather than swinging back through 0
    expect(turnToward(0, 0.05, 0.1)).toBeCloseTo(0.05);
    expect(approach(0, 1, 0.3)).toBeCloseTo(0.3); expect(approach(1, 0, 5)).toBe(0);
  });
  it('camera is pulled in when blocked but never closer than the minimum', () => {
    expect(followCameraOffset(0, 0.5, 7, 3).distance).toBe(3);
    expect(followCameraOffset(0, 0.5, 7, 0.2).distance).toBe(1.6);
    expect(followCameraOffset(0, 0.5, 7, 50).distance).toBe(7);
    expect(cameraPreset('phone-portrait').distance).toBeGreaterThan(cameraPreset('desktop').distance);
  });
  it('a blocked camera stays well back and climbs instead of zooming in on the hero (v2.11)', () => {
    for (const l of ['phone-portrait', 'phone-landscape', 'tablet', 'desktop'] as const) {
      const c = cameraPreset(l);
      expect(c.distance * MIN_CAMERA_RATIO).toBeGreaterThan(4.5); // never the old 1.6 m floor
      expect(blockedCameraPitch(c.pitch, 1)).toBe(c.pitch);
      expect(blockedCameraPitch(c.pitch, MIN_CAMERA_RATIO)).toBeGreaterThan(c.pitch);
      expect(blockedCameraPitch(c.pitch, 0)).toBeLessThanOrEqual(1.35);
    }
  });
});
