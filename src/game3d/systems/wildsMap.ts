/**
 * What the woods map shows of the wider woods (v2.31): pure rules, unit-tested. A named place appears once the hero has seen its square
 * of the map (hidden places only once they are found); treasure chests appear on seen ground, filled until opened.
 */
import { CHEST_SPOTS, UNDERCROFT_DOOR, WINDMILL, ZONES } from './expansion';
import type { WildsLandmarkKind } from '../data/wildsText';
import { exploredAt, type WildsState } from './wildsQuest';

export interface WildsMark { kind: WildsLandmarkKind; x: number; z: number }
export function visibleWildsMarks(s: WildsState): WildsMark[] {
  const out: WildsMark[] = [];
  for (const z of ZONES) if (z.hidden ? s.zones.includes(z.id) : s.zones.includes(z.id) || exploredAt(s, z.x, z.z)) out.push({ kind: z.id, x: z.x, z: z.z });
  if (exploredAt(s, WINDMILL.x, WINDMILL.z)) out.push({ kind: 'mill', x: WINDMILL.x, z: WINDMILL.z });
  if (exploredAt(s, UNDERCROFT_DOOR.x, UNDERCROFT_DOOR.z + 3)) out.push({ kind: 'door', x: UNDERCROFT_DOOR.x, z: UNDERCROFT_DOOR.z });
  return out;
}
/** Chests on ground the hero has seen (a hidden zone's chest only once that zone is found). */
export function visibleChests(s: WildsState): { id: number; x: number; z: number; open: boolean }[] {
  return CHEST_SPOTS.flatMap((c, id) => {
    const hidden = c.zone === 'cave' || c.zone === 'heartwood' || c.zone === 'grove';
    return (hidden ? s.zones.includes(c.zone) : exploredAt(s, c.x, c.z)) ? [{ id, x: c.x, z: c.z, open: s.chests.includes(id) }] : [];
  });
}
