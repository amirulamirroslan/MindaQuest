/**
 * The Crystal Hollow map (v2.22, pure and unit-tested; the canvas drawing is in ui/MapPanel.ts). Same convention as the woods map: north (-z)
 * is up. The square covers the whole cave with a little margin and is centred on it rather than on the world origin.
 */
import { ECHO_ORDER, ECHO_SPOTS, DOOR_POS, GLIM_POS, GLOWCAP_SPOTS, GROTTO, TABLET_SPOTS, HEART_POS, HOLLOW_EXIT, MURAL_POS, PINK_NOOK, POOL_ROOM, PRISM_POS, SECRET_ROOM, type EchoColor } from './hollowLayout';
import type { Vec2 } from './movement3d';
import type { HollowState } from './hollowQuest';

export const HOLLOW_MAP = { cx: -2.5, cz: 1.5, half: 47 };

export function toHollowMap(x: number, z: number, size: number): { px: number; py: number } {
  const k = size / 2 / HOLLOW_MAP.half;
  return { px: size / 2 + (x - HOLLOW_MAP.cx) * k, py: size / 2 + (z - HOLLOW_MAP.cz) * k };
}
export function fromHollowMap(px: number, py: number, size: number): Vec2 {
  const k = size / 2 / HOLLOW_MAP.half;
  return { x: (px - size / 2) / k + HOLLOW_MAP.cx, z: (py - size / 2) / k + HOLLOW_MAP.cz };
}

export type HollowLandmarkKind = 'gate' | 'prism' | 'grotto' | 'pool' | 'door' | 'heart' | 'pink' | 'mural' | 'glim';
export interface HollowLandmark { kind: HollowLandmarkKind; x: number; z: number }
export const HOLLOW_LANDMARKS: readonly HollowLandmark[] = [
  { kind: 'gate', x: HOLLOW_EXIT.x, z: HOLLOW_EXIT.z - 1.5 }, { kind: 'prism', x: PRISM_POS.x, z: PRISM_POS.z }, { kind: 'grotto', x: GROTTO.x, z: GROTTO.z + 2 },
  { kind: 'pool', x: POOL_ROOM.x, z: POOL_ROOM.z + 4 }, { kind: 'door', x: DOOR_POS.x, z: DOOR_POS.z }, { kind: 'heart', x: HEART_POS.x, z: HEART_POS.z },
  { kind: 'pink', x: PINK_NOOK.x, z: PINK_NOOK.z + 2.5 }, { kind: 'mural', x: MURAL_POS.x, z: MURAL_POS.z }, { kind: 'glim', x: GLIM_POS.x, z: GLIM_POS.z },
];
/** Where the secret nook is, drawn on the map only once it has been opened. */
export const SECRET_MARK: Vec2 = { x: SECRET_ROOM.x, z: SECRET_ROOM.z };

/**
 * The star(s) for the current step: the mural until it has been read, then the next Echo Crystal in the mural's order (given how many have
 * been struck right so far), then the Heartstone. Nothing once the Heartstone has been touched: the rest is for exploring.
 */
export function hollowTargets(h: HollowState, step: number, muralSeen: boolean): Vec2[] {
  if (!h.doorOpen) {
    if (!muralSeen) return [MURAL_POS];
    const next: EchoColor = ECHO_ORDER[Math.max(0, Math.min(ECHO_ORDER.length - 1, step))];
    return [ECHO_SPOTS[next]];
  }
  return h.heartDone ? [] : [HEART_POS];
}
/** The glowcap mushrooms for the map: only drawn once lit, so the secret is still a discovery. */
/** The Moon Tablets for the map: only drawn once read, so finding them is still a discovery. */
export const readTablets = (h: HollowState): Vec2[] => TABLET_SPOTS.filter((_, i) => h.tablets.includes(i));
export const litGlowcaps = (h: HollowState): Vec2[] => GLOWCAP_SPOTS.filter((_, i) => h.glowcaps.includes(i));
