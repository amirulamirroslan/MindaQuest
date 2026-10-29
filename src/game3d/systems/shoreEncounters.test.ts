import { describe, expect, it } from 'vitest';
import { shoreCheckpoint, shoreSpawns, shoreTargetAt } from './shoreEncounters';
import { BOTTLE_SPOTS, BUOY_SPOTS, CRAB_SPOTS, GULL_SPOTS, HERON_CHECKPOINT, HERON_POS, KEEPER_POS, LAMP_POS, MAK_POS, SHORE_SPAWN, TIDE_BOARD_POS } from './shoreLayout';
import { calmCrab, calmGull, defeatHeron, newShore, type ShoreState } from './shoreQuest';
import { SHORE_MAP, fromShoreMap, shoreTargets, toShoreMap } from './shoreMap';

const solved = (): ShoreState => ({ ...newShore(), tide: 'low', songs: ['ebb', 'flood'] });

describe('moonwake shore encounters', () => {
  it('spawns every crab and gull at the start, and no heron until the causeway is up', () => {
    const s = shoreSpawns(newShore()); expect(s.filter(x => x.kind === 'crab')).toHaveLength(CRAB_SPOTS.length); expect(s.filter(x => x.kind === 'gull')).toHaveLength(GULL_SPOTS.length); expect(s.some(x => x.kind === 'heron')).toBe(false);
  });
  it('never brings back a calmed crab or gull, and keeps the heron until it is calm', () => {
    let s = solved(); s = calmCrab(s, 1).state; s = calmGull(s, 3).state;
    const sp = shoreSpawns(s); expect(sp.some(x => x.kind === 'crab' && x.tag === 1)).toBe(false); expect(sp.some(x => x.kind === 'gull' && x.tag === 3)).toBe(false);
    expect(sp.find(x => x.kind === 'heron')?.at).toEqual(HERON_POS);
    expect(shoreSpawns(defeatHeron(s).state).some(x => x.kind === 'heron')).toBe(false);
  });
  it('restarts a knocked-out hero on the island while the heron is awake, otherwise on the beach', () => {
    expect(shoreCheckpoint(solved(), { x: 0, z: -40 }, SHORE_SPAWN)).toEqual(HERON_CHECKPOINT);
    expect(shoreCheckpoint(solved(), { x: 0, z: 10 }, SHORE_SPAWN)).toEqual(SHORE_SPAWN);
    expect(shoreCheckpoint(defeatHeron(solved()).state, { x: 0, z: -40 }, SHORE_SPAWN)).toEqual(SHORE_SPAWN);
    expect(shoreCheckpoint(newShore(), { x: 0, z: -40 }, SHORE_SPAWN)).toEqual(SHORE_SPAWN);
  });
  it('finds what the hero stands next to, and the lamp only once the heron is calm', () => {
    const near = (p: { x: number; z: number }) => ({ x: p.x + 0.5, z: p.z + 0.5 });
    expect(shoreTargetAt(newShore(), near(BUOY_SPOTS.wave))).toEqual({ kind: 'buoy', id: 'wave' });
    expect(shoreTargetAt(newShore(), near(MAK_POS))).toEqual({ kind: 'mak' }); expect(shoreTargetAt(newShore(), near(KEEPER_POS))).toEqual({ kind: 'keeper' });
    expect(shoreTargetAt(newShore(), near(BOTTLE_SPOTS[2]))).toEqual({ kind: 'bottle', id: 2 }); expect(shoreTargetAt(newShore(), { x: TIDE_BOARD_POS.x, z: TIDE_BOARD_POS.z + 1.5 })).toEqual({ kind: 'board' });
    expect(shoreTargetAt(solved(), near(LAMP_POS))).toBeNull();
    expect(shoreTargetAt(defeatHeron(solved()).state, near(LAMP_POS))).toEqual({ kind: 'lamp' });
    expect(shoreTargetAt(newShore(), { x: 0, z: 33 })).toBeNull();
  });
});

describe('moonwake shore map', () => {
  it('maps points to the square and back, with the whole coast inside it', () => {
    for (const [x, z] of [[0, 33], [-50, 8], [51, 6], [0, -64], [-24, -64]]) { const m = toShoreMap(x, z, 400); expect(m.px).toBeGreaterThan(0); expect(m.px).toBeLessThan(400); expect(m.py).toBeGreaterThan(0); expect(m.py).toBeLessThan(400); const b = fromShoreMap(m.px, m.py, 400); expect(b.x).toBeCloseTo(x, 6); expect(b.z).toBeCloseTo(z, 6); }
    expect(SHORE_MAP.half).toBeGreaterThan(50);
  });
  it('points the star at Mak Long, the board, the bells, the island, the lamp, then nothing', () => {
    let s = newShore(); expect(shoreTargets(s, [], false)).toEqual([MAK_POS]);
    s = { ...s, mak: 1 }; expect(shoreTargets(s, [], false)).toEqual([TIDE_BOARD_POS]);
    expect(shoreTargets(s, [], true)).toEqual([BUOY_SPOTS.wave]); expect(shoreTargets(s, ['wave'], true)).toEqual([BUOY_SPOTS.shell]); expect(shoreTargets(s, ['wave', 'shell'], true)).toEqual([BUOY_SPOTS.star]);
    const one = { ...s, songs: ['ebb' as const], tide: 'low' as const }; expect(shoreTargets(one, [], true)).toEqual([BUOY_SPOTS.star]);    // now the flood song, which starts at the star bell
    const open = { ...s, ...solved(), mak: 1 as const }; expect(shoreTargets(open, [], true)[0].z).toBeLessThan(-30);
    const calm = { ...open, heronDefeated: true }; expect(shoreTargets(calm, [], true)).toEqual([LAMP_POS]); expect(shoreTargets({ ...calm, lampLit: true }, [], true)).toEqual([]);
  });
});

import { buildWorldLayout } from './layout3d';
describe('the woods arch to the shore', () => {
  it('stands on clear ground, away from houses and trees, so nobody is ever stuck behind it', () => {
    const cols = buildWorldLayout().colliders, at = { x: 6.2, z: 19 }, ret = { x: 9.2, z: 19 };
    for (const p of [at, ret]) expect(Math.min(...cols.map(c => Math.hypot(c.x - p.x, c.z - p.z) - c.r)), JSON.stringify(p)).toBeGreaterThan(1.0);
    expect(Math.hypot(ret.x - at.x, ret.z - at.z)).toBeGreaterThan(1.4 + 1.2);   // coming back never lands inside the trigger
  });
});
