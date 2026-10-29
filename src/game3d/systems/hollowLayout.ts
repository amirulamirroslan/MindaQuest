/**
 * The Crystal Hollow (v2.22): a cave under the hills, reached through the Moonlit Gate. Pure, deterministic and unit-tested; the three.js
 * layer (render/HollowWorld.ts) only turns this into meshes.
 *
 * Unlike the woods (an open disc with trees as obstacles) the Hollow is a set of chambers joined by tunnels, so the walkable floor is
 * described as a union of discs and capped paths (a "capsule" is a segment with a radius). Anything outside is rock. That keeps the area
 * compact: every metre of it is somewhere to go. Convention as in the woods: +z is south (the entrance), -z is north (the Heart Chamber).
 *
 *            Heart Chamber (Heartstone)
 *                    |  Heart Door (opens with the Echo Crystals)
 *   Glowcap Grotto - Lantern Cavern - Echo Pool
 *   (secret nook)    |  \ Pink nook
 *                  Entry landing + the way back to the woods
 *
 * v2.32 "Deeper Hollow": three more rooms. The Moon Vault lies north, behind the Heart Chamber (so the Heart Door and the Warden gate it);
 * the Starlit Lake opens south-east off the Lantern Cavern, and the Moonstone Gallery south-west past the Pink nook. Each has a Moon Shard,
 * and the Gallery and the Vault each carry a Moon Tablet.
 */
import { ColliderGrid, type Collider } from './colliders';
import type { Vec2 } from './movement3d';
import { mulberry32 } from './layout3d';

export type EchoColor = 'gold' | 'blue' | 'pink';
export const ECHO_COLORS: readonly EchoColor[] = ['gold', 'blue', 'pink'];

export type FloorShape = { kind: 'disc'; x: number; z: number; r: number } | { kind: 'path'; a: Vec2; b: Vec2; r: number };
const disc = (x: number, z: number, r: number): FloorShape => ({ kind: 'disc', x, z, r });
const path = (a: Vec2, b: Vec2, r: number): FloorShape => ({ kind: 'path', a, b, r });

// ------------------------------------------------------------------------------------------------------------------ places
export const HOLLOW_SPAWN: Vec2 = { x: 0, z: 33 };
/** Walking into this circle leaves the Hollow for the woods (re-armed only after the hero has stepped away from it). */
export const HOLLOW_EXIT = { x: 0, z: 36.6, r: 1.5 };
export const HUB = { x: 0, z: 13, r: 11 };
export const PRISM_POS: Vec2 = { x: 0, z: 13 };
export const MURAL_POS: Vec2 = { x: -5.4, z: 4.3 };
/** Standing within this distance of the mural counts as having read it. */
export const MURAL_RANGE = 8;
export const DOOR_POS: Vec2 = { x: 0, z: -12 };
export const HEART_POS: Vec2 = { x: 0, z: -27 };
export const HEART_RANGE = 3.2;
export const HEART_CHAMBER = { x: 0, z: -26, r: 8.5 };
export const GROTTO = { x: -31, z: -9, r: 8.5 };
export const POOL_ROOM = { x: 32, z: -5, r: 8.5 };
export const PINK_NOOK = { x: -15, z: 27, r: 4.2 };
export const POOL_WATER = { x: 30, z: -6, r: 3.2 };
export const SECRET_ROOM = { x: -41, z: -22, r: 3.2 };
/** v2.32: the Starlit Lake cavern (south-east), the Moonstone Gallery (south-west) and the Moon Vault (north, behind the Heart Chamber). */
export const LAKE_ROOM = { x: 28, z: 27, r: 8 };
export const GALLERY_ROOM = { x: -35, z: 31, r: 7.5 };
export const VAULT_ROOM = { x: 0, z: -46, r: 7 };

/** The three Echo Crystals. Struck in the order the mural shows, they open the Heart Door. */
export const ECHO_SPOTS: Readonly<Record<EchoColor, Vec2>> = {
  gold: { x: 35.6, z: -1.6 }, blue: { x: -33.4, z: -3.6 }, pink: { x: -17.4, z: 27.6 },
};
/** The order on the mural (and the order they must be struck in). Gold is far east, blue far west, pink near the start: it takes a walk. */
export const ECHO_ORDER: readonly EchoColor[] = ['gold', 'blue', 'pink'];
export const ECHO_RANGE = 2.6;

/** Three glowing mushrooms in the grotto. Touch all three and the crystal wall over the secret nook shatters. */
export const GLOWCAP_SPOTS: readonly Vec2[] = [{ x: -25.5, z: -12.5 }, { x: -31.5, z: -16 }, { x: -37, z: -6.5 }];
export const GLOWCAP_RANGE = 1.9;
/** Moon Shards: two in plain sight, two tucked away, one in the secret nook (index 4); v2.32 adds one in each new room (5 lake, 6 gallery, 7 vault). New ones go at the END so saved ids keep their meaning. */
export const SHARD_SPOTS: readonly Vec2[] = [
  { x: 4.2, z: 35.2 }, { x: -7.2, z: 6.2 }, { x: -19.3, z: 7.0 }, { x: 31.5, z: -12.1 }, { x: -41.2, z: -21.8 },
  { x: 31, z: 30 }, { x: -38, z: 33.5 }, { x: 0, z: -47.5 },
];
export const SHARD_RANGE = 1.3;

// ------------------------------------------------------------------------------------------------------------------ v2.28: Glim, Shardlings, tablets, the Warden
/** Glim, the lantern sprite, hovers just inside the Lantern Cavern, to the right of the way in. */
export const GLIM_POS: Vec2 = { x: 3.2, z: 21 };
export const GLIM_RANGE = 3.2;
/**
 * Where the six Shardlings nest. Three guard the way to the east crystal (east road, pool room twice), three the way to the west crystal
 * (west road, grotto twice), so every Echo Crystal has company. The hub and the entry are safe. Each has a fixed id: a calmed one stays calm.
 */
export const SHARDLING_SPOTS: readonly Vec2[] = [
  { x: 22, z: 8 }, { x: 26.2, z: -2.8 }, { x: 36.5, z: -6.2 },
  { x: -22.5, z: 4 }, { x: -29.5, z: -9.5 }, { x: -34, z: -12 },
];
/** Three carved Moon Tablets, each hidden in a corner of a different part of the cave. The last is in the secret nook. */
export const TABLET_SPOTS: readonly Vec2[] = [{ x: -13, z: 28.9 }, { x: 35, z: -11.2 }, { x: -42.8, z: -23 }, { x: -33.5, z: 26.2 }, { x: 4.2, z: -49.5 }];
export const TABLET_RANGE = 2.3;
/** A spot beside each tablet that the hero can stand on to read it (used by the reachability test): each is on the cave side of its tablet. */
export const TABLET_APPROACH: readonly Vec2[] = [{ x: 1.1, z: -0.6 }, { x: -1.1, z: 0.6 }, { x: 1.1, z: 0.5 }, { x: 0, z: 1.3 }, { x: -1.2, z: 0.6 }];
/** The Hollow Warden sleeps in front of the Heartstone. It cannot leave the Heart Chamber (see `clampToArena`). */
export const WARDEN_POS: Vec2 = { x: 0, z: -23.2 };
/** Where the hero starts again after being knocked out in the corridor or chamber behind the open Heart Door (instead of walking back from the cave mouth). */
export const WARDEN_CHECKPOINT: Vec2 = { x: 0, z: -6.5 };

/** Everything the hero can walk on. */
export const FLOOR: readonly FloorShape[] = [
  disc(0, 33, 5.5), path({ x: 0, z: 27 }, { x: 0, z: 23 }, 2.4), disc(HUB.x, HUB.z, HUB.r),
  path({ x: -8, z: 19 }, { x: -13, z: 25 }, 2.0), disc(PINK_NOOK.x, PINK_NOOK.z, PINK_NOOK.r),
  path({ x: -9, z: 10 }, { x: -19, z: 8 }, 2.1), path({ x: -19, z: 8 }, { x: -26, z: 0 }, 2.1), path({ x: -26, z: 0 }, { x: -28, z: -4 }, 2.1), disc(GROTTO.x, GROTTO.z, GROTTO.r),
  path({ x: 9, z: 10 }, { x: 19, z: 11 }, 2.1), path({ x: 19, z: 11 }, { x: 26, z: 4 }, 2.1), path({ x: 26, z: 4 }, { x: 29, z: -1 }, 2.1), disc(POOL_ROOM.x, POOL_ROOM.z, POOL_ROOM.r),
  path({ x: 0, z: 3 }, { x: 0, z: -19 }, 2.4), disc(HEART_CHAMBER.x, HEART_CHAMBER.z, HEART_CHAMBER.r),
  path({ x: -35, z: -14 }, { x: -39, z: -19 }, 1.7), disc(SECRET_ROOM.x, SECRET_ROOM.z, SECRET_ROOM.r),
  // v2.32: the Starlit Lake (off the hub), the Moonstone Gallery (past the Pink nook) and the Moon Vault (behind the Heart Chamber)
  path({ x: 8, z: 19 }, { x: 22, z: 26 }, 2.1), disc(LAKE_ROOM.x, LAKE_ROOM.z, LAKE_ROOM.r),
  path({ x: -18, z: 28 }, { x: -30, z: 31 }, 2.0), disc(GALLERY_ROOM.x, GALLERY_ROOM.z, GALLERY_ROOM.r),
  path({ x: 0, z: -33 }, { x: 0, z: -40 }, 2.4), disc(VAULT_ROOM.x, VAULT_ROOM.z, VAULT_ROOM.r),
];

/** Signed distance to one shape: negative inside. */
function sdShape(s: FloorShape, x: number, z: number): number {
  if (s.kind === 'disc') return Math.hypot(x - s.x, z - s.z) - s.r;
  const abx = s.b.x - s.a.x, abz = s.b.z - s.a.z, t = Math.min(1, Math.max(0, ((x - s.a.x) * abx + (z - s.a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (s.a.x + abx * t), z - (s.a.z + abz * t)) - s.r;
}
/** Signed distance to the walkable floor: negative inside, 0 on the edge, positive in the rock. */
export function floorDistance(x: number, z: number): number {
  let best = Infinity;
  for (const s of FLOOR) { const d = sdShape(s, x, z); if (d < best) best = d; }
  return best;
}
export const onFloor = (x: number, z: number, margin = 0): boolean => floorDistance(x, z) <= -margin;

/** The hero (and anything else) is kept this far from the rock, so a body never sinks into a wall. */
export const WALL_MARGIN = 0.5;

/** Nearest point on the floor that is at least `margin` inside the rock. A point already there is returned unchanged. */
export function clampToFloor(x: number, z: number, margin = WALL_MARGIN): Vec2 {
  if (floorDistance(x, z) <= -margin) return { x, z };
  let best: Vec2 = { x: HOLLOW_SPAWN.x, z: HOLLOW_SPAWN.z }, bestMove = Infinity;
  for (const s of FLOOR) {
    let cx: number, cz: number;
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

/** How far a ray from (ox, oz) along the unit direction stays over floor (plus a little slack), capped at `maxDist`: keeps the camera inside the cave. */
export function floorRayClear(ox: number, oz: number, dx: number, dz: number, maxDist: number, slack = 0.6): number {
  for (let d = 0.5; d <= maxDist; d += 0.5) if (floorDistance(ox + dx * d, oz + dz * d) > slack) return Math.max(0, d - 0.5);
  return maxDist;
}

// ------------------------------------------------------------------------------------------------------------------ colliders
export interface HollowGates { doorOpen: boolean; secretOpen: boolean }
/** The Heart Door: three overlapping circles across the tunnel. */
export const DOOR_COLLIDERS: readonly Collider[] = [{ x: -1.5, z: DOOR_POS.z, r: 1.05 }, { x: 0, z: DOOR_POS.z, r: 1.05 }, { x: 1.5, z: DOOR_POS.z, r: 1.05 }];
/** The crystal wall over the secret nook. */
export const SECRET_COLLIDERS: readonly Collider[] = [{ x: -36.2, z: -15.5, r: 1.05 }, { x: -35.1, z: -16.4, r: 1.05 }, { x: -37.3, z: -14.6, r: 1.05 }];
/** Dark rock spires standing in the chambers (solid): they shape the paths and give each room a skyline. */
export const STALAGMITES: readonly Collider[] = [
  { x: -5.6, z: 18.8, r: 0.8 }, { x: 6.4, z: 18.2, r: 0.9 }, { x: 5.2, z: 7.4, r: 0.7 }, { x: 0, z: 29.6, r: 0.6 },
  { x: -27.5, z: -4.2, r: 0.8 }, { x: -36.5, z: -10.5, r: 0.7 }, { x: -24.5, z: -7.5, r: 0.6 },
  { x: 26.8, z: -9.5, r: 0.8 }, { x: 37.2, z: -8.8, r: 0.7 }, { x: 25.8, z: 0.8, r: 0.6 },
  { x: -5.8, z: -22, r: 0.8 }, { x: 5.8, z: -22, r: 0.8 }, { x: -6.2, z: -30, r: 0.9 }, { x: 6.2, z: -30, r: 0.9 },
  // v2.32: the new rooms
  { x: 23.5, z: 30, r: 0.8 }, { x: 34, z: 23.8, r: 0.7 }, { x: -40.5, z: 28, r: 0.8 }, { x: -31, z: 35.2, r: 0.6 }, { x: -4.3, z: -44, r: 0.8 }, { x: 5, z: -42.5, r: 0.7 },
];
/** Solid scenery that is always there: the Moon Prism, the pool, the pedestals, the crystals and a few stalagmites that shape the paths. */
export const STATIC_COLLIDERS: readonly Collider[] = [
  { x: PRISM_POS.x, z: PRISM_POS.z, r: 2.3 }, { x: POOL_WATER.x, z: POOL_WATER.z, r: 3.0 }, { x: HEART_POS.x, z: HEART_POS.z, r: 0.95 },
  ...ECHO_COLORS.map(c => ({ x: ECHO_SPOTS[c].x, z: ECHO_SPOTS[c].z, r: 0.7 })), ...GLOWCAP_SPOTS.map(p => ({ x: p.x, z: p.z, r: 0.45 })),
  ...STALAGMITES,
  { x: MURAL_POS.x - 0.9, z: MURAL_POS.z - 0.5, r: 0.55 },
  { x: GLIM_POS.x, z: GLIM_POS.z, r: 0.5 }, ...TABLET_SPOTS.map(p => ({ x: p.x, z: p.z, r: 0.5 })),
];

export function hollowColliders(g: HollowGates): Collider[] {
  return [...STATIC_COLLIDERS, ...(g.doorOpen ? [] : DOOR_COLLIDERS), ...(g.secretOpen ? [] : SECRET_COLLIDERS)];
}
export const hollowGrid = (g: HollowGates): ColliderGrid => new ColliderGrid(hollowColliders(g));

// ------------------------------------------------------------------------------------------------------------------ decoration
export interface WallRock { x: number; z: number; sx: number; sy: number; sz: number; rot: number; tone: number }
export interface CrystalSpec { x: number; z: number; scale: number; rot: number; hue: number; glow: boolean }
export interface HollowDecor { rocks: WallRock[]; crystals: CrystalSpec[] }

/** Colour family of a spot: the hub glows cyan, the grotto green, the pool blue, the Heart Chamber pink-gold. 0..4 indexes the palette in the renderer. */
export function hueIndexAt(x: number, z: number): number {
  const d = (c: { x: number; z: number }) => Math.hypot(x - c.x, z - c.z);
  const rooms: [number, number][] = [[d(HUB), 0], [d(GROTTO), 1], [d(POOL_ROOM), 2], [d(HEART_CHAMBER), 3], [d(PINK_NOOK), 4], [d(LAKE_ROOM), 2], [d(GALLERY_ROOM), 4], [d(VAULT_ROOM), 3]];
  return rooms.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
}

export function buildHollowDecor(seed = 2022): HollowDecor {
  const rnd = mulberry32(seed);
  const rocks: WallRock[] = [], crystals: CrystalSpec[] = [];
  // wall rocks: every cell just outside the floor edge gets a rock, plus a taller second row behind it, so the chambers read as carved out of stone
  const step = 1.3;
  for (let gx = -52; gx <= 48; gx += step) for (let gz = -60; gz <= 45; gz += step) {
    const x = gx + (rnd() - 0.5) * step * 0.8, z = gz + (rnd() - 0.5) * step * 0.8, d = floorDistance(x, z);
    if (d > 0.15 && d < 1.5) rocks.push({ x, z, sx: 0.9 + rnd() * 0.8, sy: 1.6 + rnd() * 1.6, sz: 0.9 + rnd() * 0.8, rot: rnd() * 6.28, tone: rnd() });
    else if (d >= 1.5 && d < 4.2 && rnd() < 0.6) rocks.push({ x, z, sx: 1.4 + rnd() * 1.2, sy: 2.6 + rnd() * 2.4, sz: 1.4 + rnd() * 1.2, rot: rnd() * 6.28, tone: rnd() });
  }
  // crystal clusters growing from the wall base (they overlap the unwalkable margin, so they never need to be solid)
  for (let i = 0, ok = 0; i < 6000 && ok < 95; i++) {
    const x = -46 + rnd() * 88, z = -55 + rnd() * 96, d = floorDistance(x, z);
    if (d > -0.15 || d < -0.9) continue;
    if (Math.hypot(x - HOLLOW_SPAWN.x, z - HOLLOW_SPAWN.z) < 2.2) continue;
    crystals.push({ x, z, scale: 0.55 + rnd() * 0.9, rot: rnd() * 6.28, hue: hueIndexAt(x, z) + (rnd() < 0.25 ? 1 : 0), glow: ok % 3 === 0 });
    ok++;
  }
  return { rocks, crystals };
}

/**
 * Keeps something that must stay in the Heart Chamber (the Warden) inside it, `margin` metres from the wall. Points already inside are
 * returned unchanged.
 */
export function clampToArena(x: number, z: number, margin = 1.6): Vec2 {
  const c = HEART_CHAMBER, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), max = c.r - margin;
  return d <= max ? { x, z } : { x: c.x + (dx / d) * max, z: c.z + (dz / d) * max };
}

/** Everything the player must be able to walk to once both gates are open. Used by the reachability test. */
export function hollowMustReach(): { name: string; p: Vec2 }[] {
  return [
    { name: 'mural', p: { x: MURAL_POS.x + 2.2, z: MURAL_POS.z + 2.2 } },
    ...ECHO_COLORS.map(c => ({ name: `echo ${c}`, p: { x: ECHO_SPOTS[c].x + 1.5, z: ECHO_SPOTS[c].z + 0.8 } })),
    ...GLOWCAP_SPOTS.map((p, i) => ({ name: `glowcap ${i}`, p: { x: p.x + 1.0, z: p.z + 0.4 } })),
    ...SHARD_SPOTS.map((p, i) => ({ name: `shard ${i}`, p })),
    { name: 'heartstone', p: { x: HEART_POS.x, z: HEART_POS.z + 2.3 } },
    { name: 'glim', p: { x: GLIM_POS.x - 1.6, z: GLIM_POS.z + 0.6 } },
    ...TABLET_SPOTS.map((p, i) => ({ name: `tablet ${i}`, p: { x: p.x + TABLET_APPROACH[i].x, z: p.z + TABLET_APPROACH[i].z } })),
    ...SHARDLING_SPOTS.map((p, i) => ({ name: `shardling ${i}`, p })),
    { name: 'exit', p: { x: HOLLOW_EXIT.x, z: HOLLOW_EXIT.z } },
  ];
}
