/**
 * Circle colliders on the ground plane (pure, unit-tested). Trees, rocks, houses and ruin pillars are circles; the hero
 * and enemies are pushed out of them, and the follow camera asks how far it can sit behind the hero before one is in the way.
 */
export interface Collider { x: number; z: number; r: number }

export class ColliderGrid {
  private cells = new Map<number, Collider[]>();
  private maxR = 0;
  constructor(readonly all: readonly Collider[], private readonly cell = 4) {
    for (const c of all) {
      this.maxR = Math.max(this.maxR, c.r);
      const x0 = Math.floor((c.x - c.r) / cell), x1 = Math.floor((c.x + c.r) / cell);
      const z0 = Math.floor((c.z - c.r) / cell), z1 = Math.floor((c.z + c.r) / cell);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        const list = this.cells.get(k);
        if (list) list.push(c); else this.cells.set(k, [c]);
      }
    }
  }
  private key(ix: number, iz: number): number { return (ix + 4096) * 8192 + (iz + 4096); }

  /** Colliders whose cells overlap the square of half-size `range` around (x, z). May include a few that are slightly further. */
  near(x: number, z: number, range: number): Collider[] {
    const out = new Set<Collider>();
    const x0 = Math.floor((x - range) / this.cell), x1 = Math.floor((x + range) / this.cell);
    const z0 = Math.floor((z - range) / this.cell), z1 = Math.floor((z + range) / this.cell);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const list = this.cells.get(this.key(ix, iz));
      if (list) for (const c of list) out.add(c);
    }
    return [...out];
  }
}

/** Pushes a body of `radius` out of every overlapping collider. Returns the corrected position and whether anything was hit. */
export function resolveCircles(grid: ColliderGrid, x: number, z: number, radius: number, iterations = 3): { x: number; z: number; hit: boolean } {
  let hit = false;
  for (let i = 0; i < iterations; i++) {
    let moved = false;
    for (const c of grid.near(x, z, radius + 0.2)) {
      const dx = x - c.x, dz = z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { x = c.x + min; moved = true; hit = true; continue; }
      const push = (min - d) / d;
      x += dx * push; z += dz * push; moved = true; hit = true;
    }
    if (!moved) break;
  }
  return { x, z, hit };
}

export function isClear(grid: ColliderGrid, x: number, z: number, radius: number): boolean {
  for (const c of grid.near(x, z, radius + 0.1)) if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return false;
  return true;
}

/**
 * How far a ray from (ox, oz) along the unit direction (dx, dz) travels before touching a collider grown by `padding`.
 * Colliders the origin already sits inside are ignored so the camera never collapses onto the hero. Result is capped at `maxDist`.
 */
export function rayClearDistance(grid: ColliderGrid, ox: number, oz: number, dx: number, dz: number, maxDist: number, padding = 0): number {
  let best = maxDist;
  const mx = ox + dx * maxDist * 0.5, mz = oz + dz * maxDist * 0.5;
  for (const c of grid.near(mx, mz, maxDist * 0.5 + 1 + padding)) {
    const R = c.r + padding;
    const ocx = c.x - ox, ocz = c.z - oz;
    const oc2 = ocx * ocx + ocz * ocz;
    if (oc2 <= R * R) continue;
    const tca = ocx * dx + ocz * dz;
    if (tca < 0) continue;
    const d2 = oc2 - tca * tca;
    if (d2 > R * R) continue;
    const t = tca - Math.sqrt(R * R - d2);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}
