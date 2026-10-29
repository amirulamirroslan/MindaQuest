import { describe, expect, it } from 'vitest';
import { CATALOG } from '../cosmetics/catalog';
import { FRAMES, SLOT_FRAME, distanceFor } from './HeroSnapshot';
import { thumbLoadout } from './ItemThumbs';
import { RARITY_BG } from '../ui/thumbs';

describe('hero pictures (v2.20)', () => {
  it('every slot has a framing and every frame has sane numbers', () => {
    for (const i of CATALOG) expect(FRAMES[SLOT_FRAME[i.slot]], i.id).toBeTruthy();
    for (const f of Object.values(FRAMES)) { expect(f.fit).toBeGreaterThan(0.3); expect(f.fit).toBeLessThan(2); }
  });
  it('camera distance grows with the height to fit and shrinks with a wider lens', () => {
    expect(distanceFor(1, 24)).toBeGreaterThan(distanceFor(0.5, 24));
    expect(distanceFor(1, 40)).toBeLessThan(distanceFor(1, 24));
  });
  it('a thumbnail loadout wears the item, and a two-handed weapon drops the off hand', () => {
    for (const i of CATALOG) expect(thumbLoadout(i).items[i.slot]?.id, i.id).toBe(i.id);
    const great = CATALOG.find(i => i.twoHanded)!; expect(thumbLoadout(great).items.offhand).toBeUndefined();
  });
  it('every rarity has a backdrop', () => { for (const i of CATALOG) expect(RARITY_BG[i.rarity]).toBeTruthy(); });
});
