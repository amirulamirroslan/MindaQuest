/**
 * v2.31 World expansion: the shape data of the expanded Whispering Woods (pure, no imports, unit-tested).
 * Everything the ground height function needs lives here: the path network, the flat clearings, the hills and the water.
 * Convention as everywhere: +Z is south (the village), -Z is north (the ruins), +X is east.
 *
 * The original glade (radius 41) is untouched. Around it a ridge ring (radius 37-56) still walls it in, and the paths below
 * cut passes through that ring, so every new region is reached through a gap, an arch or a trail rather than by open ground.
 */
export interface Pt { x: number; z: number }
export interface PathDef {
  id: string;
  /** Half-width of the worn dirt, in metres. Trees keep `clear` metres from the centre line. */
  half: number;
  clear: number;
  pts: readonly Pt[];
}
const P = (x: number, z: number): Pt => ({ x, z });

export const PATHS: readonly PathDef[] = [
  { id: 'orchard-lane', half: 1.5, clear: 3.2, pts: [P(0, 35), P(1, 44), P(-2, 52), P(2, 60), P(0, 68)] },
  { id: 'pond-road', half: 1.5, clear: 3.2, pts: [P(5, 12), P(20, 9), P(34, 9), P(46, 8), P(57, 12)] },
  { id: 'mossbark-trail', half: 1.4, clear: 3.0, pts: [P(-6, 16), P(-14, 8), P(-26, 4), P(-38, 8), P(-50, 6), P(-60, 6)] },
  { id: 'thicket-inner', half: 1.1, clear: 2.0, pts: [P(-60, 6), P(-68, 0), P(-64, -8), P(-70, -14), P(-77, -19.5)] },
  { id: 'old-steps-road', half: 1.6, clear: 3.4, pts: [P(0, -37), P(-1, -48), P(3, -58), P(1, -68), P(0, -74), P(0, -89)] },
  { id: 'mist-road', half: 1.5, clear: 3.2, pts: [P(1, -50), P(14, -52), P(28, -54), P(44, -60), P(58, -65)] },
  { id: 'fern-trail', half: 1.2, clear: 2.6, pts: [P(-30, -14), P(-38, -26), P(-46, -38), P(-50, -48), P(-52, -54)] },
  { id: 'cave-path', half: 1.2, clear: 2.4, pts: [P(-52, -56), P(-60, -56), P(-64, -48), P(-66, -48)] },
  { id: 'heartwood-shortcut', half: 1.2, clear: 3.0, pts: [P(-31, -8), P(-40, -8), P(-48, -8), P(-56, -4), P(-62, 2)] },
  { id: 'lookout-trail', half: 1.4, clear: 3.0, pts: [P(2, 60), P(16, 58), P(30, 56), P(44, 56), P(54, 56), P(57.4, 56)] },
  { id: 'meadow-path', half: 1.4, clear: 3.0, pts: [P(-2, 60), P(-16, 62), P(-30, 62), P(-42, 62)] },
  // v2.34
  { id: 'marsh-trail', half: 1.4, clear: 3.0, pts: [P(15, 76), P(24, 79), P(33, 78), P(40, 78)] },
  { id: 'rise-trail', half: 1.4, clear: 3.0, pts: [P(78, 8), P(83, -2), P(84, -14), P(80, -23)] },
  { id: 'falls-trail', half: 1.2, clear: 2.6, pts: [P(-14, -83), P(-23, -84), P(-30, -82)] },
];

interface Seg { ax: number; az: number; bx: number; bz: number; l2: number; x0: number; x1: number; z0: number; z1: number }
const SEGS: Seg[] = [];
for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) {
  const a = p.pts[i], b = p.pts[i + 1], m = 12;
  SEGS.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, l2: (b.x - a.x) ** 2 + (b.z - a.z) ** 2, x0: Math.min(a.x, b.x) - m, x1: Math.max(a.x, b.x) + m, z0: Math.min(a.z, b.z) - m, z1: Math.max(a.z, b.z) + m });
}

const GRID = 16, byCell = new Map<number, Seg[]>();
function segsNear(x: number, z: number): Seg[] {
  const cx = Math.floor(x / GRID), cz = Math.floor(z / GRID), key = cx * 4096 + cz;
  let list = byCell.get(key);
  if (!list) { const x0 = cx * GRID, z0 = cz * GRID; list = SEGS.filter(s => s.x1 >= x0 && s.x0 <= x0 + GRID && s.z1 >= z0 && s.z0 <= z0 + GRID); byCell.set(key, list); }
  return list;
}
/** Distance from (x, z) to the nearest new path (a large value, at least 12 m, when no path is near). The original trail has its own `distToTrail`. */
export function distToPaths(x: number, z: number): number {
  let best = Infinity;
  for (const s of segsNear(x, z)) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const abx = s.bx - s.ax, abz = s.bz - s.az;
    const t = Math.min(1, Math.max(0, ((x - s.ax) * abx + (z - s.az) * abz) / s.l2));
    const dx = x - (s.ax + abx * t), dz = z - (s.az + abz * t), d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}
/** Distance to the nearest path minus that path's own tree-free margin: below 0 means "inside a path's tree-free strip". */
export function pathClearance(x: number, z: number): number {
  let best = Infinity;
  for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) {
    const a = p.pts[i], b = p.pts[i + 1], abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
    const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / l2));
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)) - p.clear;
    if (d < best) best = d;
  }
  return best;
}

export interface Clearing { id: string; x: number; z: number; r: number; blend: number }
export const CLEARINGS: readonly Clearing[] = [
  { id: 'hearthfield', x: 0, z: 76, r: 17, blend: 5 },
  { id: 'kite-meadow', x: -50, z: 62, r: 10, blend: 4 },
  { id: 'mirror-shore', x: 68, z: 14, r: 14, blend: 4 },
  { id: 'thicket-camp', x: -62, z: 6, r: 4, blend: 3 },
  { id: 'heartwood', x: -80, z: -26, r: 5, blend: 3 },
  { id: 'hidden-grove', x: -52, z: -56, r: 8, blend: 4 },
  { id: 'whisper-cave', x: -70, z: -48, r: 5, blend: 3 },
  { id: 'old-steps', x: 0, z: -78, r: 15, blend: 5 },
  { id: 'moon-circle', x: 30, z: -54, r: 7, blend: 3 },
  { id: 'mist-gate', x: 62, z: -66, r: 6, blend: 3 },
  { id: 'firefly-marsh', x: 42, z: 78, r: 7, blend: 4 },
  { id: 'sunstone-rise', x: 80, z: -28, r: 7, blend: 4 },
  { id: 'whispering-falls', x: -34, z: -82, r: 7, blend: 4 },
];

export interface Hill { x: number; z: number; r: number; h: number }
export const HILLS: readonly Hill[] = [{ x: 62, z: 56, r: 13, h: 5.5 }];

/** Mirror Pond: wade-able shallows (no collider) with a raised island in the middle. */
export const MIRROR = { x: 68, z: 14, r: 11, island: 3.4, depth: 0.34 };

/** How far the ground is pressed down by Mirror Pond at (x, z), metres (>= 0). The island is spared. */
export function waterDip(x: number, z: number): number {
  const ex = x - MIRROR.x, ez = z - MIRROR.z, lim = MIRROR.r + 0.8;
  if (ex * ex + ez * ez > lim * lim) return 0;
  const d = Math.sqrt(ex * ex + ez * ez);
  const bowl = 1 - sstep(MIRROR.r - 3.2, MIRROR.r + 0.8, d);
  const island = sstep(MIRROR.island - 0.6, MIRROR.island + 0.9, d);
  return MIRROR.depth * bowl * (0.15 + 0.85 * island);
}

function sstep(a: number, b: number, v: number): number { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }

/** Extra height from the hills (added after the paths flatten the rolling ground, so trails climb the hill instead of cutting a trench). */
export function hillHeight(x: number, z: number): number {
  let h = 0;
  for (const k of HILLS) { const d = Math.hypot(x - k.x, z - k.z); if (d < k.r) h += k.h * (1 - sstep(k.r * 0.25, k.r, d)); }
  return h;
}

/** Farmland of Hearthfield: ploughed strips the terrain paints (pure, so tests and the map can use it). */
export const FIELDS: readonly { x: number; z: number; w: number; d: number }[] = [
  { x: -9, z: 90, w: 10, d: 7 }, { x: 10, z: 92, w: 9, d: 6 },
];
