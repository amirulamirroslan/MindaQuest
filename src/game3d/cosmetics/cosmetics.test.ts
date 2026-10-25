import { readFileSync, existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { CATALOG, COLLECTIONS, COSMETIC_SLOTS, DEFAULT_EQUIPPED, OPTIONAL_SLOTS, RARITIES, itemById, itemsInSlot } from './catalog';
import {
  COSMETICS_STORAGE_KEY, collectionProgress, defaultCosmetics, equip, grant, isOwned, loadCosmetics, lockReason, migrateLegacyEquipment, newlyOwned,
  resetLook, sanitizeCosmetics, saveCosmetics, setTint, statusOf,
} from './inventory';
import { isDualWield, resolveLoadout, visibleKitNodes } from './loadout';
import { TEXT } from '../data/woodsText';

const L1 = { level: 1, unlocked: [] as string[] };
const L9 = { level: 9, unlocked: ['mossy-cloak'] };
const mem = (init: Record<string, string> = {}) => { const m = { ...init }; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, m }; };

describe('catalogue', () => {
  it('has unique ids, valid slots, rarities and collections, and names in both languages', () => {
    expect(new Set(CATALOG.map(i => i.id)).size).toBe(CATALOG.length);
    for (const i of CATALOG) {
      expect(COSMETIC_SLOTS).toContain(i.slot); expect(RARITIES).toContain(i.rarity);
      expect(COLLECTIONS.map(c => c.id)).toContain(i.collection);
      expect(i.name.en.trim() && i.name.ms.trim()).toBeTruthy();
      expect(i.kit.length > 0 || !!i.proc).toBe(true);
    }
  });
  it('gives every slot some free choice and every starter default is free', () => {
    for (const s of COSMETIC_SLOTS) expect(itemsInSlot(s).some(i => i.access.type === 'free')).toBe(true);
    for (const s of COSMETIC_SLOTS) { const id = DEFAULT_EQUIPPED[s]; if (id) expect(itemById(id)?.access.type).toBe('free'); else expect(OPTIONAL_SLOTS).toContain(s); }
  });
  it('has legacy accessories (leaf crown, mossy cloak, glow lantern) so old saves keep them', () => {
    expect(itemById('leaf-crown')?.slot).toBe('headgear'); expect(itemById('mossy-cloak')?.slot).toBe('cape'); expect(itemById('glow-lantern')?.slot).toBe('offhand');
  });
  it('has premium items as data only: never owned, whatever the level, and no way to equip them', () => {
    const premium = CATALOG.filter(i => i.access.type === 'premium'); expect(premium.length).toBeGreaterThan(0);
    const rich = { level: 99, unlocked: ['mossy-cloak', 'anything'] };
    for (const i of premium) { expect(isOwned(i, defaultCosmetics(), rich)).toBe(false); expect(equip(defaultCosmetics(), i.slot, i.id, rich).equipped[i.slot]).not.toBe(i.id); expect(lockReason(i)).toEqual({ kind: 'premium' }); }
  });
  it('names every item in the panel text path (used by the unlock toast)', () => { expect(TEXT.en.accessory['mossy-cloak']).toBeTruthy(); });
  it('has the panel strings in English and Malay, none empty, with the same keys', () => {
    const flat = (o: Record<string, unknown>, pre = ''): string[] => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' && v ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}=${String(v).trim() ? 'ok' : 'EMPTY'}`]);
    const en = flat(TEXT.en.cosmetics), ms = flat(TEXT.ms.cosmetics);
    expect(en).toEqual(ms); expect(en.some(x => x.endsWith('EMPTY'))).toBe(false);
    expect(Object.keys(TEXT.en.cosmetics.slots)).toEqual(Object.keys(TEXT.ms.cosmetics.slots));
  });
});

describe('inventory', () => {
  it('derives ownership from free / level / quest access', () => {
    const s = defaultCosmetics();
    expect(isOwned(itemById('sword-hero')!, s, L1)).toBe(true);
    expect(isOwned(itemById('outfit-guard')!, s, L1)).toBe(false); expect(isOwned(itemById('outfit-guard')!, s, { level: 4, unlocked: [] })).toBe(true);
    expect(isOwned(itemById('mossy-cloak')!, s, L1)).toBe(false); expect(isOwned(itemById('mossy-cloak')!, s, L9)).toBe(true);
    expect(statusOf(itemById('sword-hero')!, s, L1)).toBe('equipped'); expect(statusOf(itemById('dagger-ranger')!, s, L1)).toBe('owned'); expect(statusOf(itemById('axe-great')!, s, L1)).toBe('locked');
  });
  it('equips owned items, refuses locked, wrong-slot and unknown ids, and allows empty only for optional slots', () => {
    const s = defaultCosmetics();
    expect(equip(s, 'weapon', 'axe-great', L1)).toBe(s);
    expect(equip(s, 'weapon', 'shield-round', L9)).toBe(s);
    expect(equip(s, 'weapon', 'nope', L9)).toBe(s);
    expect(equip(s, 'hair', null, L9)).toBe(s);
    expect(equip(s, 'weapon', 'axe-great', L9).equipped.weapon).toBe('axe-great');
    expect(equip(s, 'weapon', null, L1).equipped.weapon).toBeNull();
    expect(s.equipped.weapon).toBe('sword-hero'); // never mutates
  });
  it('reset restores the starter look but never takes granted items away', () => {
    let s = grant(defaultCosmetics(), 'hat-sun'); s = equip(s, 'weapon', 'dagger-ranger', L1); s = setTint(s, 'cape', 3);
    const r = resetLook(s); expect(r.equipped).toEqual(DEFAULT_EQUIPPED); expect(r.tints).toEqual({ cape: 0, headgear: 0 }); expect(r.granted).toEqual(['hat-sun']);
  });
  it('grants ownership of a premium item only through grant()', () => {
    const s = grant(defaultCosmetics(), 'hat-sun'); expect(isOwned(itemById('hat-sun')!, s, L1)).toBe(true); expect(equip(s, 'headgear', 'hat-sun', L1).equipped.headgear).toBe('hat-sun');
    expect(grant(s, 'unknown')).toBe(s);
  });
  it('sanitises hostile or corrupt storage without throwing', () => {
    for (const raw of [null, 5, 'x', [], { equipped: 7 }, { equipped: { weapon: 'axe-great', hair: 'sword-hero', outfit: 12, headgear: null }, granted: ['zzz', 'hat-sun', 4], tints: { cape: 99, headgear: 2.5 } }]) expect(() => sanitizeCosmetics(raw, L1)).not.toThrow();
    const s = sanitizeCosmetics({ equipped: { weapon: 'axe-great', hair: 'sword-hero', headgear: null, cape: 'cape-moon' }, granted: ['zzz', 'hat-sun'], tints: { cape: 99, headgear: 2 } }, L1);
    expect(s.equipped.weapon).toBe('sword-hero'); expect(s.equipped.hair).toBe('hair-ranger'); expect(s.equipped.cape).toBeNull(); expect(s.granted).toEqual(['hat-sun']); expect(s.tints).toEqual({ cape: 0, headgear: 2 });
  });
  it('migrates the old accessory save (head/back/hand) into headgear/cape/off hand when owned', () => {
    const s = migrateLegacyEquipment({ head: 'leaf-crown', back: 'mossy-cloak', hand: 'glow-lantern' }, L9);
    expect(s.equipped).toMatchObject({ headgear: 'leaf-crown', cape: 'mossy-cloak', offhand: 'glow-lantern', weapon: 'sword-hero' });
    expect(migrateLegacyEquipment({ back: 'mossy-cloak' }, L1).equipped.cape).toBeNull();
    expect(migrateLegacyEquipment('garbage', L1)).toEqual(defaultCosmetics());
  });
  it('loads: new key first, else migrates the legacy key, never deleting it; saves report failure instead of throwing', () => {
    const legacy = mem({ 'mindquest.equipment.v1': JSON.stringify({ head: 'leaf-crown' }) });
    expect(loadCosmetics(L1, undefined, legacy).equipped.headgear).toBe('leaf-crown'); expect(legacy.m['mindquest.equipment.v1']).toBeDefined();
    const st = mem(); const s = equip(defaultCosmetics(), 'weapon', 'dagger-ranger', L1); expect(saveCosmetics(s, st)).toBe(true);
    expect(loadCosmetics(L1, undefined, st).equipped.weapon).toBe('dagger-ranger'); expect(st.m[COSMETICS_STORAGE_KEY]).toContain('dagger-ranger');
    expect(saveCosmetics(s, { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(loadCosmetics(L1, undefined, { getItem: () => '{broken' })).toEqual(defaultCosmetics());
  });
  it('reports new items after a level-up and collection progress', () => {
    const fresh = newlyOwned({ level: 1, unlocked: [] }, { level: 2, unlocked: [] }, defaultCosmetics()).map(i => i.id); expect(fresh).toContain('hair-clan'); expect(fresh).not.toContain('outfit-guard');
    const p = collectionProgress(defaultCosmetics(), L1); expect(p['silver-guard'].total).toBeGreaterThan(p['silver-guard'].owned); expect(p['starter'].owned).toBeGreaterThan(0);
  });
});

describe('loadout', () => {
  it('a two-handed weapon removes the off-hand item; spare 1-handed weapons mean dual wield', () => {
    let s = equip(defaultCosmetics(), 'offhand', 'shield-round', L9); expect(resolveLoadout(s).items.offhand?.id).toBe('shield-round');
    s = equip(s, 'weapon', 'sword-great', L9); expect(resolveLoadout(s).items.offhand).toBeUndefined();
    s = equip(equip(defaultCosmetics(), 'weapon', 'dagger-ranger', L9), 'offhand', 'dagger-spare', L9); expect(isDualWield(resolveLoadout(s))).toBe(true);
    expect(isDualWield(resolveLoadout(equip(defaultCosmetics(), 'offhand', 'shield-round', L9)))).toBe(false);
  });
  it('lists exactly the meshes the loadout shows', () => {
    const v = visibleKitNodes(resolveLoadout(defaultCosmetics()));
    expect([...v].sort()).toEqual(['1H_Sword', 'Rogue_ArmLeft', 'Rogue_ArmRight', 'Rogue_Body', 'Rogue_Head', 'Rogue_LegLeft', 'Rogue_LegRight']);
  });
});

describe('the shipped kit asset', () => {
  const file = 'public/assets/chibi/chibi_kit.glb';
  it('exists with its CC0 licence text and a size budget', () => {
    expect(existsSync(file)).toBe(true); expect(statSync(file).size).toBeLessThan(2_000_000);
    const lic = readFileSync('public/assets/chibi/LICENSE.txt', 'utf8'); expect(lic).toMatch(/Creative Commons Zero|CC0/i); expect(lic).toMatch(/commercial/i);
  });
  it('contains every mesh the catalogue references, on one shared skeleton', async () => {
    await MeshoptDecoder.ready;
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(file);
    const root = doc.getRoot(); const meshes = new Set(root.listNodes().filter(n => n.getMesh()).map(n => n.getName()));
    for (const i of CATALOG) for (const k of i.kit) expect(meshes.has(k), `${i.id} -> ${k}`).toBe(true);
    // several Skin objects may exist (one per source part), but they must all drive the SAME joint nodes: one skeleton
    const skins = root.listSkins(); expect(skins.length).toBeGreaterThan(0);
    const first = skins[0].listJoints(); expect(first.length).toBe(41);
    for (const sk of skins) { const j = sk.listJoints(); expect(j.length).toBe(first.length); j.forEach((n, k) => expect(n).toBe(first[k])); }
    const bones = new Set(root.listNodes().map(n => n.getName())); for (const b of ['head', 'handslot.r', 'handslot.l', 'foot.l']) expect(bones.has(b)).toBe(true);
    const tris = [...meshes].length; expect(tris).toBeGreaterThanOrEqual(45);
  });
});
