import { describe, expect, it } from 'vitest';
import { DEFAULT_OUTFIT, PARTS, defaultOutfit } from '../../game/art/parts';
import { loadOutfit, saveOutfit, OUTFIT_STORAGE_KEY } from '../../game/systems/outfitStore';
import { MESH_GROUPS, resolveOutfitColors, sanitizeEquipment } from './outfit3d';

describe('outfit3d', () => {
  it('maps every mesh group, and the default outfit gives the pack\'s own colours', () => {
    const c = resolveOutfitColors(defaultOutfit());
    expect(Object.keys(c).sort()).toEqual([...MESH_GROUPS].sort());
    expect(c.tunic).toBe(PARTS.tunic.swatches[0].hex); expect(c.blade).toBe(PARTS.steel.swatches[0].hex);
  });
  it('changing a wardrobe part recolours only its mesh groups', () => {
    const a = resolveOutfitColors(defaultOutfit()), b = resolveOutfitColors({ ...DEFAULT_OUTFIT, gear: 2 });
    expect(b.belt).not.toBe(a.belt); expect(b.pack).toBe(b.belt); expect(b.tunic).toBe(a.tunic); expect(b.skin).toBe(a.skin);
  });
  it('a saved 2D outfit (existing storage key) loads unchanged and maps to 3D', () => {
    const mem: Record<string, string> = {};
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    const o = { ...DEFAULT_OUTFIT, tunic: 3, boots: 1 }; saveOutfit(o, store);
    expect(Object.keys(mem)).toEqual([OUTFIT_STORAGE_KEY]);
    expect(resolveOutfitColors(loadOutfit(store)).tunic).toBe(PARTS.tunic.swatches[3].hex);
  });
  it('accessories must be known and unlocked', () => {
    expect(sanitizeEquipment({ back: 'mossy-cloak', head: 'leaf-crown', hand: 'nope' }, [])).toEqual({ head: 'leaf-crown' });
    expect(sanitizeEquipment({ back: 'mossy-cloak' }, ['mossy-cloak'])).toEqual({ back: 'mossy-cloak' });
    expect(sanitizeEquipment('x', [])).toEqual({});
  });
});
