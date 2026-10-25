/**
 * Camera maths for the 3D wardrobe (pure, unit-tested). The wardrobe does not use a second 3D view: it swings the normal
 * camera round to the front of the real hero, in the real woods, and slides the picture so the hero sits in the part of the
 * screen the panel is not covering.
 */
import { rayClearDistance, type ColliderGrid } from './colliders';

/** The direction with the most open space round the hero, as a camera yaw (the camera sits `distance` away along it). Keeps `preferred` when it is open. */
export function pickPreviewYaw(grid: ColliderGrid, x: number, z: number, preferred: number, distance: number, radius = 0.45): number {
  let best = preferred, bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    // 0, +22.5, -22.5, +45 ... so the first good direction closest to `preferred` wins ties
    const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    const yaw = preferred + k * (Math.PI / 8);
    const clear = rayClearDistance(grid, x, z, Math.sin(yaw), Math.cos(yaw), distance, radius);
    const score = Math.min(clear, distance) - Math.abs(k) * 0.02;
    if (score > bestScore + 1e-9) { bestScore = score; best = yaw; }
    if (clear >= distance && k === 0) break;
  }
  return best;
}

/** How far back the camera sits so a hero `heroHeight` tall fills about `fill` of the free part of the screen (vertical field of view in degrees). */
export function previewDistance(fovDeg: number, freeFraction: number, heroHeight = 1.5, fill = 0.62): number {
  const half = Math.tan((fovDeg * Math.PI) / 360);
  const d = heroHeight / (2 * half * Math.max(0.25, Math.min(1, freeFraction)) * fill);
  return Math.min(4.6, Math.max(2.0, d));
}

export interface Box { x: number; y: number; w: number; h: number }
/**
 * Offset (pixels) to slide the picture by so the hero is centred in the screen area the panel leaves free.
 * The panel is either a side panel (touches the left or right edge) or a bottom panel (spans the width).
 * Positive `x` moves the picture to the LEFT (use with camera.setViewOffset), positive `y` moves it UP.
 */
export function previewShift(screen: { w: number; h: number }, panel: Box): { x: number; y: number } {
  const bottom = panel.w >= screen.w * 0.8;
  if (bottom) return { x: 0, y: Math.max(0, screen.h - panel.y) / 2 };
  const onRight = panel.x + panel.w / 2 > screen.w / 2;
  const covered = onRight ? Math.max(0, screen.w - panel.x) : Math.max(0, panel.x + panel.w);
  return { x: (onRight ? 1 : -1) * covered / 2, y: 0 };
}

/** Where a pose-preview animation is, for the wardrobe's "Stand / Walk / Slash / Spin" buttons. All loop. */
export type PreviewPose = 'stand' | 'walk' | 'slash' | 'spin';
export const PREVIEW_POSES: readonly PreviewPose[] = ['stand', 'walk', 'slash', 'spin'];
export function previewPoseInput(pose: PreviewPose, t: number): { speed: number; attack: number | null; special: number | null } {
  switch (pose) {
    case 'walk': return { speed: 3.4, attack: null, special: null };
    case 'slash': return { speed: 0, attack: (t % 1.25) / 1.25, special: null };
    case 'spin': return { speed: 0, attack: null, special: (t % 1.6) / 1.6 };
    default: return { speed: 0, attack: null, special: null };
  }
}
