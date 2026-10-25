import { describe, expect, it } from 'vitest';
import { BRIDGE_SIGN, LINA_POS, PLAYER_START, SCENERY, START_SIGN, TIMBER_PILE, TIMBER_POSITIONS } from './scenery';
import { projectIsometricPoint } from '../systems/isometric';
import { TIMBER_GOAL } from '../systems/forestQuest';
import { isBridgeZone, isRiverCell } from '../systems/worldGeometry';

const onScreen = (x: number, y: number) => projectIsometricPoint(x, y, 0);
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('hand-placed scene composition', () => {
  it('has exactly one timber position per quest goal, all on dry land', () => {
    expect(TIMBER_POSITIONS).toHaveLength(TIMBER_GOAL);
    for (const [x, y] of TIMBER_POSITIONS) {
      expect(isRiverCell(x, y)).toBe(false);
      expect(isBridgeZone(x, y)).toBe(false);
    }
  });

  it('keeps timber visually apart from each other, from Lina, the start, the pile and every prop', () => {
    const timber = TIMBER_POSITIONS.map(([x, y]) => onScreen(x, y));
    const others = [
      { name: 'Lina', min: 60, ...LINA_POS }, { name: 'start', min: 50, ...PLAYER_START }, { name: 'pile', min: 50, ...TIMBER_PILE },
      { name: 'trail sign', min: 44, ...START_SIGN }, { name: 'bridge sign', min: 44, ...BRIDGE_SIGN },
      ...SCENERY.map((prop) => ({ name: prop.id, min: 40, x: prop.x, y: prop.y })),
    ];
    timber.forEach((piece, i) => {
      for (let j = i + 1; j < timber.length; j++) expect(gap(piece, timber[j]), `timber ${i + 1} vs ${j + 1}`).toBeGreaterThanOrEqual(40);
      for (const other of others) expect(gap(piece, onScreen(other.x, other.y)), `timber ${i + 1} vs ${other.name}`).toBeGreaterThanOrEqual(other.min);
    });
  });

  it('does not stack the trail sign on a fallen log', () => {
    const sign = onScreen(START_SIGN.x, START_SIGN.y);
    for (const prop of SCENERY) expect(gap(sign, onScreen(prop.x, prop.y)), prop.id).toBeGreaterThanOrEqual(40);
  });
});
