/**
 * Graphics quality tiers (pure, unit-tested). The same scene runs everywhere; the tier only changes how much extra the GPU is asked
 * to do: shadow resolution, grass density, how far detailed trees are drawn. A phone starts on "medium" or "low" and the game steps
 * down by itself when the frame rate is poor (see `nextQuality`).
 */
export type Quality = 'high' | 'medium' | 'low';
export const QUALITIES: readonly Quality[] = ['high', 'medium', 'low'];

export interface QualitySettings {
  /** Shadow map size in pixels; 0 turns real shadows off (soft blob shadows remain). */
  shadowMap: number;
  /** Half-width of the area around the hero covered by the shadow map (metres). */
  shadowRange: number;
  /** Grass blades per cell multiplier (0 = no grass). */
  grass: number;
  /** Distance (metres) within which trees use their detailed model. */
  detailRadius: number;
  /** Distance (metres) beyond which small plants (flowers, ferns, mushrooms) are hidden. */
  plantRadius: number;
  /** Cap on the pixel ratio (a second lever next to adaptive resolution). */
  maxPixelRatio: number;
  /** Fireflies and ambient motes multiplier. */
  particles: number;
  /** Dark outline around the hero (a second copy of each visible body part). v2.11: on in every tier: it is the hero's look, and the hero is a tiny share of a phone's cost next to grass and shadows. `?outline=0` still turns it off. */
  outline: boolean;
}

export const SETTINGS: Readonly<Record<Quality, QualitySettings>> = {
  high: { shadowMap: 2048, shadowRange: 17, grass: 1, detailRadius: 26, plantRadius: 30, maxPixelRatio: 2, particles: 1, outline: true },
  medium: { shadowMap: 1024, shadowRange: 13, grass: 0.5, detailRadius: 15, plantRadius: 18, maxPixelRatio: 1.75, particles: 0.7, outline: true },
  low: { shadowMap: 512, shadowRange: 10, grass: 0.4, detailRadius: 9, plantRadius: 11, maxPixelRatio: 1.25, particles: 0.4, outline: true },
};

export interface DeviceHints { touch: boolean; cores?: number; memoryGb?: number; devicePixelRatio?: number; width: number; height: number }

/** First guess at a tier from what the browser reveals. A URL override (`?q=low|medium|high`) wins. */
export function initialQuality(h: DeviceHints, override?: string | null): Quality {
  if (override && (QUALITIES as readonly string[]).includes(override)) return override as Quality;
  const cores = h.cores ?? 4, mem = h.memoryGb ?? 4;
  const pixels = h.width * h.height * Math.min(2, h.devicePixelRatio ?? 1) ** 2;
  if (h.touch) {
    if (cores <= 4 || mem <= 3) return 'low';
    return pixels > 2_400_000 ? 'low' : 'medium';
  }
  if (cores <= 2 || mem <= 2) return 'medium';
  return 'high';
}

/** Steps down one tier when the average fps over a window is poor. Never steps back up (no flip-flopping). */
export function nextQuality(current: Quality, avgFps: number, threshold = 38): Quality {
  if (avgFps >= threshold) return current;
  if (current === 'high') return 'medium';
  if (current === 'medium') return 'low';
  return 'low';
}

/** Whether the hero outline is drawn: the tier decides, and `?outline=1|0` overrides it (handy for comparing frame rates on a phone). */
export function outlineWanted(q: Quality, override?: string | null): boolean {
  if (override === '1' || override === 'on') return true;
  if (override === '0' || override === 'off') return false;
  return SETTINGS[q].outline;
}
