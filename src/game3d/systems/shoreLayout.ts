/**
 * Moonwake Shore (v2.29): the third area. Pure, deterministic and unit-tested; render/ShoreWorld.ts only turns this into meshes.
 *
 * Like the Hollow, the walkable ground is a union of discs and capped paths ("capsules") and everything else is sea. Unlike the Hollow, some
 * of the ground comes and goes with the TIDE, which the child changes by ringing the three bell-buoys (see shoreQuest.ts):
 *   - the Tidepool Flats (west) are dry sand only at LOW tide;
 *   - a ferry floats across the east channel to the Shipwreck Graveyard only at HIGH tide;
 *   - the Moon Causeway to the lighthouse is under water until BOTH tide songs have been rung (the puzzle is solved), then it stays up;
 *   - the sea cave under the lighthouse is dry only at LOW tide.
 * Convention as everywhere: +z is south (the arrival beach), -z is north (the lighthouse).
 *
 *                       Lighthouse island (Heron, keeper, lamp)   sea cave
 *                              |  Moon Causeway
 *                          north strip -- star bell jetty
 *   Tidepool Flats -- Stilt-village hub (Mak Long, Tide Board) -- ferry -- Shipwreck Graveyard
 *                          /                 \
 *                  shell bell pier       wave bell pier
 *                              arrival beach
 *
 * v2.33 "Deeper Shore": three more places. Pearl Cove (south-west, a boardwalk along the arrival beach, always open), Tern Rock (south-east, a sandbar that
 * only appears at HIGH tide, off the same beach) and Beacon Rock (north-east of the lighthouse island, so it opens with the causeway). Each has a message bottle,
 * and the cove and the rocks have more Pebble Crabs and Gloom Gulls.
 */
import { ColliderGrid, type Collider } from './colliders';
import type { Vec2 } from './movement3d';
import { mulberry32 } from './layout3d';

export type Tide = 'still' | 'low' | 'high';
export type BuoyId = 'shell' | 'wave' | 'star';
export const BUOYS: readonly BuoyId[] = ['shell', 'wave', 'star'];

export type FloorShape = { kind: 'disc'; x: number; z: number; r: number } | { kind: 'path'; a: Vec2; b: Vec2; r: number };
const disc = (x: number, z: number, r: number): FloorShape => ({ kind: 'disc', x, z, r });
const path = (a: Vec2, b: Vec2, r: number): FloorShape => ({ kind: 'path', a, b, r });

/** What the ground depends on. */
export interface ShoreGates { tide: Tide; causeway: boolean }
export type GateKind = 'always' | 'low' | 'high' | 'causeway';
export interface GatedShape { shape: FloorShape; gate: GateKind; /** a name for the renderer and the tests */ part: string }
const open = (g: GateKind, s: ShoreGates): boolean => g === 'always' || (g === 'low' && s.tide === 'low') || (g === 'high' && s.tide === 'high') || (g === 'causeway' && s.causeway);

// ------------------------------------------------------------------------------------------------------------------ places
export const SHORE_SPAWN: Vec2 = { x: 0, z: 33 };
/** Walking into this circle leaves the shore for the woods (re-armed only after the hero has stepped away from it). */
export const SHORE_EXIT = { x: 0, z: 36.8, r: 1.5 };
export const HUB = { x: 0, z: 15, r: 11.5 };
export const FLATS = { x: -36, z: 8, r: 14 };
export const WRECK = { x: 38, z: 6, r: 12.5 };
export const ISLAND = { x: 0, z: -44, r: 10 };
export const CAVE = { x: -18, z: -58.5, r: 6 };
export const LIGHTHOUSE_POS: Vec2 = { x: 0, z: -49 };
/** v2.33: Pearl Cove (always open), Tern Rock (high tide only) and Beacon Rock (beyond the lighthouse island). */
export const COVE = { x: -34, z: 41, r: 7 };
export const TERN = { x: 35, z: 41, r: 6.5 };
export const BEACON = { x: 25, z: -54, r: 7 };
/** The lamp, at the foot of the lighthouse: touchable once the Heron is calm. */
export const LAMP_POS: Vec2 = { x: 0, z: -41.2 };
export const LAMP_RANGE = 3.0;
export const TIDE_BOARD_POS: Vec2 = { x: 6.2, z: 8.4 };
/** Standing within this distance of the Tide Board counts as having read it. */
export const BOARD_RANGE = 6.5;
export const MAK_POS: Vec2 = { x: -5.4, z: 10.6 };
export const MAK_RANGE = 3.2;
export const KEEPER_POS: Vec2 = { x: -6.4, z: -39.4 };
export const KEEPER_RANGE = 3.2;

/** The three bell-buoys. Each sits just off the end of a pier, so ringing them takes a walk (like the Echo Crystals). */
export const BUOY_SPOTS: Readonly<Record<BuoyId, Vec2>> = { shell: { x: -18.2, z: 28.4 }, wave: { x: 18.2, z: 28.4 }, star: { x: 9.6, z: -6.8 } };
export const BUOY_RANGE = 2.8;
/** The middle of the pier end beside each buoy: where the hero stands to ring it (used by the reachability test). */
export const BUOY_STAND: Readonly<Record<BuoyId, Vec2>> = { shell: { x: -16.8, z: 27.2 }, wave: { x: 16.8, z: 27.2 }, star: { x: 8.0, z: -6.0 } };
/** The two tide songs. The flood song is the ebb song played backwards. Each is rung by tapping the buoys in order. */
export const EBB_SONG: readonly BuoyId[] = ['wave', 'shell', 'star'];
export const FLOOD_SONG: readonly BuoyId[] = ['star', 'shell', 'wave'];

/** Sea-glass: two on the hub beaches, three on the flats, two by the wrecks, one in the sea cave. */
export const GLASS_SPOTS: readonly Vec2[] = [
  { x: -9.2, z: 18.4 }, { x: 8.0, z: 22.0 },
  { x: -29.5, z: 1.5 }, { x: -39.5, z: 12.5 }, { x: -44.0, z: 4.5 },
  { x: 33.5, z: 10.0 }, { x: 44.0, z: 1.5 },
  { x: -19.8, z: -60.2 },
];
export const GLASS_RANGE = 1.4;
/** Message bottles (the shore's Moon Tablets): flats, wrecks, sea cave. Each carries a tip for the Heron fight. */
export const BOTTLE_SPOTS: readonly Vec2[] = [{ x: -40.8, z: 15.4 }, { x: 43.0, z: 9.4 }, { x: -15.4, z: -55.4 }, { x: -36.5, z: 37.5 }, { x: 37.5, z: 38 }, { x: 27.5, z: -50.5 }];
export const BOTTLE_RANGE = 2.3;
/** A spot beside each bottle that the hero can stand on to read it (used by the reachability test). */
export const BOTTLE_APPROACH: readonly Vec2[] = [{ x: 1.1, z: -0.8 }, { x: -1.1, z: -0.6 }, { x: 1.2, z: -0.6 }, { x: 1.1, z: 0.8 }, { x: -1.1, z: 0.8 }, { x: -1.2, z: -0.6 }];
/** Pebble Crabs: three on the flats, two by the wrecks. Gloom Gulls: one over the flats, two over the wrecks, one on the causeway. Each has a fixed id. */
export const CRAB_SPOTS: readonly Vec2[] = [{ x: -30, z: 10 }, { x: -38, z: 3.5 }, { x: -42, z: 11 }, { x: 33, z: 3 }, { x: 41, z: 11 }, { x: -32, z: 43 }, { x: -38, z: 44 }];
export const GULL_SPOTS: readonly Vec2[] = [{ x: -33, z: 15 }, { x: 36, z: -1 }, { x: 45, z: 5 }, { x: 0, z: -22 }, { x: 33, z: 43 }, { x: 23, z: -56 }];
/** The Tidecaller Heron perches on the lighthouse island, in front of the lighthouse door. */
export const HERON_POS: Vec2 = { x: 0, z: -45.5 };
/** Where the hero starts again after being knocked out on the island (instead of walking back from the beach). */
export const HERON_CHECKPOINT: Vec2 = { x: 0, z: -35.5 };
export const SHORE_ARENA = { x: ISLAND.x, z: ISLAND.z, r: ISLAND.r };

/** Every piece of ground. `part` names it for the renderer. */
export const GROUND: readonly GatedShape[] = [
  { part: 'beach', gate: 'always', shape: disc(0, 33, 5.5) },
  { part: 'beach-path', gate: 'always', shape: path({ x: 0, z: 27.5 }, { x: 0, z: 23 }, 2.4) },
  { part: 'hub', gate: 'always', shape: disc(HUB.x, HUB.z, HUB.r) },
  { part: 'shell-pier', gate: 'always', shape: path({ x: -8, z: 20 }, { x: -15.5, z: 26 }, 1.8) },
  { part: 'shell-end', gate: 'always', shape: disc(-16.8, 27.2, 3.2) },
  { part: 'wave-pier', gate: 'always', shape: path({ x: 8, z: 20 }, { x: 15.5, z: 26 }, 1.8) },
  { part: 'wave-end', gate: 'always', shape: disc(16.8, 27.2, 3.2) },
  { part: 'north-strip', gate: 'always', shape: path({ x: 0, z: 5 }, { x: 0, z: -9 }, 2.6) },
  { part: 'star-jetty', gate: 'always', shape: path({ x: 0, z: -2.5 }, { x: 7.2, z: -5.6 }, 1.6) },
  { part: 'star-end', gate: 'always', shape: disc(8.0, -6.0, 2.7) },
  { part: 'causeway-foot', gate: 'always', shape: disc(0, -11, 3.4) },
  { part: 'flats-path', gate: 'low', shape: path({ x: -10, z: 14 }, { x: -24, z: 11 }, 2.4) },
  { part: 'flats', gate: 'low', shape: disc(FLATS.x, FLATS.z, FLATS.r) },
  { part: 'ferry-deck', gate: 'high', shape: path({ x: 10.5, z: 13 }, { x: 27, z: 10 }, 2.3) },
  { part: 'wreck', gate: 'always', shape: disc(WRECK.x, WRECK.z, WRECK.r) },
  { part: 'causeway', gate: 'causeway', shape: path({ x: 0, z: -12 }, { x: 0, z: -34 }, 2.3) },
  { part: 'island', gate: 'always', shape: disc(ISLAND.x, ISLAND.z, ISLAND.r) },
  { part: 'cave-path', gate: 'low', shape: path({ x: -6.5, z: -50 }, { x: -14.5, z: -56 }, 1.9) },
  { part: 'cave', gate: 'low', shape: disc(CAVE.x, CAVE.z, CAVE.r) },
  // v2.33
  { part: 'cove-path', gate: 'always', shape: path({ x: -4.5, z: 35 }, { x: -29, z: 41 }, 1.9) },
  { part: 'cove', gate: 'always', shape: disc(COVE.x, COVE.z, COVE.r) },
  { part: 'tern-bar', gate: 'high', shape: path({ x: 4.5, z: 35 }, { x: 31, z: 41 }, 1.8) },
  { part: 'tern', gate: 'high', shape: disc(TERN.x, TERN.z, TERN.r) },
  { part: 'beacon-path', gate: 'always', shape: path({ x: 6.5, z: -47 }, { x: 19, z: -52 }, 1.9) },
  { part: 'beacon', gate: 'always', shape: disc(BEACON.x, BEACON.z, BEACON.r) },
];

/** The ground that exists with these gates. */
export const floorFor = (g: ShoreGates): FloorShape[] => GROUND.filter(p => open(p.gate, g)).map(p => p.shape);

function sdShape(s: FloorShape, x: number, z: number): number {
  if (s.kind === 'disc') return Math.hypot(x - s.x, z - s.z) - s.r;
  const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z, t = Math.min(1, Math.max(0, ((x - s.a.x) * abx + (z - s.a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (s.a.x + abx * t), z - (s.a.z + abz * t)) - s.r;
}
/** Signed distance to the walkable ground: negative on it, 0 at the edge, positive in the sea. */
export function floorDistance(g: ShoreGates, x: number, z: number): number {
  let best = Infinity;
  for (const p of GROUND) if (open(p.gate, g)) { const d = sdShape(p.shape, x, z); if (d < best) best = d; }
  return best;
}
export const onFloor = (g: ShoreGates, x: number, z: number, margin = 0): boolean => floorDistance(g, x, z) <= -margin;

/** The hero (and anything else) is kept this far from the water's edge. */
export const WALL_MARGIN = 0.5;

/** Nearest point on the ground that is at least `margin` from the edge. A point already there is returned unchanged. */
export function clampToFloor(g: ShoreGates, x: number, z: number, margin = WALL_MARGIN): Vec2 {
  if (floorDistance(g, x, z) <= -margin) return { x, z };
  let best: Vec2 = { x: SHORE_SPAWN.x, z: SHORE_SPAWN.z }, bestMove = Infinity;
  for (const p of GROUND) {
    if (!open(p.gate, g)) continue;
    const s = p.shape; let cx: number, cz: number;
    if (s.kind === 'disc') { cx = s.x; cz = s.z; } else {
      const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z, t = Math.min(1, Math.max(0, ((x - s.a.x) * abx + (z - s.a.z) * abz) / (abx * abx + abz * abz)));
      cx = s.a.x + abx * t; cz = s.a.z + abz * t;
    }
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), keep = Math.max(0.01, s.r - margin);
    const px = d < 1e-6 ? cx : cx + (dx / d) * keep, pz = d < 1e-6 ? cz : cz + (dz / d) * keep;
    const move = Math.hypot(px - x, pz - z);
    if (move < bestMove) { bestMove = move; best = { x: px, z: pz }; }
  }
  return best;
}

// ------------------------------------------------------------------------------------------------------------------ colliders
/** Stilt huts of the village (solid): they shape the paths. */
export const HUTS: readonly Collider[] = [{ x: -8.6, z: 8.6, r: 2.0 }, { x: 8.4, z: 5.8, r: 1.9 }, { x: -4.8, z: 22.4, r: 1.6 }, { x: 4.6, z: 20.4, r: 1.7 }, { x: 0.2, z: 3.8, r: 1.6 }];
/** Driftwood, wreck ribs and rocks in the wreck graveyard; boulders on the flats; lighthouse and keeper's hut. */
export const SCENERY: readonly Collider[] = [
  { x: 32, z: 6.8, r: 2.0 }, { x: 40.6, z: 3.2, r: 2.2 }, { x: 36, z: 12.5, r: 1.3 }, { x: 45, z: -1.5, r: 1.2 }, { x: 31, z: -2, r: 1.0 },
  { x: -32.5, z: 5.5, r: 1.2 }, { x: -41, z: 8, r: 1.3 }, { x: -34, z: 14, r: 1.0 }, { x: -27, z: 7, r: 0.9 }, { x: -45, z: 10, r: 1.0 },
  { x: LIGHTHOUSE_POS.x, z: LIGHTHOUSE_POS.z, r: 3.1 }, { x: -9.4, z: -38.4, r: 1.8 }, { x: 6.4, z: -38.5, r: 1.0 }, { x: -16.8, z: -61.5, r: 1.0 }, { x: -22.5, z: -55.8, r: 1.2 },
  // v2.33: rocks and driftwood in the cove, on Tern Rock and on Beacon Rock
  { x: -39, z: 40, r: 1.2 }, { x: -29.5, z: 44.5, r: 1.0 }, { x: 39, z: 43, r: 1.1 }, { x: 31.5, z: 37, r: 0.9 }, { x: 28.5, z: -57, r: 1.1 }, { x: 21, z: -57.5, r: 0.9 },
];
export const STATIC_COLLIDERS: readonly Collider[] = [
  ...HUTS, ...SCENERY,
  ...BUOYS.map(b => ({ x: BUOY_SPOTS[b].x, z: BUOY_SPOTS[b].z, r: 0.75 })),
  { x: TIDE_BOARD_POS.x, z: TIDE_BOARD_POS.z, r: 0.8 }, { x: MAK_POS.x, z: MAK_POS.z, r: 0.5 }, { x: KEEPER_POS.x, z: KEEPER_POS.z, r: 0.5 },
  ...BOTTLE_SPOTS.map(p => ({ x: p.x, z: p.z, r: 0.45 })),
];
export const shoreColliders = (): Collider[] => [...STATIC_COLLIDERS];
export const shoreGrid = (): ColliderGrid => new ColliderGrid(shoreColliders());

/** How far a ray from (ox, oz) along the unit direction stays over ground (plus slack), capped: keeps the camera from drifting far out to sea. */
export function floorRayClear(g: ShoreGates, ox: number, oz: number, dx: number, dz: number, maxDist: number, slack = 5): number {
  for (let d = 0.5; d <= maxDist; d += 0.5) if (floorDistance(g, ox + dx * d, oz + dz * d) > slack) return Math.max(0, d - 0.5);
  return maxDist;
}

/** Keeps something that must stay on the lighthouse island (the Heron) inside it. */
export function clampToArena(x: number, z: number, margin = 1.6): Vec2 {
  const c = SHORE_ARENA, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), max = c.r - margin;
  return d <= max ? { x, z } : { x: c.x + (dx / d) * max, z: c.z + (dz / d) * max };
}

// ------------------------------------------------------------------------------------------------------------------ decoration
export interface HutSpec { x: number; z: number; r: number; rot: number; roof: number }
export interface ShoreDecor { huts: HutSpec[]; pebbles: { x: number; z: number; s: number; tone: number; rot: number }[]; reeds: { x: number; z: number; s: number; rot: number }[] }
/** Where the renderer scatters pebbles (flats and wrecks) and reeds (hub edges): deterministic, always on the ground that exists with the gate that owns it. */
export function buildShoreDecor(seed = 2029): ShoreDecor {
  const rnd = mulberry32(seed);
  const huts: HutSpec[] = HUTS.map((h, i) => ({ x: h.x, z: h.z, r: h.r, rot: (i * 1.3) % 6.28, roof: i % 3 }));
  const pebbles: ShoreDecor['pebbles'] = [], reeds: ShoreDecor['reeds'] = [];
  const all: ShoreGates = { tide: 'low', causeway: true };
  for (let i = 0, ok = 0; i < 9000 && ok < 190; i++) {
    const x = -52 + rnd() * 104, z = -66 + rnd() * 120;
    if (!(onFloor(all, x, z, 0.2) && (Math.hypot(x - FLATS.x, z - FLATS.z) < FLATS.r - 0.5 || Math.hypot(x - WRECK.x, z - WRECK.z) < WRECK.r - 0.5 || Math.hypot(x - CAVE.x, z - CAVE.z) < CAVE.r - 0.5 || Math.hypot(x - COVE.x, z - COVE.z) < COVE.r - 0.5 || Math.hypot(x - BEACON.x, z - BEACON.z) < BEACON.r - 0.5))) continue;
    if (STATIC_COLLIDERS.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.3)) continue;
    pebbles.push({ x, z, s: 0.12 + rnd() * 0.22, tone: rnd(), rot: rnd() * 6.28 }); ok++;
  }
  for (let i = 0, ok = 0; i < 4000 && ok < 40; i++) {
    const x = -14 + rnd() * 28, z = 3 + rnd() * 26, d = floorDistance(all, x, z);
    if (d > -0.3 || d < -1.1) continue;
    if (STATIC_COLLIDERS.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.4)) continue;
    reeds.push({ x, z, s: 0.7 + rnd() * 0.7, rot: rnd() * 6.28 }); ok++;
  }
  return { huts, pebbles, reeds };
}

// ------------------------------------------------------------------------------------------------------------------ reachability
/** Everything the hero must be able to walk to, with the gates it needs (so the tests can prove the tide never traps anybody). */
export interface MustReach { name: string; p: Vec2; /** the least that must be true for it to be reachable */ needs: ShoreGates }
const ANY: ShoreGates = { tide: 'still', causeway: false };
const LOW: ShoreGates = { tide: 'low', causeway: false };
const HIGH: ShoreGates = { tide: 'high', causeway: false };
const SOLVED_LOW: ShoreGates = { tide: 'low', causeway: true };
const SOLVED_STILL: ShoreGates = { tide: 'still', causeway: true };
/** The least each pickup/creature needs (index = id): the first ones are the v2.29 places; v2.33 adds the cove (always), Tern Rock (high tide) and Beacon Rock (causeway). */
export const BOTTLE_NEEDS: readonly ShoreGates[] = [LOW, HIGH, SOLVED_LOW, ANY, HIGH, SOLVED_STILL];
export const CRAB_NEEDS: readonly ShoreGates[] = [LOW, LOW, LOW, HIGH, HIGH, ANY, ANY];
export const GULL_NEEDS: readonly ShoreGates[] = [LOW, HIGH, HIGH, SOLVED_STILL, HIGH, SOLVED_STILL];
export function shoreMustReach(): MustReach[] {
  return [
    { name: 'board', p: { x: TIDE_BOARD_POS.x - 1.5, z: TIDE_BOARD_POS.z + 2.0 }, needs: ANY },
    { name: 'mak', p: { x: MAK_POS.x + 1.5, z: MAK_POS.z + 0.8 }, needs: ANY },
    ...BUOYS.map(b => ({ name: `buoy ${b}`, p: BUOY_STAND[b], needs: ANY })),
    { name: 'exit', p: { x: SHORE_EXIT.x, z: SHORE_EXIT.z }, needs: ANY },
    { name: 'glass 0', p: GLASS_SPOTS[0], needs: ANY }, { name: 'glass 1', p: GLASS_SPOTS[1], needs: ANY },
    ...[2, 3, 4].map(i => ({ name: `glass ${i}`, p: GLASS_SPOTS[i], needs: LOW })),
    ...[5, 6].map(i => ({ name: `glass ${i}`, p: GLASS_SPOTS[i], needs: HIGH })),
    { name: 'glass 7', p: GLASS_SPOTS[7], needs: SOLVED_LOW },
    ...BOTTLE_SPOTS.map((p, i) => ({ name: `bottle ${i}`, p: { x: p.x + BOTTLE_APPROACH[i].x, z: p.z + BOTTLE_APPROACH[i].z }, needs: BOTTLE_NEEDS[i] })),
    ...CRAB_SPOTS.map((p, i) => ({ name: `crab ${i}`, p, needs: CRAB_NEEDS[i] })),
    ...GULL_SPOTS.map((p, i) => ({ name: `gull ${i}`, p, needs: GULL_NEEDS[i] })),
    { name: 'keeper', p: { x: KEEPER_POS.x + 1.6, z: KEEPER_POS.z + 0.8 }, needs: SOLVED_STILL },
    { name: 'lamp', p: { x: LAMP_POS.x, z: LAMP_POS.z + 1.0 }, needs: SOLVED_STILL },
    { name: 'heron', p: HERON_POS, needs: SOLVED_STILL },
  ];
}
