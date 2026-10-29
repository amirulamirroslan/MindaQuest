/**
 * v2.31 World expansion: where everything new stands (pure data, unit-tested). Zones, landmarks, pickups, chests, people, gates,
 * and the table of regions the world is laid out to support. The Three.js layer only turns this into meshes.
 */
import type { Vec2 } from './movement3d';
import { MIRROR } from './expansionShape';

export type ZoneId =
  | 'hearthfield' | 'orchard' | 'kite' | 'lookout' | 'mirror' | 'thicket' | 'heartwood' | 'grove' | 'cave' | 'steps' | 'moon' | 'mist';
export interface ZoneDef { id: ZoneId; x: number; z: number; r: number; /** Hidden zones are not on the map until found, and pay more. */ hidden: boolean; xp: number }
export const ZONES: readonly ZoneDef[] = [
  { id: 'orchard', x: 0, z: 52, r: 9, hidden: false, xp: 5 },
  { id: 'hearthfield', x: 0, z: 76, r: 15, hidden: false, xp: 5 },
  { id: 'kite', x: -50, z: 62, r: 12, hidden: false, xp: 5 },
  { id: 'lookout', x: 62, z: 56, r: 12, hidden: false, xp: 5 },
  { id: 'mirror', x: MIRROR.x, z: MIRROR.z, r: 13, hidden: false, xp: 5 },
  { id: 'thicket', x: -66, z: 2, r: 14, hidden: false, xp: 5 },
  { id: 'heartwood', x: -80, z: -26, r: 8, hidden: true, xp: 10 },
  { id: 'grove', x: -52, z: -56, r: 8, hidden: true, xp: 10 },
  { id: 'cave', x: -70, z: -48, r: 6, hidden: true, xp: 10 },
  { id: 'steps', x: 0, z: -78, r: 15, hidden: false, xp: 5 },
  { id: 'moon', x: 30, z: -54, r: 8, hidden: false, xp: 5 },
  { id: 'mist', x: 62, z: -66, r: 7, hidden: false, xp: 5 },
];
export const ZONE_COUNT = ZONES.length;
export const zoneById = (id: string): ZoneDef | undefined => ZONES.find(z => z.id === id);

/** The point where each ring pass crosses the old glade's rim, with the arch or signpost that marks it. */
export interface PassDef { id: string; at: Vec2; facing: number; /** Which path leads on from it. */ path: string }
export const PASSES: readonly PassDef[] = [
  { id: 'south', at: { x: 0, z: 40 }, facing: 0, path: 'orchard-lane' },
  { id: 'east', at: { x: 38, z: 9 }, facing: Math.PI / 2, path: 'pond-road' },
  { id: 'west', at: { x: -42, z: 7.3 }, facing: -Math.PI / 2, path: 'mossbark-trail' },
  { id: 'north', at: { x: -1, z: -44 }, facing: Math.PI, path: 'old-steps-road' },
  { id: 'northeast', at: { x: 17, z: -52 }, facing: Math.PI * 0.7, path: 'mist-road' },
  { id: 'northwest', at: { x: -42, z: -32 }, facing: -Math.PI * 0.75, path: 'fern-trail' },
];

/** Pickups that are collected by walking onto them. */
export const ACORN_SPOTS: readonly Vec2[] = [
  { x: 16, z: 89 }, { x: -16, z: 84 }, { x: 10, z: 56 }, { x: -42, z: 56 }, { x: -60, z: 68 }, { x: 50, z: 48 }, { x: 66, z: 62 },
  { x: 54, z: 4 }, { x: 80, z: 22 }, { x: -58, z: 14 }, { x: -74, z: 6 }, { x: -40, z: -28 }, { x: 24, z: -49 }, { x: 12, z: -72 },
];
export const PUMPKIN_SPOTS: readonly Vec2[] = [{ x: -13, z: 82 }, { x: 14, z: 70 }, { x: 5, z: 90 }, { x: -14, z: 66 }];
export const PEARL_SPOTS: readonly Vec2[] = [{ x: 62, z: 9 }, { x: 74, z: 19 }, { x: 70, z: 6 }, { x: 63, z: 20 }];

/** Things used with the talk/use button. */
export const LANTERN_SPOTS: readonly Vec2[] = [{ x: -62, z: 11 }, { x: -69, z: -5 }, { x: -70.4, z: -17 }];
export const TABLET_SPOTS: readonly Vec2[] = [{ x: -5, z: -70 }, { x: 9, z: -80 }, { x: -11, z: -77 }];
export const CHEST_SPOTS: readonly (Vec2 & { zone: ZoneId; xp: number })[] = [
  { x: MIRROR.x, z: MIRROR.z + 2.4, zone: 'mirror', xp: 15 },
  { x: -73, z: -48, zone: 'cave', xp: 25 },
  { x: -82, z: -22, zone: 'heartwood', xp: 20 },
  { x: 58, z: 52, zone: 'lookout', xp: 20 },
  { x: -6, z: -88, zone: 'steps', xp: 25 },
  { x: -52, z: -61, zone: 'grove', xp: 30 },
  { x: -50, z: 67, zone: 'kite', xp: 15 },
];
export const CHEST_COUNT = CHEST_SPOTS.length;

export interface PersonDef { id: 'tani' | 'lumut' | 'din'; at: Vec2; facing: number }
export const PEOPLE: readonly PersonDef[] = [
  { id: 'tani', at: { x: -3, z: 79 }, facing: 0 },
  { id: 'lumut', at: { x: -58, z: 9 }, facing: -Math.PI / 2 },
  { id: 'din', at: { x: 58, z: 17 }, facing: Math.PI / 2 },
];

/** Signs: a short readable board at a pass or crossroads (pure data: the text is in data/wildsText.ts). */
export const SIGN_SPOTS: readonly (Vec2 & { id: string })[] = [
  { id: 'orchard', x: 3, z: 42 }, { id: 'pond', x: 34, z: 12.5 }, { id: 'thicket', x: -40, z: 11 }, { id: 'steps', x: 2, z: -42 },
  { id: 'mist', x: 16, z: -49 }, { id: 'fern', x: -27.6, z: -15.4 }, { id: 'lookout', x: 18, z: 61 },
];

/** The thorn barrier of the Heartwood shortcut: opens when Kak Lumut has been helped. */
export const THORNS = { x: -46, z: -8, colliders: [{ x: -46, z: -10.4, r: 1.5 }, { x: -46, z: -8.8, r: 1.5 }, { x: -46, z: -7.2, r: 1.5 }, { x: -46, z: -5.6, r: 1.5 }] as const };

export const MIST_GATE = { x: 62, z: -66, trigger: 3.2 };
export const UNDERCROFT_DOOR = { x: 0, z: -92, trigger: 3 };
export const MIRROR_OBELISK = { x: MIRROR.x, z: MIRROR.z - 0.4 };
export const WINDMILL = { x: 12, z: 64 };
export const WATCHTOWER = { x: 62, z: 56 };
export const HEARTWOOD_TREE = { x: -80, z: -26 };
export const MOON_CIRCLE = { x: 30, z: -54, r: 5, stones: 7 };
/** True for a standing stone of the circle that would stand in the Mist Road (the road runs through the circle from west to east). */
export function moonGap(x: number, z: number): boolean {
  // the road goes from (14,-52) to (44,-60) through the centre: its line at this x
  const lineZ = -52 + ((x - 14) / 30) * -8;
  return Math.abs(z - lineZ) < 2.6;
}

/** Buildings of the lower village. Solid circles (r) are added to the colliders. */
export const FARM_HOUSES: readonly { x: number; z: number; r: number; rot: number }[] = [
  { x: -9, z: 70, r: 2.3, rot: 0.4 }, { x: 9, z: 74, r: 2.3, rot: -0.5 }, { x: -7, z: 85, r: 2.3, rot: 0.2 },
];
export const BARN = { x: 10, z: 84, rot: -0.3 };
export const WELL2 = { x: 0, z: 74 };

export type RegionStatus = 'built' | 'planned';
export interface RegionDef { id: string; name: { en: string; ms: string }; status: RegionStatus; /** Where the gate stands in the woods. */ gate: Vec2; note: string }
/**
 * The regions the world is laid out for. `built` ones exist already (the Crystal Hollow is the cave region; Moonwake Shore is the coast).
 * `planned` ones have a real gate in the woods, a path to it and an empty reserved area behind it, and nothing is implemented behind the gate.
 */
export const REGIONS: readonly RegionDef[] = [
  { id: 'crystal-hollow', name: { en: 'Crystal Hollow', ms: 'Gua Hablur' }, status: 'built', gate: { x: -10.5, z: 26 }, note: 'Moonlit Gate beside the village; opens when the woods quest is complete.' },
  { id: 'moonwake-shore', name: { en: 'Moonwake Shore', ms: 'Pantai Moonwake' }, status: 'built', gate: { x: 7.4, z: 19 }, note: 'Driftwood arch in the village square; opens after the Heartstone.' },
  { id: 'mistfall-highlands', name: { en: 'Mistfall Highlands', ms: 'Tanah Tinggi Mistfall' }, status: 'planned', gate: { x: MIST_GATE.x, z: MIST_GATE.z }, note: 'Mistfall Gate at the end of the Mist Road (north-east). Reserved: the mist wall behind it can be replaced by a portal trigger like SHORE_ARCH_TRIGGER.' },
  { id: 'deep-undercroft', name: { en: 'The Undercroft', ms: 'Bawah Tanah Purba' }, status: 'planned', gate: { x: UNDERCROFT_DOOR.x, z: UNDERCROFT_DOOR.z }, note: 'Sealed door at the north end of the Old Steps. Reserved for a deeper cave region.' },
];

/** Every spot the hero must be able to walk to (stand points beside solid things). Used by the reachability test. */
export function expansionMustReach(): { name: string; p: Vec2 }[] {
  const out: { name: string; p: Vec2 }[] = [];
  // the centre of three zones is a landmark (tower, obelisk, great tree), so those are reached at a point beside it
  const beside: Partial<Record<ZoneId, Vec2>> = { lookout: { x: 63, z: 60 }, mirror: { x: 72, z: 14 }, heartwood: { x: -80, z: -20 } };
  for (const z of ZONES) out.push({ name: `zone ${z.id}`, p: beside[z.id] ?? { x: z.x, z: z.z } });
  ACORN_SPOTS.forEach((p, i) => out.push({ name: `acorn ${i}`, p }));
  PUMPKIN_SPOTS.forEach((p, i) => out.push({ name: `pumpkin ${i}`, p }));
  PEARL_SPOTS.forEach((p, i) => out.push({ name: `pearl ${i}`, p }));
  LANTERN_SPOTS.forEach((p, i) => out.push({ name: `lantern ${i}`, p: { x: p.x + 1.3, z: p.z } }));
  TABLET_SPOTS.forEach((p, i) => out.push({ name: `tablet ${i}`, p: { x: p.x, z: p.z + 1.3 } }));
  CHEST_SPOTS.forEach((p, i) => out.push({ name: `chest ${i}`, p: { x: p.x, z: p.z + 1.4 } }));
  PEOPLE.forEach(pe => out.push({ name: `person ${pe.id}`, p: { x: pe.at.x + 1.4, z: pe.at.z + 0.8 } }));
  out.push({ name: 'mist gate', p: { x: MIST_GATE.x - 2.4, z: MIST_GATE.z + 1.2 } }, { name: 'undercroft door', p: { x: UNDERCROFT_DOOR.x, z: UNDERCROFT_DOOR.z + 2.2 } });
  return out;
}
