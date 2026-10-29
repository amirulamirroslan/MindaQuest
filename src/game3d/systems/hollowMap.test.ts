import { describe, expect, it } from 'vitest';
import { HOLLOW_LANDMARKS, HOLLOW_MAP, fromHollowMap, hollowTargets, litGlowcaps, readTablets, toHollowMap } from './hollowMap';
import { ECHO_ORDER, ECHO_SPOTS, GROTTO, SHARD_SPOTS, GLIM_POS, HEART_POS, MURAL_POS, TABLET_SPOTS, onFloor, FLOOR } from './hollowLayout';
import { SECRET_SHARD, SHARD_COUNT, newHollow } from './hollowQuest';

describe('hollow map', () => {
  it('round-trips and keeps the whole cave inside the square', () => {
    const p = toHollowMap(12, -9, 500), q = fromHollowMap(p.px, p.py, 500); expect(q.x).toBeCloseTo(12, 6); expect(q.z).toBeCloseTo(-9, 6);
    for (const s of FLOOR) {
      const [x0, z0, x1, z1] = s.kind === 'disc' ? [s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r] : [Math.min(s.a.x, s.b.x) - s.r, Math.min(s.a.z, s.b.z) - s.r, Math.max(s.a.x, s.b.x) + s.r, Math.max(s.a.z, s.b.z) + s.r];
      for (const [x, z] of [[x0, z0], [x1, z1]]) { const m = toHollowMap(x, z, 500); expect(m.px).toBeGreaterThan(0); expect(m.px).toBeLessThan(500); expect(m.py).toBeGreaterThan(0); expect(m.py).toBeLessThan(500); }
    }
    expect(HOLLOW_MAP.half).toBeGreaterThan(40);
  });
  it('puts every landmark on the floor', () => { for (const l of HOLLOW_LANDMARKS) expect(onFloor(l.x, l.z, 0), l.kind).toBe(true); });
  it('points at the mural, then the crystals in the mural order, then the Heartstone, then nothing', () => {
    const h = newHollow();
    expect(hollowTargets(h, 0, false)).toEqual([MURAL_POS]);
    ECHO_ORDER.forEach((c, i) => expect(hollowTargets(h, i, true)).toEqual([ECHO_SPOTS[c]]));
    expect(hollowTargets({ ...h, doorOpen: true }, 0, true)).toEqual([HEART_POS]); // the Warden is in the Heart Chamber too
    expect(hollowTargets({ ...h, doorOpen: true, wardenDefeated: true }, 0, true)).toEqual([HEART_POS]);
    expect(hollowTargets({ ...h, doorOpen: true, heartDone: true }, 0, true)).toEqual([]);
  });
  it('marks Glim on the map, and shows a tablet only after it has been read', () => {
    expect(HOLLOW_LANDMARKS.find(l => l.kind === 'glim')).toMatchObject({ x: GLIM_POS.x, z: GLIM_POS.z });
    expect(readTablets(newHollow())).toEqual([]); expect(readTablets({ ...newHollow(), tablets: [2] })).toEqual([TABLET_SPOTS[2]]);
  });
  it('shows only the glowcaps that have been lit', () => { expect(litGlowcaps(newHollow())).toEqual([]); expect(litGlowcaps({ ...newHollow(), glowcaps: [1] }).length).toBe(1); });
});

describe('v2.31.3 last shard hint', () => {
  const done = { ...newHollow(), doorOpen: true, wardenDefeated: true, heartDone: true };
  const allButSecret = Array.from({ length: SHARD_COUNT }, (_, i) => i).filter(i => i !== SECRET_SHARD);
  it('points at the grotto, then at the nook shard, once only the secret shard is left', () => {
    expect(hollowTargets({ ...done, shards: allButSecret }, 0, true)).toEqual([{ x: GROTTO.x, z: GROTTO.z }]);
    expect(hollowTargets({ ...done, shards: allButSecret, glowcaps: [0, 1, 2] }, 0, true)).toEqual([SHARD_SPOTS[SECRET_SHARD]]);
  });
  it('shows nothing when other shards are still missing, or when all are found', () => {
    expect(hollowTargets({ ...done, shards: [0] }, 0, true)).toEqual([]);
    expect(hollowTargets({ ...done, shards: [...allButSecret, SECRET_SHARD] }, 0, true)).toEqual([]);
  });
});

describe('v2.32 Deeper Hollow', () => {
  it('draws the three new rooms on the map, inside the square and on the floor', () => {
    for (const k of ['lake', 'gallery', 'vault'] as const) {
      const l = HOLLOW_LANDMARKS.find(m => m.kind === k)!; expect(l, k).toBeTruthy();
      expect(onFloor(l.x, l.z), k).toBe(true);
      const m = toHollowMap(l.x, l.z, 500); expect(m.px).toBeGreaterThan(0); expect(m.px).toBeLessThan(500); expect(m.py).toBeGreaterThan(0); expect(m.py).toBeLessThan(500);
    }
  });
  it('keeps the old shard ids: the secret-nook shard is still 4 and the new shards come after it', () => {
    expect(SECRET_SHARD).toBe(4); expect(SHARD_COUNT).toBe(8);
    expect(SHARD_SPOTS[4]).toEqual({ x: -41.2, z: -21.8 });
  });
});

