import { describe, expect, it } from 'vitest';
import { ColliderGrid } from './colliders';
import { PREVIEW_POSES, pickPreviewYaw, previewDistance, previewPoseInput, previewShift } from './wardrobeCam';

describe('wardrobe camera', () => {
  it('keeps the preferred direction when it is open', () => {
    expect(pickPreviewYaw(new ColliderGrid([]), 0, 0, 0.7, 3)).toBe(0.7);
  });
  it('turns away from a tree that would be in the way', () => {
    const grid = new ColliderGrid([{ x: 0, z: 2, r: 0.6 }]); // directly along yaw 0 (the camera sits at +z)
    const yaw = pickPreviewYaw(grid, 0, 0, 0, 3);
    expect(yaw).not.toBe(0); expect(Math.abs(yaw)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    expect(Math.hypot(Math.sin(yaw) * 3, Math.cos(yaw) * 3 - 2)).toBeGreaterThan(1.2); // the camera spot is clear of the tree
  });
  it('picks the roomiest direction when everything is crowded, without crashing', () => {
    const ring = Array.from({ length: 16 }, (_, i) => ({ x: Math.sin(i * Math.PI / 8) * 2, z: Math.cos(i * Math.PI / 8) * 2, r: 0.5 }));
    expect(Number.isFinite(pickPreviewYaw(new ColliderGrid(ring), 0, 0, 0, 3))).toBe(true);
  });
  it('stands further back on a short free area and never leaves its limits', () => {
    expect(previewDistance(50, 0.5)).toBeGreaterThan(previewDistance(50, 1));
    for (const f of [0, 0.1, 0.5, 1, 2]) for (const fov of [40, 55, 80]) { const d = previewDistance(fov, f); expect(d).toBeGreaterThanOrEqual(2); expect(d).toBeLessThanOrEqual(4.6); }
  });
  it('shifts the hero into the free area beside a side panel', () => {
    const right = previewShift({ w: 1000, h: 600 }, { x: 640, y: 0, w: 360, h: 600 });
    expect(right).toEqual({ x: 180, y: 0 }); // picture slides left by half the panel width
    const left = previewShift({ w: 1000, h: 600 }, { x: 0, y: 0, w: 300, h: 600 });
    expect(left).toEqual({ x: -150, y: 0 });
  });
  it('shifts the hero up above a bottom panel', () => {
    expect(previewShift({ w: 400, h: 800 }, { x: 0, y: 440, w: 400, h: 360 })).toEqual({ x: 0, y: 180 });
    expect(previewShift({ w: 400, h: 800 }, { x: 0, y: 800, w: 400, h: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('has a looping pose for each button', () => {
    expect(PREVIEW_POSES).toEqual(['stand', 'walk', 'slash', 'spin']);
    expect(previewPoseInput('stand', 3).speed).toBe(0); expect(previewPoseInput('walk', 3).speed).toBeGreaterThan(2);
    for (const t of [0, 0.4, 1.249, 1.25, 7.77]) { const a = previewPoseInput('slash', t).attack!, s = previewPoseInput('spin', t).special!; expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(1); expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThan(1); }
  });
});
