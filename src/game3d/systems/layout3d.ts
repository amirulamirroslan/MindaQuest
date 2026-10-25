/**
 * Where everything stands in the Whispering Woods (pure, deterministic, unit-tested). The Three.js layer only turns this
 * into meshes, so reachability of petals, enemies and the ruins can be proven here without a GPU.
 * Convention: +Z is "south" (the village), -Z is "north" (the ruins). The camera starts looking north.
 */
import { ColliderGrid, isClear, type Collider } from './colliders';
import type { Vec2 } from './movement3d';
import { PLAY_RADIUS, POND, RUINS, VILLAGE, distToTrail, heightAt } from './worldShape';

export const SPAWN: Vec2 = { x: 0, z: 27 };
export const ELDER_POS: Vec2 = { x: 3, z: 21 };
export const VILLAGE_GATE_POS: Vec2 = { x: 0, z: 17.5 };
export const MOONLIT_GATE_POS: Vec2 = { x: -10.5, z: 26 };
/** Walking into this circle once the gate is open ends the adventure. */
export const MOONLIT_GATE_TRIGGER = { x: -9.2, z: 26, r: 1.5 };
export const BOSS_POS: Vec2 = { x: 0, z: -27 };
/** The Rune Stone stands just outside the ruins, beside the end of the trail: answer its riddles to wake the Old Mossback. */
export const RUNE_STONE_POS: Vec2 = { x: -3.6, z: -15.4 };
/** How close the hero must be to use the Rune Stone. */
export const RUNE_STONE_RANGE = 3.0;
export const ARENA_ENTRANCE: Vec2 = { x: 0, z: -15 };
export const ARENA_PILLAR_RING = 8.5;

export const PETAL_SPOTS: readonly Vec2[] = [
  { x: 10, z: 9 }, { x: -9, z: 11 }, { x: -11, z: -1 }, { x: 10, z: -3 }, { x: 8, z: -13 }, { x: -9, z: -12 }, { x: 14, z: 0 }, { x: -14, z: 5 },
];
export const SPROUT_SPOTS: readonly Vec2[] = [{ x: 8, z: 5 }, { x: -8, z: -4 }, { x: 7, z: -10 }, { x: -7, z: 8 }];
export const HOUSES: readonly (Vec2 & { r: number; rot: number })[] = [
  { x: -7, z: 31, r: 2.4, rot: 0.3 }, { x: 7, z: 32, r: 2.4, rot: -0.4 }, { x: 10, z: 24, r: 2.2, rot: -1.2 },
];
export const WELL_POS: Vec2 = { x: -3.5, z: 22 };
/** The trail-keeper's camp (v2.4): a red tent, a campfire with a log seat and a short fence, west of the village gate. */
export const CAMP_POS: Vec2 = { x: -14, z: 21 };
export const CAMP_TENT: Vec2 = { x: CAMP_POS.x - 1.2, z: CAMP_POS.z - 1.0 };
export const CAMP_FIRE: Vec2 = { x: CAMP_POS.x + 1.6, z: CAMP_POS.z + 0.6 };

export type TreeKind = 'oak' | 'pine' | 'birch';
export interface TreeSpec { x: number; z: number; kind: TreeKind; variant: number; scale: number; hue: number; rot: number }
/** Points of interest off the trail: a big glowing tree, a pond and a ring of glowing mushrooms. */
export const ANCIENT_TREE_POS: Vec2 = { x: -26, z: -8 };
export const POND_POS = POND;
export const FAIRY_RING_POS = { x: -18, z: 14, r: 2.1 };
export interface RockSpec { x: number; z: number; scale: number; rot: number }
export interface BushSpec { x: number; z: number; scale: number; hue: number }
export interface FlowerSpec { x: number; z: number; hue: number }
export interface PlantSpec { x: number; z: number; scale: number; rot: number; hue: number }
export interface PillarSpec { x: number; z: number; height: number; broken: boolean; rot: number }
export interface BlockSpec { x: number; z: number; w: number; h: number; d: number; rot: number }
/** A twisted dead tree (v2.6), a landmark near the rim and the camp. */
export interface DeadTreeSpec { x: number; z: number; variant: number; scale: number; rot: number }

export interface WorldLayout {
  trees: TreeSpec[]; rocks: RockSpec[]; bushes: BushSpec[]; flowers: FlowerSpec[];
  /** Small scenery: ferns, mushrooms (the last `fairyRing` of them glow), stumps and fallen logs. */
  ferns: PlantSpec[]; mushrooms: PlantSpec[]; stumps: PlantSpec[]; logs: PlantSpec[]; fairyRing: PlantSpec[];
  pillars: PillarSpec[]; blocks: BlockSpec[]; colliders: Collider[];
  /** v2.6: twisted dead trees (solid). */
  deadTrees: DeadTreeSpec[];
}

/** Small deterministic random generator so the world is identical every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEEP_CLEAR: readonly { p: Vec2; r: number }[] = [
  ...PETAL_SPOTS.map(p => ({ p, r: 2.4 })), ...SPROUT_SPOTS.map(p => ({ p, r: 3 })),
  { p: ANCIENT_TREE_POS, r: 7 }, { p: POND_POS, r: POND_POS.r + 2.5 }, { p: FAIRY_RING_POS, r: FAIRY_RING_POS.r + 2 },
  { p: SPAWN, r: 3 }, { p: ELDER_POS, r: 2.5 }, { p: VILLAGE_GATE_POS, r: 3.5 }, { p: MOONLIT_GATE_POS, r: 4 },
];

export function buildWorldLayout(seed = 20260): WorldLayout {
  const rnd = mulberry32(seed);
  const colliders: Collider[] = [];
  const trees: TreeSpec[] = [], rocks: RockSpec[] = [], bushes: BushSpec[] = [], flowers: FlowerSpec[] = [];
  const ferns: PlantSpec[] = [], mushrooms: PlantSpec[] = [], stumps: PlantSpec[] = [], logs: PlantSpec[] = [], fairyRing: PlantSpec[] = [];
  const pillars: PillarSpec[] = [], blocks: BlockSpec[] = [];

  // Village: houses and the well are solid; the two gate arches add their own posts.
  for (const h of HOUSES) colliders.push({ x: h.x, z: h.z, r: h.r });
  colliders.push({ x: WELL_POS.x, z: WELL_POS.z, r: 0.9 });
  colliders.push({ x: CAMP_TENT.x, z: CAMP_TENT.z, r: 1.5 }, { x: CAMP_FIRE.x, z: CAMP_FIRE.z, r: 0.6 });
  colliders.push({ x: VILLAGE_GATE_POS.x - 2.2, z: VILLAGE_GATE_POS.z, r: 0.5 }, { x: VILLAGE_GATE_POS.x + 2.2, z: VILLAGE_GATE_POS.z, r: 0.5 });
  colliders.push({ x: MOONLIT_GATE_POS.x, z: MOONLIT_GATE_POS.z - 2, r: 0.7 }, { x: MOONLIT_GATE_POS.x, z: MOONLIT_GATE_POS.z + 2, r: 0.7 });
  colliders.push({ x: ELDER_POS.x, z: ELDER_POS.z, r: 0.55 });
  colliders.push({ x: RUNE_STONE_POS.x, z: RUNE_STONE_POS.z, r: 0.75 });
  colliders.push({ x: ANCIENT_TREE_POS.x, z: ANCIENT_TREE_POS.z, r: 1.7 });
  colliders.push({ x: POND_POS.x, z: POND_POS.z, r: POND_POS.r - 0.4 });

  // Ruins: a ring of pillars with an open south entrance, a collapsed north arch, and fallen blocks.
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.31;
    const dx = Math.sin(a), dz = Math.cos(a); // angle 0 = +Z (south, toward the village)
    if (dz > 0.8) continue; // keep the entrance open
    const broken = rnd() < 0.45;
    const height = broken ? 0.9 + rnd() * 0.9 : 2.6 + rnd() * 1.6;
    const x = RUINS.x + dx * ARENA_PILLAR_RING, z = RUINS.z + dz * ARENA_PILLAR_RING;
    pillars.push({ x, z, height, broken, rot: rnd() * 6.28 });
    colliders.push({ x, z, r: 0.85 });
  }
  for (const sx of [-2.6, 2.6]) {
    const x = RUINS.x + sx, z = RUINS.z - 11.5;
    pillars.push({ x, z, height: 4.4, broken: false, rot: 0 });
    colliders.push({ x, z, r: 0.95 });
  }
  const blockSpots: Vec2[] = [{ x: -5, z: -21 }, { x: 5.5, z: -22 }, { x: -4, z: -33 }, { x: 4.5, z: -32 }];
  for (const b of blockSpots) {
    const w = 1.4 + rnd() * 0.6, d = 1.2 + rnd() * 0.6;
    blocks.push({ x: b.x, z: b.z, w, h: 0.8 + rnd() * 0.5, d, rot: rnd() * 3.14 });
    colliders.push({ x: b.x, z: b.z, r: Math.max(w, d) * 0.62 });
  }

  const inVillage = (x: number, z: number) => Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 2.5;
  const inRuins = (x: number, z: number) => Math.hypot(x - RUINS.x, z - RUINS.z) < RUINS.r + 3.5;
  const blockedForScenery = (x: number, z: number, extra: number) => {
    if (inVillage(x, z) || inRuins(x, z) || distToTrail(x, z) < 2.6 + extra) return true;
    for (const k of KEEP_CLEAR) if (Math.hypot(x - k.p.x, z - k.p.z) < k.r + extra) return true;
    return false;
  };

  // Trees on a jittered grid, thinned near the middle, dense at the rim so the edge reads as a forest wall.
  const step = 3.1;
  for (let gx = -PLAY_RADIUS - 6; gx <= PLAY_RADIUS + 6; gx += step) {
    for (let gz = -PLAY_RADIUS - 6; gz <= PLAY_RADIUS + 6; gz += step) {
      const x = gx + (rnd() - 0.5) * step * 0.85, z = gz + (rnd() - 0.5) * step * 0.85;
      const d = Math.hypot(x, z);
      if (d > PLAY_RADIUS + 5) continue;
      const keep = d > PLAY_RADIUS - 6 ? 1 : 0.62;
      if (rnd() > keep) continue;
      if (blockedForScenery(x, z, 0)) continue;
      const kr = rnd();
      const kind: TreeKind = kr < 0.4 ? 'oak' : kr < 0.75 ? 'pine' : 'birch';
      const scale = 0.85 + rnd() * 0.7 + (d > PLAY_RADIUS - 8 ? 0.35 : 0);
      trees.push({ x, z, kind, variant: Math.floor(rnd() * 3), scale, hue: rnd(), rot: rnd() * 6.28 });
      colliders.push({ x, z, r: 0.42 * scale + 0.1 });
    }
  }
  for (let i = 0; i < 46; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (PLAY_RADIUS - 2);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (blockedForScenery(x, z, 0.8)) continue;
    const scale = 0.6 + rnd() * 1.0;
    rocks.push({ x, z, scale, rot: rnd() * 6.28 });
    colliders.push({ x, z, r: 0.75 * scale });
  }
  for (let i = 0; i < 120; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (PLAY_RADIUS - 1);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (inRuins(x, z) && Math.hypot(x - RUINS.x, z - RUINS.z) < 10) continue;
    bushes.push({ x, z, scale: 0.6 + rnd() * 0.7, hue: rnd() });
  }
  for (let i = 0; i < 260; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (PLAY_RADIUS - 1);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    flowers.push({ x, z, hue: rnd() });
  }
  // Small scenery (no colliders except the stumps and logs, which are solid but small).
  const scatter = (count: number, into: PlantSpec[], clear: number, scale: [number, number], solid = 0) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (PLAY_RADIUS - 1);
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (blockedForScenery(x, z, clear)) continue;
      const sc = scale[0] + rnd() * (scale[1] - scale[0]);
      into.push({ x, z, scale: sc, rot: rnd() * 6.28, hue: rnd() });
      if (solid) colliders.push({ x, z, r: solid * sc });
    }
  };
  scatter(110, ferns, 0.3, [0.7, 1.3]); scatter(70, mushrooms, 0.3, [0.8, 1.6]); scatter(9, stumps, 1.2, [0.8, 1.3], 0.5); scatter(7, logs, 1.6, [0.9, 1.3], 0.7);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    fairyRing.push({ x: FAIRY_RING_POS.x + Math.cos(a) * FAIRY_RING_POS.r, z: FAIRY_RING_POS.z + Math.sin(a) * FAIRY_RING_POS.r, scale: 1.2 + (i % 3) * 0.3, rot: a, hue: i / 9 });
  }
  // ---- v2.4 richness pass (drawn after everything else, so the earlier layout is unchanged) ----
  const free = (x: number, z: number, margin: number) => colliders.every(c => Math.hypot(x - c.x, z - c.z) > c.r + margin);
  // a ring of big mossy boulders at the rim: the woods read as a walled glade (cliffs) instead of fading into fog
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + (rnd() - 0.5) * 0.08, d = PLAY_RADIUS + 0.5 + rnd() * 4.5;
    const x = Math.sin(a) * d, z = Math.cos(a) * d, scale = 2.0 + rnd() * 2.6;
    rocks.push({ x, z, scale, rot: rnd() * 6.28 }); colliders.push({ x, z, r: 0.75 * scale });
  }
  // gardens and wayside: bushes, flowers and small rocks around the village and the camp, where the hero spends the first minutes
  const around = (cx: number, cz: number, rMin: number, rMax: number, n: number, put: (x: number, z: number) => void, margin: number) => {
    for (let i = 0, ok = 0; i < n * 6 && ok < n; i++) {
      const a = rnd() * 6.28, d = rMin + Math.sqrt(rnd()) * (rMax - rMin), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      if (Math.hypot(x, z) > PLAY_RADIUS - 2 || distToTrail(x, z) < 1.4 || !free(x, z, margin)) continue;
      put(x, z); ok++;
    }
  };
  around(VILLAGE.x, VILLAGE.z, 3, 15, 34, (x, z) => bushes.push({ x, z, scale: 0.55 + rnd() * 0.6, hue: rnd() }), 1.2);
  around(VILLAGE.x, VILLAGE.z, 2, 15, 120, (x, z) => flowers.push({ x, z, hue: rnd() }), 0.4);
  around(CAMP_POS.x, CAMP_POS.z, 2, 6, 7, (x, z) => { const scale = 0.5 + rnd() * 0.8; rocks.push({ x, z, scale, rot: rnd() * 6.28 }); colliders.push({ x, z, r: 0.75 * scale }); }, 1.0);
  around(CAMP_POS.x, CAMP_POS.z, 2, 7, 14, (x, z) => bushes.push({ x, z, scale: 0.6 + rnd() * 0.6, hue: rnd() }), 1.0);
  around(CAMP_POS.x, CAMP_POS.z, 1.5, 7, 30, (x, z) => flowers.push({ x, z, hue: rnd() }), 0.4);
  // ---- v2.6 detail pass (again drawn last, so nothing above moves): twisted dead trees as landmarks ----
  const deadTrees: DeadTreeSpec[] = [];
  const addDead = (x: number, z: number): boolean => {
    if (Math.hypot(x, z) > PLAY_RADIUS - 2 || blockedForScenery(x, z, 1.2) || !free(x, z, 1.6)) return false;
    const scale = 0.95 + rnd() * 0.5;
    deadTrees.push({ x, z, variant: Math.floor(rnd() * 3), scale, rot: rnd() * 6.28 }); colliders.push({ x, z, r: 0.42 * scale + 0.1 });
    return true;
  };
  addDead(CAMP_POS.x - 5.5, CAMP_POS.z - 4.5);
  addDead(CAMP_POS.x - 4.0, CAMP_POS.z + 6.5);
  for (let i = 0, ok = 0; i < 400 && ok < 14; i++) {
    const a = rnd() * 6.28, d = PLAY_RADIUS - 16 + rnd() * 12;
    if (addDead(Math.sin(a) * d, Math.cos(a) * d)) ok++;
  }
  return { trees, rocks, bushes, flowers, ferns, mushrooms, stumps, logs, fairyRing, pillars, blocks, colliders, deadTrees };
}

/** Ground point for an object (x, z) including the terrain height. */
export const groundPoint = (p: Vec2): { x: number; y: number; z: number } => ({ x: p.x, y: heightAt(p.x, p.z), z: p.z });

/** Everything the player must be able to walk to. Used by the reachability test. */
export function mustReach(): { name: string; p: Vec2 }[] {
  return [
    { name: 'elder', p: { x: ELDER_POS.x - 1.4, z: ELDER_POS.z + 0.6 } },
    { name: 'rune stone', p: { x: RUNE_STONE_POS.x + RUNE_STONE_RANGE * 0.6, z: RUNE_STONE_POS.z + RUNE_STONE_RANGE * 0.3 } },
    { name: 'moonlit gate', p: MOONLIT_GATE_TRIGGER },
    { name: 'arena entrance', p: ARENA_ENTRANCE },
    { name: 'arena centre', p: { x: BOSS_POS.x, z: BOSS_POS.z + 5 } },
    ...PETAL_SPOTS.map((p, i) => ({ name: `petal ${i}`, p })),
    ...SPROUT_SPOTS.map((p, i) => ({ name: `sprout ${i}`, p })),
  ];
}

export { ColliderGrid, isClear };
