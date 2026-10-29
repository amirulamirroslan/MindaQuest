/**
 * Crystal Hollow encounters (v2.28, pure and unit-tested): which creatures exist for a given save, where a knocked-out hero starts again,
 * and what the Use button would act on. `Game3D` only turns these answers into models and effects.
 *
 * Persistence rules (the same ideas as the woods): a Shardling that was calmed stays calm forever (its id is saved); the Warden is there
 * from the moment the Heart Door opens until it is beaten. Leaving the cave and coming back, or fainting, brings back exactly the creatures
 * that are still owed, at full health, and nothing that has been paid.
 */
import type { Vec2 } from './movement3d';
import {
  DOOR_POS, ECHO_COLORS, ECHO_RANGE, ECHO_SPOTS, GLIM_POS, GLIM_RANGE, HEART_POS, HEART_RANGE, SHARDLING_SPOTS, TABLET_RANGE, TABLET_SPOTS, WARDEN_CHECKPOINT, WARDEN_POS, type EchoColor,
} from './hollowLayout';
import { wardenAwake, type HollowState } from './hollowQuest';

export interface HollowSpawn { kind: 'shardling' | 'warden'; at: Vec2; /** index into SHARDLING_SPOTS for a Shardling; 0 for the Warden */ tag: number }

/** Every creature that should exist now. */
export function hollowSpawns(h: HollowState): HollowSpawn[] {
  const out: HollowSpawn[] = [];
  SHARDLING_SPOTS.forEach((at, tag) => { if (!h.shardlings.includes(tag)) out.push({ kind: 'shardling', at, tag }); });
  if (wardenAwake(h)) out.push({ kind: 'warden', at: WARDEN_POS, tag: 0 });
  return out;
}

/**
 * Where to start again after being knocked out. Normally the cave mouth; but if the hero fell beyond the Heart Door (in the corridor or the
 * chamber) while the Warden is still to be beaten, just inside the door, so a retry is a short walk.
 */
export function hollowCheckpoint(h: HollowState, at: Vec2, spawn: Vec2): Vec2 {
  if (wardenAwake(h) && at.z < DOOR_POS.z + 4 && Math.abs(at.x) < 12) return { ...WARDEN_CHECKPOINT };
  return { ...spawn };
}

export type HollowTarget =
  | { kind: 'echo'; color: EchoColor } | { kind: 'heart' } | { kind: 'glim' } | { kind: 'tablet'; id: number };

/** What the hero is close enough to use or talk to (null = nothing). The Heartstone only answers once the Warden has been beaten. */
export function hollowTargetAt(h: HollowState, p: Vec2): HollowTarget | null {
  const d = (q: Vec2): number => Math.hypot(p.x - q.x, p.z - q.z);
  if (!h.doorOpen) for (const c of ECHO_COLORS) if (d(ECHO_SPOTS[c]) < ECHO_RANGE) return { kind: 'echo', color: c };
  if (h.doorOpen && h.wardenDefeated && !h.heartDone && d(HEART_POS) < HEART_RANGE) return { kind: 'heart' };
  if (d(GLIM_POS) < GLIM_RANGE) return { kind: 'glim' };
  for (let i = 0; i < TABLET_SPOTS.length; i++) if (d(TABLET_SPOTS[i]) < TABLET_RANGE) return { kind: 'tablet', id: i };
  return null;
}
