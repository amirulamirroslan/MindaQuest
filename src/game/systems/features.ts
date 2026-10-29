/**
 * Developer switches for finding what makes a device slow. Nothing here changes the game for players.
 *   ?fps                      shows a small frame-rate meter (and which renderer is in use)
 *   ?off=leaves,birds,...     turns individual living-world features off (or `?off=all`)
 */
export const FEATURES = ['sway', 'leaves', 'butterflies', 'birds', 'fish', 'fireflies', 'dust', 'sparkles', 'daynight', 'music', 'ambience', 'sound'] as const;
export type Feature = (typeof FEATURES)[number];

export function parseOff(search: string): Set<Feature> {
  const raw = new URLSearchParams(search).get('off');
  if (!raw) return new Set();
  const names = raw.toLowerCase().split(',').map((name) => name.trim());
  return new Set(names.includes('all') ? FEATURES : FEATURES.filter((feature) => names.includes(feature)));
}

export const wantsFpsMeter = (search: string) => new URLSearchParams(search).has('fps');

const OFF = parseOff(typeof location === 'undefined' ? '' : location.search);
/** True when this feature was switched off in the URL. */
export const isOff = (feature: Feature) => OFF.has(feature);
