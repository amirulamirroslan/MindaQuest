export interface StickVector { x: number; y: number }

/**
 * Converts a thumb offset (pixels from the stick centre) into a unit movement direction.
 * Inside the dead zone the stick reports no movement, so a resting thumb never drifts the hero.
 */
export function stickVector(dx: number, dy: number, radius: number, deadZone = 0.25): StickVector {
  const length = Math.hypot(dx, dy);
  if (radius <= 0 || length === 0 || length / radius < deadZone) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

/** Clamps the visual thumb so it stays inside the stick base. */
export function clampThumb(dx: number, dy: number, radius: number): StickVector {
  const length = Math.hypot(dx, dy);
  if (length <= radius || length === 0) return { x: dx, y: dy };
  return { x: (dx / length) * radius, y: (dy / length) * radius };
}
