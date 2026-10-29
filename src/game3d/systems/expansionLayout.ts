/**
 * v2.31 World expansion: grows the generated woods layout (pure, deterministic, unit-tested). Runs AFTER the original glade has been
 * generated, with its own random stream, so every original tree, rock and collider keeps its exact place; the only originals removed are
 * rim trees and boulders that stood in the way of a new path through the ridge ring.
 */
import type { Collider } from './colliders';
import type { Vec2 } from './movement3d';
import type { BlockSpec, PillarSpec, PlantSpec, TreeKind, WorldLayout } from './layout3d';
import {
  ACORN_SPOTS, BARN, CHEST_SPOTS, FARM_HOUSES, HEARTWOOD_TREE, LANTERN_SPOTS, MIST_GATE, MOON_CIRCLE, moonGap, PASSES, PEARL_SPOTS, PEOPLE, PUMPKIN_SPOTS, SIGN_SPOTS, TABLET_SPOTS,
  THORNS, UNDERCROFT_DOOR, WATCHTOWER, WELL2, WINDMILL,
} from './expansion';
import { CLEARINGS, MIRROR, PATHS, distToPaths, pathClearance } from './expansionShape';
import { LEGACY_PLAY_RADIUS, PLAY_RADIUS } from './worldShape';

/** Extra pieces the expansion adds on top of WorldLayout (kept on the layout so tests and the renderer see one object). */
export interface ExpansionExtras {
  /** Colliders that exist only while the Heartwood shortcut is closed. */
  thorns: Collider[];
  /** Orchard trees and the like that are scenery with a collider (already in `trees`; listed so the renderer can find them). */
  count: { trees: number; rocks: number };
}

const near = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Tree density (per square metre) of the expanded woods at (x, z). */
export function treeDensity(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let d = 0.022;
  if (r > LEGACY_PLAY_RADIUS + 5.5 && r < 62) d = 0.06;
  if (r > 88) d = 0.075;
  const at = (c: Vec2, rad: number, dens: number): void => { if (near({ x, z }, c) < rad) d = dens; };
  at({ x: -66, z: 2 }, 24, 0.075); at({ x: -80, z: -26 }, 14, 0.07); at({ x: -52, z: -56 }, 15, 0.05);
  at({ x: 0, z: 76 }, 22, 0.004); at({ x: -50, z: 62 }, 16, 0.004); at({ x: 62, z: 56 }, 17, 0.006); at({ x: 68, z: 14 }, 20, 0.004);
  at({ x: 0, z: -78 }, 20, 0.008); at({ x: 30, z: -54 }, 12, 0.01);
  return d;
}

export function expandLayout(L: WorldLayout, rnd: () => number): ExpansionExtras {
  const colliders = L.colliders;
  // ---- 1. open the passes: original rim trees, dead trees and boulders that stand in a new path's strip are removed
  const removed = new Set<string>();
  const key = (x: number, z: number): string => `${x},${z}`;
  const cut = <T extends { x: number; z: number }>(list: T[], radius: (t: T) => number): T[] => list.filter(t => {
    if (pathClearance(t.x, t.z) >= radius(t)) return true;   // anything of the original glade that stands in a new path's strip goes, so every trail can be walked
    removed.add(key(t.x, t.z)); return false;
  });
  L.trees = cut(L.trees, t => 0.5 * t.scale); L.deadTrees = cut(L.deadTrees, t => 0.5 * t.scale); L.rocks = cut(L.rocks, t => 0.75 * t.scale);
  if (removed.size) { const keep = colliders.filter(c => !removed.has(key(c.x, c.z))); colliders.length = 0; colliders.push(...keep); }

  // ---- 2. keep-clear circles for everything placed by hand
  const KEEP: { p: Vec2; r: number }[] = [
    ...ACORN_SPOTS, ...PUMPKIN_SPOTS, ...PEARL_SPOTS,
  ].map(p => ({ p, r: 2.2 }));
  for (const p of [...LANTERN_SPOTS, ...TABLET_SPOTS, ...CHEST_SPOTS, ...PEOPLE.map(pe => pe.at)]) KEEP.push({ p, r: 3 });
  for (const s of SIGN_SPOTS) KEEP.push({ p: s, r: 1.6 });
  for (const s of PASSES) KEEP.push({ p: s.at, r: 4.5 });
  KEEP.push(
    { p: WINDMILL, r: 4.5 }, { p: WATCHTOWER, r: 4.5 }, { p: BARN, r: 5.5 }, { p: WELL2, r: 2 }, { p: HEARTWOOD_TREE, r: 6.5 }, { p: MOON_CIRCLE, r: 8 },
    { p: MIST_GATE, r: 8 }, { p: UNDERCROFT_DOOR, r: 7 }, { p: { x: THORNS.x, z: THORNS.z }, r: 5 }, { p: { x: -70, z: -48 }, r: 8.5 },
    { p: { x: MIRROR.x, z: MIRROR.z }, r: MIRROR.r + 2.5 },
  );
  for (const h of FARM_HOUSES) KEEP.push({ p: h, r: 4.5 });
  const blocked = (x: number, z: number, margin: number): boolean => {
    if (pathClearance(x, z) < margin) return true;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.8 + margin) return true;
    for (const k of KEEP) if (Math.hypot(x - k.p.x, z - k.p.z) < k.r + margin) return true;
    return false;
  };
  const keepClear = (x: number, z: number, margin: number): boolean => KEEP.some(k => Math.hypot(x - k.p.x, z - k.p.z) < k.r + margin);
  const free = (x: number, z: number, margin: number): boolean => colliders.every(c => Math.hypot(x - c.x, z - c.z) > c.r + margin);
  const solid = (x: number, z: number, r: number): void => { colliders.push({ x, z, r }); };

  // ---- 3. buildings and landmarks: solid footprints (the renderer draws the matching models, see render/WildsWorld.ts)
  for (const h of FARM_HOUSES) solid(h.x, h.z, h.r);
  solid(BARN.x, BARN.z, 2.5); solid(BARN.x + 2.4 * Math.cos(BARN.rot), BARN.z - 2.4 * Math.sin(BARN.rot), 2.0);
  solid(WINDMILL.x, WINDMILL.z, 1.9); solid(WELL2.x, WELL2.z, 0.9);
  solid(WATCHTOWER.x, WATCHTOWER.z, 2.2); solid(HEARTWOOD_TREE.x, HEARTWOOD_TREE.z, 2.8);
  for (const p of PEOPLE) solid(p.at.x, p.at.z, 0.5);
  for (const c of CHEST_SPOTS) solid(c.x, c.z, 0.7);
  for (const p of LANTERN_SPOTS) solid(p.x, p.z, 0.5);
  for (const p of TABLET_SPOTS) solid(p.x, p.z, 0.6);
  solid(MIRROR.x, MIRROR.z - 0.4, 0.8);
  for (const s of SIGN_SPOTS) solid(s.x, s.z, 0.3);
  // the stone circle: seven standing stones with two gaps where the Mist Road goes through
  for (let i = 0; i < MOON_CIRCLE.stones; i++) {
    const a = (i / MOON_CIRCLE.stones) * Math.PI * 2 + 0.45;
    const x = MOON_CIRCLE.x + Math.cos(a) * MOON_CIRCLE.r, z = MOON_CIRCLE.z + Math.sin(a) * MOON_CIRCLE.r;
    if (moonGap(x, z)) continue; // keep both road gaps open
    solid(x, z, 0.8);
  }
  // pass arches: two posts either side of each pass
  for (const p of PASSES) { const nx = Math.cos(p.facing), nz = -Math.sin(p.facing); solid(p.at.x + nx * 2.6, p.at.z + nz * 2.6, 0.5); solid(p.at.x - nx * 2.6, p.at.z - nz * 2.6, 0.5); }
  // the Mistfall gate: two pillars and a curtain of mist the hero cannot pass (a future region will replace the curtain with a portal)
  { const dx = MIST_GATE.x, dz = MIST_GATE.z, l = Math.hypot(dx, dz), ox = dx / l, oz = dz / l, tx = -oz, tz = ox;
    solid(dx + tx * 2.7, dz + tz * 2.7, 0.9); solid(dx - tx * 2.7, dz - tz * 2.7, 0.9);
    for (let s = -17; s <= 17; s += 1.6) { if (Math.abs(s) < 2.4) { if (Math.abs(s) < 1.7) continue; } solid(dx + ox * 3.4 + tx * s, dz + oz * 3.4 + tz * s, 1.2); }
    for (let s = -2.4; s <= 2.4; s += 1.6) solid(dx + ox * 3.4 + tx * s, dz + oz * 3.4 + tz * s, 1.2); }
  // the Undercroft door: a sealed wall across the north end of the Old Steps
  for (let s = -9; s <= 9; s += 1.6) solid(UNDERCROFT_DOOR.x + s, UNDERCROFT_DOOR.z - 1.2, 1.1);
  // the Whisper Cave: a horseshoe of boulders around a small chamber that opens to the east
  const rocks: PlantSpec[] = []; void rocks;
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI / 6) + (i / 11) * (Math.PI * 2 - Math.PI / 3);   // angle 0 = east (+x); skip +-30 degrees
    const sc = 1.7 + rnd() * 0.5, x = -70 + Math.cos(a) * 5.4, z = -48 + Math.sin(a) * 5.4;
    L.rocks.push({ x, z, scale: sc, rot: rnd() * 6.28 }); solid(x, z, 0.75 * sc);
  }
  // the thorn barrier is returned separately (it exists only until the shortcut opens)
  const thorns: Collider[] = THORNS.colliders.map(c => ({ ...c }));

  // ---- 4. the orchard: rows of small blossom and plain trees either side of the lane
  const laneX = (z: number): number => { const pts = PATHS[0].pts; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (z >= a.z && z <= b.z) return a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x); } return 0; };
  for (let z = 45; z <= 59; z += 4.6) for (const side of [-1, 1]) {
    const x = laneX(z) + side * (5.6 + rnd() * 0.8), zz = z + (rnd() - 0.5) * 1.2, orchHue = side < 0 ? 0.93 + rnd() * 0.06 : 0.3 + rnd() * 0.3, orchVar = Math.floor(rnd() * 3), orchSc = 0.8 + rnd() * 0.15, orchRot = rnd() * 6.28;
    if (distToPaths(x, zz) < 2.6) continue;   // the side trails leave the lane through the orchard
    L.trees.push({ x, z: zz, kind: 'oak', variant: orchVar, scale: orchSc, hue: orchHue, rot: orchRot });
    solid(x, zz, 0.42 * orchSc + 0.1);
  }

  // ---- 5. the forests: a jittered grid, denser where the zone says so (outside the original glade only)
  const step = 3.5;
  let trees = 0;
  for (let gx = -PLAY_RADIUS - 6; gx <= PLAY_RADIUS + 6; gx += step) for (let gz = -PLAY_RADIUS - 6; gz <= PLAY_RADIUS + 6; gz += step) {
    const x = gx + (rnd() - 0.5) * step * 0.85, z = gz + (rnd() - 0.5) * step * 0.85, d = Math.hypot(x, z);
    const roll = rnd(), kr = rnd(), sr = rnd(), vr = rnd(), hr = rnd(), rr = rnd();      // always the same number of draws per cell
    if (d <= LEGACY_PLAY_RADIUS + 5 || d > PLAY_RADIUS + 4) continue;
    if (roll > Math.min(1, treeDensity(x, z) * step * step)) continue;
    const scale = 0.85 + sr * 0.7 + (d > PLAY_RADIUS - 8 ? 0.35 : 0);
    if (blocked(x, z, 0.5 * scale) || !free(x, z, 0.3)) continue;
    const inGrove = near({ x, z }, { x: -52, z: -56 }) < 15, inThicket = near({ x, z }, { x: -66, z: 2 }) < 24 || near({ x, z }, { x: -80, z: -26 }) < 14;
    const kind: TreeKind = inThicket ? (kr < 0.45 ? 'oak' : kr < 0.9 ? 'pine' : 'birch') : inGrove ? 'oak' : kr < 0.4 ? 'oak' : kr < 0.75 ? 'pine' : 'birch';
    const hue = inGrove ? 0.92 + hr * 0.07 : hr;
    L.trees.push({ x, z, kind, variant: Math.floor(vr * 3), scale, hue, rot: rr * 6.28 }); solid(x, z, 0.42 * scale + 0.1); trees++;
  }
  // twisted dead trees in the thicket and around the Heartwood
  for (let i = 0, ok = 0; i < 500 && ok < 10; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 22, x = -70 + Math.cos(a) * d, z = -8 + Math.sin(a) * d, sc = 0.95 + rnd() * 0.5, v = Math.floor(rnd() * 3), rot = rnd() * 6.28;
    if (blocked(x, z, 1.6) || !free(x, z, 1.6)) continue;
    L.deadTrees.push({ x, z, variant: v, scale: sc, rot }); solid(x, z, 0.42 * sc + 0.1); ok++;
  }

  // ---- 6. boulders: a sealed ring at the outer rim, scattered stones, and rocks around the hill and the pond
  let nr = 0;
  const boulder = (x: number, z: number, sc: number): void => { L.rocks.push({ x, z, scale: sc, rot: rnd() * 6.28 }); solid(x, z, 0.75 * sc); nr++; };
  for (let i = 0; i < 150; i++) { const a = (i / 150) * Math.PI * 2 + (rnd() - 0.5) * 0.02, d = PLAY_RADIUS + 0.6 + rnd() * 3.5; boulder(Math.sin(a) * d, Math.cos(a) * d, 2.0 + rnd() * 2.4); }
  const scatterRocks = (n: number, c: Vec2, rad: number, lo: number, hi: number): void => {
    for (let i = 0, ok = 0; i < n * 8 && ok < n; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * rad, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, sc = lo + rnd() * (hi - lo);
      if (Math.hypot(x, z) > PLAY_RADIUS - 2 || Math.hypot(x, z) < LEGACY_PLAY_RADIUS + 5 || blocked(x, z, 0.8 * sc) || !free(x, z, 0.5)) continue;
      boulder(x, z, sc); ok++;
    }
  };
  scatterRocks(40, { x: 0, z: 0 }, PLAY_RADIUS - 3, 0.5, 1.5); scatterRocks(10, { x: 62, z: 56 }, 14, 0.8, 1.6); scatterRocks(14, { x: MIRROR.x, z: MIRROR.z }, MIRROR.r + 5, 0.5, 1.2);
  scatterRocks(10, { x: -80, z: -26 }, 12, 0.8, 1.6);

  // ---- 7. small scenery (no collider): bushes, flowers, ferns and mushrooms, thickest where the zone calls for them
  const around = (c: Vec2, rad: number, n: number, put: (x: number, z: number) => void, margin = 0.6): void => {
    for (let i = 0, ok = 0; i < n * 6 && ok < n; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * rad, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > PLAY_RADIUS - 1 || Math.hypot(x, z) < LEGACY_PLAY_RADIUS + 5 || pathClearance(x, z) < -1.2 || keepClear(x, z, 0.4) || !free(x, z, margin)) continue;
      put(x, z); ok++;
    }
  };
  const plant = (list: PlantSpec[], lo: number, hi: number) => (x: number, z: number): void => { list.push({ x, z, scale: lo + rnd() * (hi - lo), rot: rnd() * 6.28, hue: rnd() }); };
  const bush = (x: number, z: number): void => { L.bushes.push({ x, z, scale: 0.6 + rnd() * 0.7, hue: rnd() }); };
  const flower = (x: number, z: number): void => { L.flowers.push({ x, z, hue: rnd() }); };
  for (const [c, rad] of [[{ x: -50, z: 62 }, 14], [{ x: 0, z: 76 }, 20], [{ x: 62, z: 56 }, 15], [{ x: MIRROR.x, z: MIRROR.z }, 18], [{ x: -52, z: -56 }, 10], [{ x: 0, z: -78 }, 16]] as [Vec2, number][]) {
    around(c, rad, 70, flower, 0.4); around(c, rad, 16, bush, 1.0);
  }
  around({ x: -66, z: 2 }, 22, 110, plant(L.ferns, 0.8, 1.5), 0.3); around({ x: -80, z: -26 }, 12, 50, plant(L.ferns, 0.8, 1.5), 0.3); around({ x: -52, z: -56 }, 11, 30, plant(L.ferns, 0.8, 1.3), 0.3);
  around({ x: -66, z: 2 }, 22, 60, plant(L.mushrooms, 0.9, 1.8), 0.3); around({ x: -80, z: -26 }, 12, 24, plant(L.mushrooms, 0.9, 1.8), 0.3);
  around({ x: -66, z: 2 }, 24, 14, bush, 1.0);
  for (const [c, rad, n] of [[{ x: -66, z: 2 }, 22, 5], [{ x: -52, z: -56 }, 12, 2]] as [Vec2, number, number][]) {
    around(c, rad, n, (x, z) => { const sc = 0.8 + rnd() * 0.4; L.stumps.push({ x, z, scale: sc, rot: rnd() * 6.28, hue: rnd() }); solid(x, z, 0.5 * sc); }, 1.2);
    around(c, rad, n, (x, z) => { const sc = 0.9 + rnd() * 0.4; L.logs.push({ x, z, scale: sc, rot: rnd() * 6.28, hue: rnd() }); solid(x, z, 0.7 * sc); }, 1.6);
  }
  void ({} as PillarSpec); void ({} as BlockSpec);
  return { thorns, count: { trees, rocks: nr } };
}
