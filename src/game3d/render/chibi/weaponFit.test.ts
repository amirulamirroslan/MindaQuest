import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../cosmetics/catalog';
import { WEAPON_FIT, fitTransform, isHandSlot, weaponFit } from './weaponFit';

describe('weapon fit (v2.10)', () => {
  it('shrinks about the grip: the grip point (parent origin) does not move', () => {
    // a mesh whose centre sits 0.56 up the hand bone, scale 0.89: the grip is at local y = -0.56/0.89
    const t = fitTransform([0, 0.56, 0], [0.89, 0.89, 0.89], 0.66);
    const gripLocal = (p: number, s: number) => -p / s;
    expect(gripLocal(t.position[1], t.scale[1])).toBeCloseTo(gripLocal(0.56, 0.89), 10);
    expect(t.scale[0]).toBeCloseTo(0.89 * 0.66, 10);
  });
  it('makes swords clearly smaller but never tiny, and leaves unknown nodes alone', () => {
    expect(weaponFit('1H_Sword')).toBeLessThan(0.8);
    for (const k of Object.values(WEAPON_FIT)) { expect(k).toBeGreaterThanOrEqual(0.6); expect(k).toBeLessThanOrEqual(1); }
    expect(weaponFit('Rogue_Body')).toBe(1);
  });
  it('covers every hand-held kit mesh the catalogue can show', () => {
    const handHeld = CATALOG.filter(i => i.slot === 'weapon' || (i.slot === 'offhand' && !i.proc)).flatMap(i => i.kit);
    for (const n of handHeld) expect(WEAPON_FIT[n], n).toBeDefined();
  });
  it('recognises hand slot bones', () => { expect(isHandSlot('handslot.r')).toBe(true); expect(isHandSlot('head')).toBe(false); });
});
