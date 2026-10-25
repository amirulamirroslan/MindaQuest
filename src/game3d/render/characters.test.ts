import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Box3, type Object3D } from 'three';
import { Enemy } from '../systems/enemies';
import { ElderModel, MossbackView, SproutView, TelegraphMarker } from './Characters';

const finite = (o: Object3D): boolean => { const b = new Box3().setFromObject(o); return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].every(Number.isFinite); };
const run = (view: { update(t: number, dt: number, y: number): void }, e: Enemy, seconds: number, t0 = 0): number => { let t = t0; for (let i = 0; i < seconds * 60; i++) { t += 1 / 60; e.update(1 / 60, { x: 3, z: 3 }); view.update(t, 1 / 60, 0); } return t; };

// the models paint two tiny textures on a canvas; the test environment has no DOM, so a stand-in canvas is enough
beforeAll(() => {
  const ctx = { createRadialGradient: () => ({ addColorStop() { /* none */ } }), fillRect() { /* none */ }, fillStyle: '' };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

describe('character animation smoke tests', () => {
  it('the Elder idles, talks, waves and cheers without producing bad numbers', () => {
    const el = new ElderModel(); let t = 0;
    const tick = (s: number) => { for (let i = 0; i < s * 60; i++) { t += 1 / 60; el.update(t, 0.3); } };
    tick(2); el.setTalking(true); tick(2); el.wave(); tick(2); el.cheer(); let cued = false; for (let i = 0; i < 150; i++) { t += 1 / 60; el.update(t, 0); cued = cued || el.takeCheerCue(); } tick(1);
    expect(cued).toBe(true); expect(finite(el.root)).toBe(true);
  });
  it('a sprout of every temperament runs through all its states, reacts to a hit and is defeated', () => {
    for (let n = 0; n < 3; n++) {
      const e = new Enemy('sprout', { x: 0, z: 0 }), v = new SproutView(e, n !== 1);
      const t = run(v, e, 6); v.react(1, 0, 2); e.takeDamage(1, 1); const t2 = run(v, e, 1, t);
      e.takeDamage(5, 2); expect(e.defeated).toBe(true);
      run(v, e, 0.3, t2); expect(finite(v.root)).toBe(true); run(v, e, e.def.deathTime, t2); expect(v.root.visible).toBe(false);
    }
  });
  it('the boss shows every attack pose, flinches, roars at phase 2 and has a full defeat sequence', () => {
    const e = new Enemy('mossback', { x: 0, z: 0 }), v = new MossbackView(e);
    let t = run(v, e, 25);   // slam, charge and spore ring all come up in this time
    v.react(0, 1, 2); e.takeDamage(1, 10); t = run(v, e, 0.5, t);
    e.takeDamage(7, 11); expect(e.phase).toBe(2); t = run(v, e, 2, t); expect(finite(v.root)).toBe(true);
    e.takeDamage(99, 12); expect(e.defeated).toBe(true);
    for (const frac of [0.05, 0.3, 0.6, 0.9]) { run(v, e, e.def.deathTime * frac / 5, t); expect(finite(v.root)).toBe(true); }
    run(v, e, e.def.deathTime, t); expect(v.root.visible).toBe(false);
  });
});

describe('v2.27 fight presentation: cues the scene turns into dust, sound and shaking', () => {
  const drain = (v: { takeCues(): { kind: string }[] }, into: string[]) => { for (const c of v.takeCues()) into.push(c.kind); };
  it('the boss roars the first time it sees the hero, stomps while it walks and leaks embers; draining the cues empties them', () => {
    const e = new Enemy('mossback', { x: 0, z: 0 }), v = new MossbackView(e), kinds: string[] = []; let t = 0;
    for (let i = 0; i < 60; i++) { t += 1 / 60; e.update(1 / 60, { x: 40, z: 0 }); v.update(t, 1 / 60, 0); drain(v, kinds); }   // far away: asleep, no roar
    expect(kinds).not.toContain('roar');
    for (let i = 0; i < 60 * 6; i++) { t += 1 / 60; e.update(1 / 60, { x: 11, z: 0 }); v.update(t, 1 / 60, 0); drain(v, kinds); }
    expect(kinds.filter(k => k === 'roar')).toHaveLength(1);
    expect(kinds).toContain('stomp'); expect(kinds).toContain('ember');
    expect(v.takeCues()).toHaveLength(0);
  });
  it('the boss roars again when it reaches phase 2', () => {
    const e = new Enemy('mossback', { x: 0, z: 0 }), v = new MossbackView(e), kinds: string[] = []; let t = 0;
    for (let i = 0; i < 120; i++) { t += 1 / 60; e.update(1 / 60, { x: 3, z: 3 }); v.update(t, 1 / 60, 0); drain(v, kinds); }
    const before = kinds.filter(k => k === 'roar').length; e.takeDamage(7, 1);
    for (let i = 0; i < 10; i++) { t += 1 / 60; e.update(1 / 60, { x: 3, z: 3 }); v.update(t, 1 / 60, 0); drain(v, kinds); }
    expect(kinds.filter(k => k === 'roar').length).toBe(before + 1);
  });
  it('a sprout gives an alert puff when it spots the hero, steams while winding up and puffs dust when it lands', () => {
    const e = new Enemy('sprout', { x: 0, z: 0 }), v = new SproutView(e), kinds: string[] = []; let t = 0;
    for (let i = 0; i < 60 * 8; i++) { t += 1 / 60; e.update(1 / 60, { x: 1.2, z: 0 }); v.update(t, 1 / 60, 0); drain(v, kinds); }
    for (const k of ['alert', 'steam', 'slam']) expect(kinds).toContain(k);
    expect(finite(v.root)).toBe(true);
  });
  it('the danger marker shows teeth only on big circles and survives a full fill', () => {
    const m = new TelegraphMarker();
    m.show({ type: 'circle', x: 1, z: 2, r: 5 }, 0); for (let p = 0; p <= 1; p += 0.1) m.setProgress(p);
    expect(m.root.visible).toBe(true); expect(finite(m.root)).toBe(true);
    m.show({ type: 'line', x: 0, z: 0, dx: 0, dz: 1, length: 4.5, width: 2.4 }, 0); m.setProgress(0.5); expect(finite(m.root)).toBe(true);
    m.hide(); expect(m.root.visible).toBe(false);
  });
});
