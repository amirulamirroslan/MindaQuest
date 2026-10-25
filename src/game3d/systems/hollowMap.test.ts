import { describe, expect, it } from 'vitest';
import { HOLLOW_LANDMARKS, HOLLOW_MAP, fromHollowMap, hollowTargets, litGlowcaps, readTablets, toHollowMap } from './hollowMap';
import { ECHO_ORDER, ECHO_SPOTS, GLIM_POS, HEART_POS, MURAL_POS, TABLET_SPOTS, onFloor, FLOOR } from './hollowLayout';
import { newHollow } from './hollowQuest';

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
