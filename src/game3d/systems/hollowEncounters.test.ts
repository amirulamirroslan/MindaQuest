import { describe, expect, it } from 'vitest';
import { hollowCheckpoint, hollowSpawns, hollowTargetAt } from './hollowEncounters';
import { calmShardling, defeatWarden, newHollow } from './hollowQuest';
import { DOOR_POS, ECHO_SPOTS, GLIM_POS, HEART_POS, HOLLOW_SPAWN, SHARDLING_SPOTS, TABLET_SPOTS, WARDEN_CHECKPOINT, WARDEN_POS } from './hollowLayout';

describe('hollow encounters', () => {
  it('starts with six Shardlings and no Warden, and brings back only the creatures that are still owed', () => {
    let h = newHollow(); let s = hollowSpawns(h); expect(s.filter(x => x.kind === 'shardling')).toHaveLength(6); expect(s.some(x => x.kind === 'warden')).toBe(false);
    expect(s.map(x => x.tag)).toEqual([0, 1, 2, 3, 4, 5]); s.forEach(x => expect(x.at).toEqual(SHARDLING_SPOTS[x.tag]));
    h = calmShardling(calmShardling(h, 1).state, 4).state; s = hollowSpawns(h); expect(s.map(x => x.tag)).toEqual([0, 2, 3, 5]); // a calmed one stays calm after a faint or a return visit
  });
  it('wakes the Warden when the door opens and never again once it is beaten', () => {
    let h = { ...newHollow(), doorOpen: true }; expect(hollowSpawns(h).find(x => x.kind === 'warden')?.at).toEqual(WARDEN_POS);
    h = defeatWarden(h).state; expect(hollowSpawns(h).some(x => x.kind === 'warden')).toBe(false);
    expect(hollowSpawns({ ...newHollow(), heartDone: true, doorOpen: true, wardenDefeated: true }).some(x => x.kind === 'warden')).toBe(false); // a finished save never meets it
    expect(hollowSpawns({ ...newHollow(), doorOpen: false }).some(x => x.kind === 'warden')).toBe(false);
  });
  it('restarts a hero knocked out at the Warden just inside the door, and anyone else at the cave mouth', () => {
    const open = { ...newHollow(), doorOpen: true };
    expect(hollowCheckpoint(open, { x: 0, z: -26 }, HOLLOW_SPAWN)).toEqual(WARDEN_CHECKPOINT);
    expect(hollowCheckpoint(open, { x: 1, z: DOOR_POS.z + 2 }, HOLLOW_SPAWN)).toEqual(WARDEN_CHECKPOINT);
    expect(hollowCheckpoint(open, { x: 30, z: -5 }, HOLLOW_SPAWN)).toEqual(HOLLOW_SPAWN);            // fell to a Shardling in the pool room: the normal start
    expect(hollowCheckpoint(open, { x: 0, z: 20 }, HOLLOW_SPAWN)).toEqual(HOLLOW_SPAWN);
    expect(hollowCheckpoint(newHollow(), { x: 0, z: -10 }, HOLLOW_SPAWN)).toEqual(HOLLOW_SPAWN);     // door shut: nothing to retry
    expect(hollowCheckpoint(defeatWarden(open).state, { x: 0, z: -26 }, HOLLOW_SPAWN)).toEqual(HOLLOW_SPAWN);
  });
  it('offers Glim, tablets and crystals by distance, and the Heartstone only once the Warden is down', () => {
    const h = newHollow();
    expect(hollowTargetAt(h, GLIM_POS)).toEqual({ kind: 'glim' }); expect(hollowTargetAt(h, { x: GLIM_POS.x + 9, z: GLIM_POS.z })).toBeNull();
    TABLET_SPOTS.forEach((p, i) => expect(hollowTargetAt(h, p)).toEqual({ kind: 'tablet', id: i }));
    expect(hollowTargetAt(h, { x: ECHO_SPOTS.gold.x + 1, z: ECHO_SPOTS.gold.z })).toEqual({ kind: 'echo', color: 'gold' });
    expect(hollowTargetAt({ ...h, doorOpen: true }, { x: ECHO_SPOTS.gold.x + 1, z: ECHO_SPOTS.gold.z })).toBeNull(); // the crystals go quiet once the door is open
    const near = { x: HEART_POS.x, z: HEART_POS.z + 2 };
    expect(hollowTargetAt({ ...h, doorOpen: true }, near)).toBeNull();                                    // the Warden still guards it
    expect(hollowTargetAt({ ...h, doorOpen: true, wardenDefeated: true }, near)).toEqual({ kind: 'heart' });
    expect(hollowTargetAt({ ...h, doorOpen: true, wardenDefeated: true, heartDone: true }, near)).toBeNull();
  });
});
