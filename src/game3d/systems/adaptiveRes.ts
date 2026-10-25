/** Picks the renderer pixel ratio so slow phones stay smooth (pure, unit-tested). */
export const MIN_PIXEL_RATIO = 0.75;
export const PIXEL_RATIO_STEP = 0.25;

/** Initial ratio: the device ratio capped at 2 (phones) unless `override` is given. */
export function initialPixelRatio(devicePixelRatio: number | undefined, override?: number | null): number {
  if (override && Number.isFinite(override) && override > 0) return Math.min(3, Math.max(MIN_PIXEL_RATIO, override));
  const d = devicePixelRatio && Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(2, d);
}

/** Next ratio given the average fps over the last window. Only ever steps down (never back up) so a borderline phone cannot flip-flop. */
export function nextPixelRatio(current: number, avgFps: number): number {
  return avgFps < 40 ? Math.max(MIN_PIXEL_RATIO, current - PIXEL_RATIO_STEP) : current;
}
