import { describe, expect, it } from 'vitest';
import { defaultOutfit } from '../art/parts';
import { loadOutfit, OUTFIT_STORAGE_KEY, parseOutfit, saveOutfit } from './outfitStore';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };

describe('outfitStore', () => {
  it('round-trips an outfit', () => {
    const store = memory();
    expect(saveOutfit({ ...defaultOutfit(), tunic: 3, eyes: 2 }, store)).toBe(true);
    expect(loadOutfit(store)).toMatchObject({ tunic: 3, eyes: 2, hood: 0 });
  });
  it('falls back to the default outfit for missing, corrupt or hostile storage', () => {
    expect(loadOutfit(memory())).toEqual(defaultOutfit());
    expect(parseOutfit('not json')).toEqual(defaultOutfit());
    expect(parseOutfit('{"hood": 999, "__proto__": {"x": 1}}')).toEqual(defaultOutfit());
    expect(loadOutfit({ getItem: () => { throw new Error('blocked'); } })).toEqual(defaultOutfit());
    expect(loadOutfit(undefined)).toEqual(defaultOutfit());
  });
  it('reports a refused write instead of throwing', () => {
    expect(saveOutfit(defaultOutfit(), { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(saveOutfit(defaultOutfit(), undefined)).toBe(false);
  });
  it('stores only validated numbers under one key', () => {
    const store = memory();
    saveOutfit({ ...defaultOutfit(), hood: 4 }, store);
    expect([...store.m.keys()]).toEqual([OUTFIT_STORAGE_KEY]);
    expect(JSON.parse(store.m.get(OUTFIT_STORAGE_KEY)!).hood).toBe(4);
  });
});
