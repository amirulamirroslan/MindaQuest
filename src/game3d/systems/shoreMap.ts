/**
 * The Moonwake Shore map (v2.29, pure and unit-tested; the canvas drawing is in ui/MapPanel.ts). Same convention as the other maps: north
 * (-z) is up. The square covers the whole coast with a little margin and is centred on it rather than on the world origin.
 */
import {
  BEACON, BUOYS, BUOY_SPOTS, BOTTLE_SPOTS, CAVE, COVE, FLATS, TERN, HUB, ISLAND, LAMP_POS, MAK_POS, SHORE_EXIT, TIDE_BOARD_POS, WRECK, type BuoyId,
} from './shoreLayout';
import type { Vec2 } from './movement3d';
import { SONGS, causewayOpen, tideSolved, type ShoreState } from './shoreQuest';

export const SHORE_MAP = { cx: 0, cz: -9, half: 62 };
export function toShoreMap(x: number, z: number, size: number): { px: number; py: number } {
  const k = size / 2 / SHORE_MAP.half;
  return { px: size / 2 + (x - SHORE_MAP.cx) * k, py: size / 2 + (z - SHORE_MAP.cz) * k };
}
export function fromShoreMap(px: number, py: number, size: number): Vec2 {
  const k = size / 2 / SHORE_MAP.half;
  return { x: (px - size / 2) / k + SHORE_MAP.cx, z: (py - size / 2) / k + SHORE_MAP.cz };
}

export type ShoreLandmarkKind = 'beach' | 'village' | 'flats' | 'wreck' | 'island' | 'cave' | 'cove' | 'tern' | 'beacon';
export interface ShoreLandmark { kind: ShoreLandmarkKind; x: number; z: number }
export const SHORE_LANDMARKS: readonly ShoreLandmark[] = [
  { kind: 'beach', x: SHORE_EXIT.x, z: SHORE_EXIT.z - 2 }, { kind: 'village', x: HUB.x, z: HUB.z - 1 }, { kind: 'flats', x: FLATS.x + 1, z: FLATS.z + 3 },
  { kind: 'wreck', x: WRECK.x - 2, z: WRECK.z + 4 }, { kind: 'island', x: ISLAND.x + 5.5, z: ISLAND.z + 2 }, { kind: 'cave', x: CAVE.x, z: CAVE.z + 1 },
  { kind: 'cove', x: COVE.x, z: COVE.z + 4.5 }, { kind: 'tern', x: TERN.x, z: TERN.z + 4.5 }, { kind: 'beacon', x: BEACON.x, z: BEACON.z + 3.5 },
];
export const BUOY_MARKS: readonly { id: BuoyId; x: number; z: number }[] = BUOYS.map(id => ({ id, x: BUOY_SPOTS[id].x, z: BUOY_SPOTS[id].z }));

/**
 * The star(s) for the current step: Mak Long at the start, then the Tide Board until it has been read, then the next bell of the song being
 * rung (or the first bell of the song still to learn), then the lamp once the Heron is calm, else the island. Nothing once the lamp is lit.
 */
export function shoreTargets(s: ShoreState, attempt: readonly BuoyId[], boardSeen: boolean): Vec2[] {
  if (s.lampLit) return [];
  if (s.mak === 0) return [MAK_POS];
  if (!causewayOpen(s)) {
    if (!boardSeen && !tideSolved(s)) return [TIDE_BOARD_POS];
    const want = s.songs.includes('ebb') ? SONGS.flood : SONGS.ebb;
    const idx = Math.min(attempt.length, want.length - 1);
    return [BUOY_SPOTS[want[idx]]];
  }
  return s.heronDefeated ? [LAMP_POS] : [{ x: ISLAND.x, z: ISLAND.z + 4 }];
}
/** The message bottles for the map: only drawn once read, so finding them is still a discovery. */
export const readBottles = (s: ShoreState): Vec2[] => BOTTLE_SPOTS.filter((_, i) => s.bottles.includes(i));
