/**
 * The woods map (v2.10, pure and unit-tested; the canvas drawing lives in ui/MapPanel.ts). North is up, so world -z is the top of the
 * map and +z the bottom (the village). It shows landmarks, the hero with the way they face, and where the current quest step is.
 */
import { ANCIENT_TREE_POS, CAMP_POS, ELDER_POS, FAIRY_RING_POS, MOONLIT_GATE_POS, PETAL_SPOTS, POND_POS, RUNE_STONE_POS } from './layout3d';
import type { Vec2 } from './movement3d';
import { PLAY_RADIUS, RUINS, VILLAGE, WORLD_RADIUS } from './worldShape';
import type { Progress } from './woodsQuest';

export type LandmarkKind = 'village' | 'ruins' | 'pond' | 'camp' | 'tree' | 'fairy' | 'stone' | 'gate';
export interface Landmark { kind: LandmarkKind; x: number; z: number }

/** Where each named place is. Labels come from the language strings by `kind`. */
export const LANDMARKS: readonly Landmark[] = [
  { kind: 'village', x: VILLAGE.x, z: VILLAGE.z }, { kind: 'ruins', x: RUINS.x, z: RUINS.z },
  { kind: 'pond', x: POND_POS.x, z: POND_POS.z }, { kind: 'camp', x: CAMP_POS.x, z: CAMP_POS.z },
  { kind: 'tree', x: ANCIENT_TREE_POS.x, z: ANCIENT_TREE_POS.z }, { kind: 'fairy', x: FAIRY_RING_POS.x, z: FAIRY_RING_POS.z },
  { kind: 'stone', x: RUNE_STONE_POS.x, z: RUNE_STONE_POS.z }, { kind: 'gate', x: MOONLIT_GATE_POS.x, z: MOONLIT_GATE_POS.z },
];

/** Half-width of the map in world metres (the whole hill ring plus a little margin). */
export const MAP_EXTENT = WORLD_RADIUS + 2;

/** World metres to pixels on a square canvas `size` px wide (north up). */
export function toMap(x: number, z: number, size: number): { px: number; py: number } {
  const k = size / 2 / MAP_EXTENT;
  return { px: size / 2 + x * k, py: size / 2 + z * k };
}
/** The inverse of `toMap`, for tests and tap-to-inspect. */
export function fromMap(px: number, py: number, size: number): Vec2 {
  const k = size / 2 / MAP_EXTENT;
  return { x: (px - size / 2) / k, z: (py - size / 2) / k };
}
/** Screen direction (unit) of a hero heading (`headingOf` = atan2(dx, dz), so the nose points to (sin, cos) and map y grows with z). */
export const headingArrow = (heading: number): { dx: number; dy: number } => ({ dx: Math.sin(heading), dy: Math.cos(heading) });

/** Whether a point is inside the walkable woods (used to keep markers on the parchment). */
export const onMap = (p: Vec2): boolean => Math.hypot(p.x, p.z) <= PLAY_RADIUS + 3;

/**
 * The spots that matter for the current step: the Elder, glow petals not yet gathered, the sprouts still calming (their live
 * positions are passed in), the Rune Stone, the ruins, or the Moonlit Gate once it is open.
 */
export function questTargets(p: Progress, liveSprouts: readonly Vec2[]): Vec2[] {
  switch (p.stage) {
    case 'talk': case 'return': return [ELDER_POS];
    case 'petals': return PETAL_SPOTS.filter((_, i) => !p.petalIds.includes(i));
    case 'sprouts': return [...liveSprouts];
    case 'runes': return [RUNE_STONE_POS];
    case 'boss': return [{ x: RUINS.x, z: RUINS.z }];
    case 'complete': return p.gateOpen ? [MOONLIT_GATE_POS] : [ELDER_POS];
  }
}
