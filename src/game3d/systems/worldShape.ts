/** Shape of the Whispering Woods ground: smooth hills, flat clearings for the village and the ruins, a trail between them. Pure. */
import type { Vec2 } from './movement3d';

export const WORLD_RADIUS = 46;
/** The hero cannot walk past this distance from the centre (trees and hills hide the edge). */
export const PLAY_RADIUS = 41;

export interface FlatZone { x: number; z: number; r: number; blend: number }
export const VILLAGE: FlatZone = { x: 0, z: 25, r: 11, blend: 5 };
export const RUINS: FlatZone = { x: 0, z: -27, r: 11, blend: 5 };
/** A small pond east of the trail (the ground is levelled around it; the water sits in a dip drawn by the terrain mesh). */
export const POND = { x: 19, z: 17, r: 3.4 };
export const FLAT_ZONES: readonly FlatZone[] = [VILLAGE, RUINS, { x: POND.x, z: POND.z, r: POND.r + 1.2, blend: 3 }];

/** The trail from the village gate to the ruins, as a polyline. */
export const TRAIL: readonly Vec2[] = [
  { x: 0, z: 22 }, { x: 5, z: 12 }, { x: -4, z: 2 }, { x: 3, z: -8 }, { x: -3, z: -14 }, { x: 0, z: -17 },
];

export const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function distToTrail(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const a = TRAIL[i], b = TRAIL[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
  }
  return best;
}

const rolling = (x: number, z: number): number =>
  0.8 * (1.1 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 - 0.4) + 0.7 * Math.sin(x * 0.23 + z * 0.17 + 2.1) + 0.35 * Math.sin(x * 0.5 - z * 0.43));

/** Ground height in metres at (x, z). Flat (0) in the village and ruins, gentle along the trail, rising into a wall of hills at the rim. */
export function heightAt(x: number, z: number): number {
  let h = rolling(x, z);
  let flat = 0;
  for (const f of FLAT_ZONES) flat = Math.max(flat, 1 - smoothstep(f.r, f.r + f.blend, Math.hypot(x - f.x, z - f.z)));
  flat = Math.max(flat, 0.85 * (1 - smoothstep(1.4, 3.6, distToTrail(x, z))));
  h *= 1 - flat;
  h += smoothstep(PLAY_RADIUS - 4, WORLD_RADIUS, Math.hypot(x, z)) * 7;
  return h;
}
