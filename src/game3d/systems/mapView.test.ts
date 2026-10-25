import { describe, expect, it } from 'vitest';
import { ELDER_POS, PETAL_SPOTS, RUNE_STONE_POS } from './layout3d';
import { LANDMARKS, MAP_EXTENT, fromMap, headingArrow, onMap, questTargets, toMap } from './mapView';
import { newProgress } from './woodsQuest';
import { PLAY_RADIUS } from './worldShape';

describe('woods map', () => {
  it('puts the centre in the middle, north (-z) at the top and the village (+z) at the bottom', () => {
    expect(toMap(0, 0, 400)).toEqual({ px: 200, py: 200 });
    expect(toMap(0, -20, 400).py).toBeLessThan(200); expect(toMap(0, 25, 400).py).toBeGreaterThan(200);
    expect(toMap(10, 0, 400).px).toBeGreaterThan(200);
  });
  it('round-trips and keeps the whole world on the canvas', () => {
    const p = toMap(12.5, -7, 360); const w = fromMap(p.px, p.py, 360);
    expect(w.x).toBeCloseTo(12.5, 8); expect(w.z).toBeCloseTo(-7, 8);
    const edge = toMap(MAP_EXTENT, MAP_EXTENT, 360); expect(edge.px).toBeCloseTo(360, 6);
  });
  it('every landmark is inside the woods, once each', () => {
    for (const l of LANDMARKS) expect(Math.hypot(l.x, l.z)).toBeLessThan(PLAY_RADIUS);
    expect(new Set(LANDMARKS.map(l => l.kind)).size).toBe(LANDMARKS.length);
  });
  it('the arrow follows the hero heading (0 = facing +z = down the map, pi/2 = +x = right)', () => {
    expect(headingArrow(0).dy).toBeCloseTo(1, 8); expect(headingArrow(Math.PI / 2).dx).toBeCloseTo(1, 8);
  });
  it('quest targets follow the step and drop gathered petals', () => {
    const p = newProgress();
    expect(questTargets({ ...p, stage: 'talk' }, [])).toEqual([ELDER_POS]);
    expect(questTargets({ ...p, stage: 'petals', petalIds: [0, 3] }, [])).toHaveLength(PETAL_SPOTS.length - 2);
    expect(questTargets({ ...p, stage: 'sprouts' }, [{ x: 1, z: 2 }])).toEqual([{ x: 1, z: 2 }]);
    expect(questTargets({ ...p, stage: 'runes' }, [])).toEqual([RUNE_STONE_POS]);
    expect(questTargets({ ...p, stage: 'complete', gateOpen: false }, [])).toEqual([ELDER_POS]);
    expect(onMap({ x: 0, z: 0 })).toBe(true); expect(onMap({ x: 90, z: 0 })).toBe(false);
  });
});
