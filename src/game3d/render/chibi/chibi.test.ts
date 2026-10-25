import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { CLIP_DURATIONS, STRIDE_NATIVE, attackHit, attackWindow, idleClip, locomotionPlan, scrubTime, specialWindow } from './chibiClips';
import { classify, recolourAtlas, tintPixel } from './palette';
import { defaultCosmetics, equip } from '../../cosmetics/inventory';
import { resolveLoadout } from '../../cosmetics/loadout';

const L9 = { level: 9, unlocked: [] as string[] };
const hex = (h: number): [number, number, number] => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const withWeapon = (id: string, off?: string) => { let s = equip(defaultCosmetics(), 'weapon', id, L9); if (off) s = equip(s, 'offhand', off, L9); return resolveLoadout(s); };

describe('clip tables match the shipped GLB', () => {
  it('every clip exists with the recorded duration', async () => {
    await MeshoptDecoder.ready;
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read('public/assets/chibi/chibi_kit.glb');
    const dur = new Map(doc.getRoot().listAnimations().map(a => { let d = 0; for (const s of a.listSamplers()) { const t = s.getInput()!.getArray()!; d = Math.max(d, t[t.length - 1]); } return [a.getName(), d] as const; }));
    for (const [name, d] of Object.entries(CLIP_DURATIONS)) { expect(dur.has(name), name).toBe(true); expect(Math.abs(dur.get(name)! - d), name).toBeLessThan(0.01); }
  });
});

describe('weapon -> animation', () => {
  it('picks a clip per weapon class, dual wield and unarmed, and the special is the kit spin clip', () => {
    expect(attackWindow(withWeapon('sword-hero')).clip).toBe('1H_Melee_Attack_Slice_Horizontal');
    expect(attackWindow(withWeapon('axe-clan')).clip).toBe('1H_Melee_Attack_Chop');
    expect(attackWindow(withWeapon('sword-great')).clip).toBe('2H_Melee_Attack_Slice');
    expect(attackWindow(withWeapon('axe-great')).clip).toBe('2H_Melee_Attack_Chop');
    expect(attackWindow(withWeapon('staff-moon')).clip).toBe('Spellcast_Shoot');
    expect(attackWindow(withWeapon('dagger-ranger', 'dagger-spare')).clip).toBe('Dualwield_Melee_Attack_Slice');
    expect(attackWindow(resolveLoadout(equip(defaultCosmetics(), 'weapon', null, L9))).clip).toBe('Unarmed_Melee_Attack_Punch_A');
    for (const id of ['sword-hero', 'axe-great', 'staff-moon']) expect(specialWindow(withWeapon(id)).clip).toBe('2H_Melee_Attack_Spin');
    expect(idleClip(withWeapon('sword-great'))).toBe('2H_Melee_Idle'); expect(idleClip(withWeapon('sword-hero'))).toBe('Idle'); expect(idleClip(resolveLoadout(equip(defaultCosmetics(), 'weapon', null, L9)))).toBe('Unarmed_Idle');
  });
  it('every weapon has a three-swing combo, each swing with its own ordered window, and the finisher differs from the opener (v2.12)', () => {
    for (const id of ['sword-hero', 'dagger-ranger', 'axe-clan', 'sword-great', 'axe-great', 'staff-moon', 'wand-moon']) for (const off of [undefined, 'dagger-spare']) {
      const l = withWeapon(id, off);
      const hits = [0, 1, 2].map(s => attackHit(l, s));
      for (const w of hits) { expect(CLIP_DURATIONS[w.clip as keyof typeof CLIP_DURATIONS], w.clip).toBeDefined(); expect(w.start).toBeLessThan(w.hit); expect(w.hit).toBeLessThan(w.end); expect(w.end).toBeLessThanOrEqual(w.duration); }
      expect(new Set(hits.map(h => h.clip + h.shape)).size, id).toBeGreaterThan(1);
      expect(attackHit(l, 9)).toEqual(hits[2]); expect(attackHit(l, -1)).toEqual(hits[0]);
    }
  });
  it('the spin window lands the blast inside the clip', () => { const w = specialWindow(withWeapon('sword-hero')); expect(w.start).toBeLessThan(w.hit); expect(w.hit).toBeLessThan(w.end); expect(w.end).toBeLessThanOrEqual(w.duration); });
  it('every window is ordered and inside its clip', () => {
    for (const id of ['sword-hero', 'dagger-ranger', 'axe-clan', 'sword-great', 'axe-great', 'staff-moon', 'wand-moon']) for (const w of [attackWindow(withWeapon(id)), attackWindow(withWeapon(id, 'dagger-spare'))]) { expect(w.start).toBeLessThan(w.hit); expect(w.hit).toBeLessThan(w.end); expect(w.end).toBeLessThanOrEqual(w.duration); }
  });
  it('scrubbing lands the blow exactly on the game hit frame and is monotonic and bounded', () => {
    const w = attackWindow(withWeapon('sword-great')); const hitN = 0.14 / 0.42;
    expect(scrubTime(w, 0, hitN)).toBeCloseTo(w.start); expect(scrubTime(w, hitN, hitN)).toBeCloseTo(w.hit); expect(scrubTime(w, 1, hitN)).toBeCloseTo(w.end);
    let prev = -1; for (let n = 0; n <= 1.0001; n += 0.02) { const t = scrubTime(w, n, hitN); expect(t).toBeGreaterThanOrEqual(prev); expect(t).toBeLessThan(w.duration); prev = t; }
    expect(scrubTime(w, -3, hitN)).toBeCloseTo(w.start); expect(scrubTime(w, 9, hitN)).toBeCloseTo(w.end);
  });
});

describe('locomotion', () => {
  it('blend weights always sum to 1 and rates stay capped', () => {
    for (let v = 0; v <= 8; v += 0.1) { const p = locomotionPlan(v); expect(p.idle + p.walk + p.run).toBeCloseTo(1); expect(p.rateWalk).toBeLessThanOrEqual(2.2); expect(p.rateRun).toBeLessThanOrEqual(2.4); expect(p.rateRun).toBeGreaterThanOrEqual(0.8); }
    expect(locomotionPlan(0).idle).toBe(1); expect(locomotionPlan(5.8).run).toBeGreaterThan(0.95); expect(STRIDE_NATIVE.runA).toBeGreaterThan(STRIDE_NATIVE.walk);
  });
});

describe('palette recolouring', () => {
  it('classifies the real palette colours by mesh kind', () => {
    expect(classify(...hex(0xf5bb96), 'head')).toBe('skin'); expect(classify(...hex(0x1c2427), 'head')).toBe('eyes'); expect(classify(...hex(0xa5644b), 'head')).toBe('hood');
    expect(classify(...hex(0xf7c4a1), 'body')).toBe('skin'); expect(classify(...hex(0x9a5944), 'body')).toBe('gear'); expect(classify(...hex(0x6b7378), 'body')).toBe('tunic');
    expect(classify(...hex(0x9a5944), 'legs')).toBe('boots'); expect(classify(...hex(0x2f3a6a), 'legs')).toBe('trousers');
    expect(classify(...hex(0x8a9298), 'weapon')).toBe('steel'); expect(classify(...hex(0xc3632d), 'weapon')).toBeNull(); expect(classify(...hex(0xc3632d), 'headgear')).toBeNull();
  });
  it('recolours only the requested slot and keeps the shading order', () => {
    const px = [0xf5bb96, 0x9a5944, 0x2f3a6a, 0x4a5aa0].flatMap(h => [...hex(h), 255]); const data = new Uint8ClampedArray(px);
    expect(recolourAtlas(data, 'legs', {})).toBe(0); expect([...data]).toEqual(px);
    expect(recolourAtlas(data, 'legs', { trousers: 0xcc2222 })).toBe(2);
    expect([...data.slice(0, 8)]).toEqual(px.slice(0, 8)); // skin and boots untouched
    const dark = data.slice(8, 11), light = data.slice(12, 15); expect(dark[0]).toBeGreaterThan(dark[1]); expect(light[0]).toBeGreaterThan(dark[0]);
  });
  it('skips transparent pixels and keeps channels in range', () => {
    const d = new Uint8ClampedArray([10, 20, 30, 0, 255, 255, 255, 255]); recolourAtlas(d, 'cape', { cape: 0x336699 }); expect([...d.slice(0, 4)]).toEqual([10, 20, 30, 0]);
    for (const c of tintPixel(255, 255, 255, 'tunic', 0xffffff)) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); }
  });
});

import { blinkAt } from './ChibiFace';
describe('blink (v2.9)', () => {
  it('is open most of the time, closes briefly, and repeats', () => {
    expect(blinkAt(1.5)).toBe(0); expect(blinkAt(0.08)).toBeGreaterThan(0.9); expect(blinkAt(3.6 + 0.08)).toBeGreaterThan(0.9); expect(blinkAt(-1)).toBe(0);
    let closed = 0; for (let t = 0; t < 3.6; t += 0.01) if (blinkAt(t) > 0.45) closed++; expect(closed * 0.01).toBeLessThan(0.2);
  });
});
