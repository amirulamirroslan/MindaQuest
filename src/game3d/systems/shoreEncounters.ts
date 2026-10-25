/**
 * Moonwake Shore encounters (v2.29, pure and unit-tested): which creatures exist for a given save, where a knocked-out hero starts again, and
 * what the Use button would act on. `Game3D` only turns these answers into models and effects.
 *
 * Persistence rules (the same ideas as the Hollow): a Crab or Gull that was calmed stays calm forever (its id is saved); the Heron is on the
 * island from the moment the causeway rises until it is calmed. Leaving the shore and coming back, or fainting, brings back exactly the
 * creatures that are still owed, at full health, and nothing that has been paid.
 */
import type { Vec2 } from './movement3d';
import {
  BOTTLE_RANGE, BOTTLE_SPOTS, BUOYS, BUOY_RANGE, BUOY_SPOTS, CRAB_SPOTS, GULL_SPOTS, HERON_CHECKPOINT, HERON_POS, KEEPER_POS, KEEPER_RANGE, LAMP_POS, LAMP_RANGE, MAK_POS, MAK_RANGE,
  TIDE_BOARD_POS, BOARD_RANGE, type BuoyId,
} from './shoreLayout';
import { heronAwake, type ShoreState } from './shoreQuest';

export interface ShoreSpawn { kind: 'crab' | 'gull' | 'heron'; at: Vec2; /** index into CRAB_SPOTS / GULL_SPOTS; 0 for the Heron */ tag: number }

/** Every creature that should exist now. */
export function shoreSpawns(s: ShoreState): ShoreSpawn[] {
  const out: ShoreSpawn[] = [];
  CRAB_SPOTS.forEach((at, tag) => { if (!s.crabs.includes(tag)) out.push({ kind: 'crab', at, tag }); });
  GULL_SPOTS.forEach((at, tag) => { if (!s.gulls.includes(tag)) out.push({ kind: 'gull', at, tag }); });
  if (heronAwake(s)) out.push({ kind: 'heron', at: HERON_POS, tag: 0 });
  return out;
}

/** Where to start again after being knocked out: the beach normally; on the island while the Heron is still to be calmed, just where the causeway ends. */
export function shoreCheckpoint(s: ShoreState, at: Vec2, spawn: Vec2): Vec2 {
  if (heronAwake(s) && at.z < HERON_CHECKPOINT.z - 1 && Math.abs(at.x) < 14) return { ...HERON_CHECKPOINT };
  return { ...spawn };
}

export type ShoreTarget =
  | { kind: 'buoy'; id: BuoyId } | { kind: 'board' } | { kind: 'mak' } | { kind: 'keeper' } | { kind: 'lamp' } | { kind: 'bottle'; id: number };

/** What the hero is close enough to use or talk to (null = nothing). The lamp only answers once the Heron has been calmed. */
export function shoreTargetAt(s: ShoreState, p: Vec2): ShoreTarget | null {
  const d = (q: Vec2): number => Math.hypot(p.x - q.x, p.z - q.z);
  for (const b of BUOYS) if (d(BUOY_SPOTS[b]) < BUOY_RANGE) return { kind: 'buoy', id: b };
  if (s.heronDefeated && !s.lampLit && d(LAMP_POS) < LAMP_RANGE) return { kind: 'lamp' };
  if (d(MAK_POS) < MAK_RANGE) return { kind: 'mak' };
  if (d(KEEPER_POS) < KEEPER_RANGE) return { kind: 'keeper' };
  for (let i = 0; i < BOTTLE_SPOTS.length; i++) if (d(BOTTLE_SPOTS[i]) < BOTTLE_RANGE) return { kind: 'bottle', id: i };
  if (d(TIDE_BOARD_POS) < BOARD_RANGE / 2.2) return { kind: 'board' };
  return null;
}
