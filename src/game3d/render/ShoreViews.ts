/**
 * Moonwake Shore creatures and people (v2.29): the Pebble Crab, the Gloom Gull, the Tidecaller Heron, Harbour-master Mak Long and the
 * lighthouse keeper. Each creature is a view over a logic `Enemy` (see systems/enemies.ts) exactly like the Hollow's Shardling and Warden:
 * the state machine decides, the view only poses. Everything is built from merged, vertex-coloured Kit pieces (a handful of draw calls each).
 *
 * Reading the creatures is the lesson: the crab's shell is closed (and covers its face) until it is dizzy, when it pops open; the heron's
 * chest pearl glows and rings while it preens, which is exactly when blows count double.
 */
import {
  AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, TorusGeometry, type BufferGeometry,
} from 'three';
import type { Enemy, EnemyState } from '../systems/enemies';
import { bump, easeInOut, easeOutCubic } from '../systems/charAnim';
import { EnemyView } from './Characters';
import { Kit, M } from './env/Structures';
import { addWorldOutline } from './env/worldOutline';
import { blobShadow, glowSprite } from './common';
import { withPaint } from './stylize';

const damp = (from: number, to: number, dt: number, rate = 14): number => from + (to - from) * Math.min(1, dt * rate);
const cone = (r: number, h: number, seg = 6): ConeGeometry => new ConeGeometry(r, h, seg);
const addMesh = (parent: Group, g: BufferGeometry, mat: MeshLambertMaterial, outline = 0): Mesh => { const m = new Mesh(g, mat); if (outline > 0) addWorldOutline(m, outline); parent.add(m); return m; };

// ================================================================================================================================ geometry
/** The shell: a flat, pebbly dome. Faces +Z (the front edge is where the face hides). */
function crabShellGeometry(): BufferGeometry {
  const k = new Kit();
  k.ball(0.62, 0, 0.5, 0, 0x8f8b84, 1.25, 0.62, 1.05, 2);
  const bumps: [number, number, number, number, number][] = [[-0.4, 0.82, 0.1, 0.17, 0xb8b2a4], [0.35, 0.86, -0.1, 0.19, 0xa39d90], [0, 0.95, 0.28, 0.15, 0xc8c2b2], [-0.1, 0.9, -0.34, 0.16, 0x77736c], [0.62, 0.7, 0.3, 0.13, 0xb8b2a4], [-0.68, 0.68, -0.18, 0.14, 0x9a9488], [0.12, 0.98, -0.02, 0.2, 0xd2ccbc]];
  for (const [x, y, z, r, c] of bumps) k.ball(r, x, y, z, c, 1, 0.7, 1, 1);
  k.ball(0.12, 0.46, 0.58, 0.46, 0xd8d4c8, 1, 0.7, 1, 0);   // a pale limpet near the front edge
  return k.build(0.1, 0.6);
}
/** The soft body, legs and eye-stalks under the shell. */
function crabBodyGeometry(): BufferGeometry {
  const k = new Kit();
  k.ball(0.5, 0, 0.32, 0.05, 0xe0654a, 1.25, 0.55, 1, 1);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -0.22 + i * 0.26;
    k.cyl(0.04, 0.05, 0.5, 5, s * 0.74, 0.2, z, 0xc8503a, 0); k.box(0.34, 0.07, 0.08, s * 0.9, 0.04, z + 0.02, 0xb04430);
    k.add(cone(0.07, 0.16, 5), 0xb04430, M(s * 1.05, 0.02, z + 0.04, 0, 0, s * -Math.PI / 2));
  }
  for (const s of [-1, 1]) { k.cyl(0.025, 0.03, 0.34, 5, s * 0.17, 0.78, 0.44, 0xd2603f); k.ball(0.09, s * 0.17, 0.97, 0.46, 0xffffff, 1, 1, 1, 1); k.ball(0.05, s * 0.17, 0.97, 0.54, 0x1c1c26, 1, 1, 0.7, 0); }
  k.box(0.22, 0.04, 0.05, 0, 0.3, 0.56, 0x7a2a22);   // a grumpy little mouth
  return k.build(0.12, 0.5);
}
/** A claw on an arm; built around the shoulder so the group can swing from it. `s` = -1 left, +1 right. */
function clawGeo(s: -1 | 1): BufferGeometry {
  const k = new Kit();
  k.add(new CylinderGeometry(0.075, 0.09, 0.5, 6), 0xd8583e, M(0, 0, 0.25, Math.PI / 2, 0, 0));
  k.ball(0.2, 0, 0, 0.58, 0xe8654a, 1.2, 0.8, 1, 1);
  k.add(cone(0.1, 0.34, 4), 0xf4e8d4, M(s * 0.1, 0, 0.84, Math.PI / 2, 0, 0)); k.add(cone(0.08, 0.28, 4), 0xf4e8d4, M(-s * 0.12, 0.02, 0.8, Math.PI / 2, 0, 0));
  return k.build(0.1, 0.5);
}

function gullBodyGeometry(): BufferGeometry {
  const k = new Kit();
  k.ball(0.34, 0, 0, 0, 0x8d96a8, 0.85, 0.75, 1.5, 2);           // body
  k.ball(0.22, 0, -0.05, -0.22, 0x707a90, 0.8, 0.7, 1.2, 1);       // belly shadow
  k.ball(0.2, 0, 0.2, 0.46, 0xa9b1c2, 1, 1, 1, 2);                // head
  k.add(cone(0.075, 0.32, 5), 0xf0a83a, M(0, 0.14, 0.76, Math.PI / 2, 0, 0)); k.box(0.06, 0.02, 0.16, 0, 0.11, 0.7, 0xd88a28);   // beak
  for (const s of [-1, 1]) { k.ball(0.055, s * 0.12, 0.27, 0.58, 0xffffff, 1, 1, 0.6, 0); k.ball(0.03, s * 0.12, 0.27, 0.62, 0x1c1c26, 1, 1, 0.6, 0); }
  k.add(cone(0.18, 0.5, 4), 0x5a6278, M(0, 0.02, -0.62, -Math.PI / 2, 0, 0, 1, 1, 0.25));   // tail
  for (const s of [-1, 1]) k.cyl(0.015, 0.015, 0.28, 4, s * 0.1, -0.34, 0.05, 0xd88a28);   // thin legs
  return k.build(0.05, 0.4);
}
function gullWingGeometry(s: -1 | 1): BufferGeometry {
  const k = new Kit();
  k.add(new BoxGeometry(0.7, 0.04, 0.5), 0x7f889c, M(s * 0.38, 0, 0, 0, 0, s * 0.04)); k.add(new BoxGeometry(0.55, 0.035, 0.38), 0x5d667c, M(s * 1.0, 0, -0.05, 0, s * -0.1, s * 0.05));
  k.add(new BoxGeometry(0.3, 0.03, 0.2), 0x3c4358, M(s * 1.42, 0, -0.1, 0, s * -0.25, s * 0.06));
  return k.build(0, 1);
}

function heronBodyGeometry(): BufferGeometry {
  const k = new Kit();
  k.ball(0.55, 0, 1.55, 0, 0x9aa6b8, 0.8, 0.95, 1.5, 2);              // body
  k.ball(0.4, 0, 1.45, -0.55, 0x7f8aa0, 0.8, 0.85, 1.2, 1);            // rump
  for (let i = 0; i < 3; i++) k.add(cone(0.12, 0.8 + i * 0.12, 4), 0x56607a, M((i - 1) * 0.12, 1.5, -1.15 - i * 0.05, -Math.PI / 2 + 0.2, 0, 0));   // tail plumes
  for (const s of [-1, 1]) { k.cyl(0.035, 0.045, 1.25, 5, s * 0.2, 0.65, 0.05, 0xd8a94a); k.box(0.05, 0.04, 0.4, s * 0.2, 0.03, 0.2, 0xd8a94a); k.cyl(0.05, 0.035, 0.1, 5, s * 0.2, 1.3, 0.05, 0x8d96aa); }   // long legs and big feet
  return k.build(0.08, 0.8);
}
/** Neck, head, beak and crest; origin at the base of the neck (the body front), the neck rises along +Y and the beak points +Z. */
function heronNeckGeometry(): BufferGeometry {
  const k = new Kit();
  k.add(new CylinderGeometry(0.1, 0.15, 0.55, 8), 0xe8edf4, M(0, 0.25, 0.02, 0.2, 0, 0)); k.add(new CylinderGeometry(0.085, 0.1, 0.5, 8), 0xe8edf4, M(0, 0.7, 0.14, -0.25, 0, 0));
  k.add(new CylinderGeometry(0.08, 0.085, 0.4, 8), 0xdfe5ee, M(0, 1.08, 0.12, 0.15, 0, 0));
  k.ball(0.17, 0, 1.36, 0.16, 0xf4f7fb, 1, 0.9, 1.3, 2);                // head
  k.add(cone(0.075, 0.9, 5), 0xf0b030, M(0, 1.33, 0.7, Math.PI / 2, 0, 0)); k.box(0.07, 0.02, 0.5, 0, 1.29, 0.52, 0xd88a20);
  for (const s of [-1, 1]) { k.ball(0.05, s * 0.1, 1.42, 0.27, 0xffd25a, 1, 1, 0.6, 0); k.ball(0.028, s * 0.11, 1.42, 0.31, 0x1c1c26, 1, 1, 0.6, 0); k.add(new BoxGeometry(0.14, 0.03, 0.04), 0x2a2e44, M(s * 0.1, 1.5, 0.3, 0, 0, s * -0.4)); }   // eyes and stern brows
  for (let i = 0; i < 3; i++) k.add(cone(0.025, 0.55 - i * 0.08, 4), 0x2a2e44, M(0, 1.5 - i * 0.03, 0.0 - i * 0.07, -1.2 + i * 0.1, 0, 0));   // dark crest plumes
  return k.build(0.05, 0.8);
}
function heronWingGeometry(s: -1 | 1): BufferGeometry {
  const k = new Kit();
  k.add(new BoxGeometry(0.9, 0.06, 0.9), 0x7f8aa0, M(s * 0.5, 0, 0)); k.add(new BoxGeometry(0.8, 0.05, 0.7), 0x5d6882, M(s * 1.3, 0, -0.05, 0, s * -0.1, 0));
  for (let i = 0; i < 4; i++) k.add(new BoxGeometry(0.4, 0.04, 0.16), i % 2 ? 0x3c4560 : 0x4a546e, M(s * (1.75 + i * 0.1), 0, 0.28 - i * 0.22, 0, s * (-0.15 - i * 0.05), 0));
  return k.build(0, 1);
}

// ================================================================================================================================ the Pebble Crab
const CRAB_HUES = [{ a: 1, b: 1 }, { a: 1.06, b: 0.9 }, { a: 0.9, b: 1.08 }];
export class CrabView extends EnemyView {
  protected readonly mass = 1.4;
  private readonly shell = new Group(); private readonly under = new Group(); private readonly claws: Group[] = [];
  private readonly sc: number; private readonly ph: number;
  private prev: EnemyState = 'idle'; private notice = 0; private lastHits = 0; private pain = 0; private dustT = 0; private open = 0; private claw = 0;
  constructor(enemy: Enemy, outlines = true) {
    super(enemy);
    this.outlineOn = outlines;
    const id = enemy.tag ?? enemy.id, hue = CRAB_HUES[Math.abs(id) % CRAB_HUES.length];
    this.sc = 0.92 + ((Math.abs(id) * 29) % 9) / 9 * 0.2; this.ph = id * 2.3;
    this.root.add(blobShadow(0.9 * this.sc));
    this.part(crabBodyGeometry(), this.vmat(), this.under, 0.03); this.body.add(this.under);
    this.shell.position.y = 0.06; this.part(crabShellGeometry(), this.vmat(), this.shell, 0.035); this.body.add(this.shell);
    for (const s of [-1, 1] as const) { const c = new Group(); c.position.set(s * 0.62, 0.4, 0.4); this.part(clawGeo(s), this.vmat(), c, 0.03); this.body.add(c); this.claws.push(c); }
    this.mats[0].color.setRGB(hue.a, hue.a * 0.95, hue.a * 0.9); this.mats[1].color.setRGB(hue.b, hue.b, hue.b);
    this.body.scale.setScalar(this.sc);
  }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, st = e.state, p = e.telegraphProgress, ph = this.ph, s = this.sc;
    if (this.prev === 'idle' && st === 'chase') { this.notice = 0.45; this.cue('alert', 0, 0, 1.2); }
    if (this.prev === 'strike' && st === 'recover') this.cue('slam', 0, 0.9, 0.05, 0.5);
    this.prev = st; this.notice = Math.max(0, this.notice - dt);
    if (e.hitCount !== this.lastHits) { this.lastHits = e.hitCount; this.pain = 0.3; this.cue('crystal', 0, 0, 0.6, 0.5, 0xe0ddd0); }
    this.pain = Math.max(0, this.pain - dt); const pk = this.pain / 0.3;
    // the shell: shut (and tipped forward over the face) normally; popped open and tilted up while the crab is dizzy
    this.open = damp(this.open, st === 'recover' ? 1 : 0, dt, 12);
    let y = 0, yaw = 0, roll = 0, pitch = 0, squash = 1, clawUp = 0, sidestep = 0;
    switch (st) {
      case 'idle': squash = 1 + Math.sin(t * 2 + ph) * 0.03; yaw = Math.sin(t * 0.7 + ph) * 0.35; clawUp = 0.15 * Math.max(0, Math.sin(t * 1.3 + ph)); break;
      case 'chase': { sidestep = Math.sin(t * 14 + ph) * 0.03; y = Math.abs(Math.sin(t * 10 + ph)) * 0.04; roll = Math.sin(t * 7 + ph) * 0.05; clawUp = 0.3 + 0.2 * Math.sin(t * 6 + ph);
        if (this.notice > 0) { y = bump(1 - this.notice / 0.45) * 0.3; clawUp = 1; } break; }
      case 'telegraph': squash = 1 - 0.18 * p; pitch = -0.18 * p; clawUp = 0.8 + 0.2 * p; roll = Math.sin(t * 50) * 0.04 * p;
        this.dustT -= dt; if (this.dustT <= 0) { this.dustT = 0.15; this.cue('dust', 0, -0.2, 0.05, 0.4); } break;
      case 'strike': pitch = 0.12; y = 0.02; squash = 0.92; clawUp = 0.2; sidestep = Math.sin(t * 40) * 0.05;
        this.dustT -= dt; if (this.dustT <= 0) { this.dustT = 0.06; this.cue('dust', 0, -0.4, 0.05, 0.5); } break;
      case 'recover': { const k = Math.min(1, e.t / e.def.recoverTime); yaw = Math.sin(t * 6) * 0.5 * (1 - k); roll = Math.sin(t * 9) * 0.07 * (1 - k); squash = 0.9 + 0.1 * k; clawUp = -0.2; break; }   // dizzy and panting, shell up
    }
    squash *= 1 - 0.12 * pk; yaw += Math.sin(t * 50) * 0.1 * pk;
    this.body.position.set(sidestep, y * s, 0); this.body.rotation.set(pitch, yaw, roll);
    this.body.scale.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
    // shell: closed = tipped slightly forward (covering the face); open = lifted and tilted back like a lid
    this.shell.position.y = 0.06 + 0.3 * this.open; this.shell.rotation.x = 0.1 * (1 - this.open) - 0.55 * this.open; this.shell.position.z = -0.1 * this.open;
    this.claw = damp(this.claw, clawUp, dt, 10);
    this.claws.forEach((c, i) => { const sd = i === 0 ? -1 : 1; c.rotation.set(-0.25 - this.claw * 0.7 + Math.sin(t * 5 + i) * 0.05, sd * (0.25 - this.claw * 0.25), sd * 0.2); });
    const hot = st === 'telegraph' ? p : st === 'strike' ? 1 : 0;   // the soft body flushes redder as it winds up
    this.mats[0].color.setRGB(1 + 0.2 * hot, 1 - 0.35 * hot, 1 - 0.35 * hot);
  }
  protected defeat(_t: number, _dt: number, k: number): void {
    // flipped onto its back, legs waving, then it sinks into the sand with a puff
    const flip = easeOutCubic(Math.min(1, k / 0.4)), u = k < 0.5 ? 0 : (k - 0.5) / 0.5, s = this.sc;
    this.body.position.set(0, (Math.sin(Math.min(1, k / 0.4) * Math.PI) * 0.5 - easeInOut(u) * 0.3) * s, 0); this.body.rotation.set(0, 0, Math.PI * flip);
    this.body.scale.setScalar(s * (1 - 0.1 * u)); this.shell.rotation.x = -0.3; this.claws.forEach((c, i) => { c.rotation.set(-0.4 + Math.sin(k * 40 + i) * 0.3, 0, 0); });
    this.root.scale.setScalar(Math.max(0.001, 1 - easeInOut(u)));
  }
}

// ================================================================================================================================ the Gloom Gull
export class GullView extends EnemyView {
  protected readonly mass = 0.8;
  private readonly wings: Group[] = []; private readonly sc: number; private readonly ph: number;
  private prev: EnemyState = 'idle'; private notice = 0; private lastHits = 0; private pain = 0; private height = 2.2; private flapT = 0; private dustT = 0;
  constructor(enemy: Enemy, outlines = true) {
    super(enemy);
    this.outlineOn = outlines; const id = enemy.tag ?? enemy.id;
    this.sc = 0.95 + ((Math.abs(id) * 31) % 7) / 7 * 0.15; this.ph = id * 1.7;
    this.root.add(blobShadow(0.5 * this.sc));
    this.part(gullBodyGeometry(), this.vmat(), this.body, 0.03);
    for (const s of [-1, 1] as const) { const w = new Group(); w.position.set(s * 0.22, 0.12, 0.05); this.part(gullWingGeometry(s), this.vmat(), w, 0.02); this.body.add(w); this.wings.push(w); }
    this.body.scale.setScalar(this.sc); this.body.position.y = this.height;
  }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, st = e.state, p = e.telegraphProgress, ph = this.ph, s = this.sc;
    if (this.prev === 'idle' && st === 'chase') { this.notice = 0.4; this.cue('alert', 0, 0, 2.6); }
    if (this.prev === 'strike' && st === 'recover') this.cue('dust', 0, 0.3, 0.1, 0.6);
    this.prev = st; this.notice = Math.max(0, this.notice - dt);
    if (e.hitCount !== this.lastHits) { this.lastHits = e.hitCount; this.pain = 0.3; this.cue('crystal', 0, 0, this.height, 0.5, 0xc9d0e0); }
    this.pain = Math.max(0, this.pain - dt); const pk = this.pain / 0.3;
    let wantH = 2.2 + Math.sin(t * 1.4 + ph) * 0.25, flap = 6, amp = 0.5, pitch = 0, roll = Math.sin(t * 1.1 + ph) * 0.12, tuck = 0;
    switch (st) {
      case 'idle': wantH = 1.9 + Math.sin(t * 1.4 + ph) * 0.2; flap = 4.5; break;
      case 'chase': wantH = 2.6 + Math.sin(t * 3 + ph) * 0.2; flap = 8; amp = 0.65; roll = Math.sin(t * 4 + ph) * 0.2; if (this.notice > 0) wantH += bump(1 - this.notice / 0.4) * 0.6; break;
      case 'telegraph': wantH = 3.2 + 0.4 * p; flap = 12; amp = 0.8; pitch = -0.5 * p; roll = Math.sin(t * 40) * 0.05 * p; break;   // climbs, beating hard, nose up
      case 'strike': wantH = 0.9; pitch = 0.6; tuck = 1; flap = 0; break;                                                          // a swoop: wings swept back
      case 'recover': { const k = Math.min(1, e.t / e.def.recoverTime); wantH = 0.35 + 0.1 * Math.sin(t * 8) * (1 - k); flap = 5; amp = 0.25; roll = Math.sin(t * 9) * 0.25 * (1 - k); break; }   // landed, ruffled and dizzy
    }
    this.height = damp(this.height, wantH, dt, st === 'strike' ? 22 : 7);
    this.flapT += dt * flap; const f = Math.sin(this.flapT * 2 + ph);
    this.wings.forEach((w, i) => { const sd = i === 0 ? -1 : 1; w.rotation.set(0, sd * (-0.15 - tuck * 0.9), sd * (f * amp * (1 - tuck) + tuck * 0.5)); });
    this.dustT -= dt; if (st === 'strike' && this.dustT <= 0) { this.dustT = 0.07; this.cue('dust', 0, -0.3, 0.7, 0.3); }
    this.body.position.set(Math.sin(t * 40) * 0.02 * pk, this.height * s * 0.5 + 0.2, 0); this.body.rotation.set(pitch, Math.sin(t * 50) * 0.1 * pk, roll);
    this.root.children[0].visible = true;
  }
  protected defeat(_t: number, _dt: number, k: number): void {
    // tumbles out of the sky in a puff of grey feathers
    const u = easeInOut(k); this.body.position.set(0, Math.max(0.1, this.height * 0.5 * (1 - u)), 0); this.body.rotation.set(u * 3, u * 6, 0);
    this.wings.forEach((w, i) => { w.rotation.set(0, 0, (i === 0 ? -1 : 1) * (0.6 + Math.sin(k * 30) * 0.5)); }); this.root.scale.setScalar(Math.max(0.001, 1 - u * 0.9));
  }
}

// ================================================================================================================================ the Tidecaller Heron
const PEARL_BLUE = [0x7fd6ff, 0xb8f0ff] as const;
export class HeronView extends EnemyView {
  protected readonly mass = 5;
  private readonly neck = new Group(); private readonly wings: Group[] = [];
  private readonly pearl: Mesh<SphereGeometry, MeshLambertMaterial>; private readonly pearlGlow = glowSprite(0x9fe8ff, 2.4, 0.3);
  private readonly pearlRing = new Mesh(new TorusGeometry(0.5, 0.035, 6, 32), new MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  private readonly sweepFan: Mesh; private readonly ripples: Mesh[] = [];
  private woke = false; private awake = 0; private lastPhase = 1; private lastHits = 0; private pain = 0; private flare = 0; private pearlK = 0.3; private roar = 0; private stepT = 0; private ringK = 0;
  constructor(enemy: Enemy) {
    super(enemy);
    this.root.add(blobShadow(1.5));
    const vm = this.vmat();
    this.part(heronBodyGeometry(), vm, this.body, 0.05);
    this.neck.position.set(0, 1.7, 0.78); this.part(heronNeckGeometry(), vm, this.neck, 0.04); this.body.add(this.neck);
    for (const s of [-1, 1] as const) { const w = new Group(); w.position.set(s * 0.45, 1.8, -0.1); this.part(heronWingGeometry(s), vm, w, 0.03); this.body.add(w); this.wings.push(w); }
    // the Tide Pearl on its chest: dim and calm normally, blazing and ringed while it preens (the weak spot)
    this.pearl = new Mesh(new SphereGeometry(0.26, 14, 10), new MeshLambertMaterial({ color: PEARL_BLUE[0], emissive: 0x4ab8f0, emissiveIntensity: 0.4 })) as HeronView['pearl'];
    this.pearl.position.set(0, 1.45, 0.86); this.pearlGlow.position.copy(this.pearl.position); this.pearlRing.position.copy(this.pearl.position); this.pearlRing.visible = false;
    this.body.add(this.pearl, this.pearlGlow, this.pearlRing);
    // a fan of light along the floor for the wing sweep, and ripples for the tidal ring
    this.sweepFan = new Mesh(new CylinderGeometry(1.2, 1.2, 12, 4, 1, true), new MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    this.sweepFan.rotation.x = Math.PI / 2; this.sweepFan.position.set(0, 0.9, 7); this.sweepFan.visible = false; this.sweepFan.renderOrder = 4; this.body.add(this.sweepFan);
    for (let i = 0; i < 2; i++) { const r = new Mesh(new TorusGeometry(1, 0.05, 6, 48), new MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })); r.rotation.x = Math.PI / 2; r.position.y = 0.15; r.visible = false; this.root.add(r); this.ripples.push(r); }
  }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, st = e.state, p = e.telegraphProgress, atk = e.currentAttack, ph2 = e.phase >= 2;
    if (!this.woke && st !== 'idle') { this.woke = true; this.roar = 1.6; this.cue('roar', 0, 1.5, 3, 1, 0x9fe8ff); }
    if (e.phase !== this.lastPhase) { this.lastPhase = e.phase; this.roar = 1.8; this.cue('roar', 0, 1.5, 3, 1, 0xffb050); }
    this.awake = damp(this.awake, this.woke ? 1 : 0, dt, 3); const sl = 1 - this.awake; this.roar = Math.max(0, this.roar - dt);
    if (e.hitCount !== this.lastHits) { this.lastHits = e.hitCount; this.flare = 1; this.pain = 0.35; this.cue('crystal', 0, 0.6, 2, 1, e.exposed ? 0xffe9a0 : 0xbff4ff); }
    this.flare = Math.max(0, this.flare - dt * 4); this.pain = Math.max(0, this.pain - dt); const pk = this.pain / 0.35;
    let lift = Math.sin(t * 1.3) * 0.03, pitch = 0, roll = Math.sin(t * 0.8) * 0.015, neckP = 0.1 + 0.5 * sl, neckY = Math.sin(t * 0.6) * 0.3 * this.awake, wingOpen = 0.12 + 0.05 * Math.sin(t * 1.5), wingFlap = 0, pearlT = 0.3 + 0.1 * Math.sin(t * 1.6) - 0.1 * sl, fan = 0, ring = 0, ringOn = false;
    switch (st) {
      case 'idle': neckP = 0.1 + 0.5 * sl + 0.05 * Math.sin(t * 1.1); break;
      case 'chase': { const k = Math.sin(t * 3.2); this.stepT += dt; lift = Math.abs(k) * 0.07; neckP = -0.15 + 0.1 * k; pitch = 0.05; wingOpen = 0.2; if (this.stepT > 0.4) { this.stepT = 0; this.cue('stomp', 0.4, 0.2, 0, 0.3); } break; }
      case 'telegraph':
        if (atk === 'waterSpout') { neckP = -0.5 * p; pitch = -0.1 * p; wingOpen = 0.5 + 0.5 * p; lift = 0.2 * p; }          // rears up, wings lifting, sky-calling
        else if (atk === 'wingSweep') { neckP = -0.3; wingOpen = 0.3 + 1.0 * p; roll = 0; wingFlap = Math.sin(t * 30) * 0.1 * p; }  // wings drawn wide and back
        else { neckP = 0.35 * p; pitch = 0.1 * p; wingOpen = 0.3 + 0.6 * p; lift = -0.1 * p; }                                 // the ring: crouches and gathers the sea
        pearlT = 0.6 + 0.3 * p; break;
      case 'strike':
        if (atk === 'wingSweep') { wingOpen = 1.5; neckP = 0.25; pitch = 0.1; fan = 1 - Math.min(1, e.t / e.def.strikeTime); }
        else if (atk === 'waterSpout') { neckP = 0.5; pitch = 0.18; wingOpen = 0.9; lift = 0.0; }
        else { neckP = 0.1; wingOpen = 1.2; ringOn = true; ring = Math.min(1, e.t / e.def.strikeTime); }
        pearlT = 0.8; break;
      case 'recover': { // preening: the head turns into the feathers and the chest pearl is bared and blazing
        const k = Math.min(1, e.t / (e.def.recoverTime * (ph2 ? 0.8 : 1))); neckP = 0.9; neckY = 1.0 * Math.sin(t * 2.2) * 0.3; pitch = -0.08; wingOpen = 0.25 + 0.1 * Math.sin(t * 8); lift = -0.05; pearlT = 1.2 + 0.2 * Math.sin(t * 9); void k; break; }
    }
    wingOpen += pk * 0.2;
    this.pearlK = damp(this.pearlK, pearlT, dt, 6);
    this.body.position.set(Math.sin(t * 50) * 0.04 * pk, lift, 0); this.body.rotation.set(pitch, 0, roll + Math.sin(t * 40) * 0.05 * pk);
    this.neck.rotation.set(neckP, neckY, 0); this.neck.position.y = 1.7 - 0.25 * Math.max(0, neckP);
    this.wings.forEach((w, i) => { const sd = i === 0 ? -1 : 1; w.rotation.set(0.05 * Math.sin(t * 1.4 + i), sd * -0.25 * wingOpen, sd * (0.12 + wingOpen * 0.9) + wingFlap * sd); });
    const exposed = e.exposed, pm = this.pearl.material;
    pm.emissiveIntensity = 0.2 + this.pearlK * 1.1 + this.flare * 1.2; pm.color.setHex(exposed ? PEARL_BLUE[1] : PEARL_BLUE[0]);
    this.pearl.scale.setScalar(1 + (exposed ? 0.45 + 0.15 * Math.sin(t * 10) : 0) + this.flare * 0.2);
    (this.pearlGlow.material as { opacity: number }).opacity = Math.min(1, 0.12 + this.pearlK * 0.55 + this.flare * 0.4); this.pearlGlow.scale.setScalar(2 + this.pearlK * 1.6 + (exposed ? 1.2 : 0));
    this.pearlRing.visible = exposed; if (exposed) { this.pearlRing.rotation.set(Math.PI / 2 + Math.sin(t * 2) * 0.4, t * 2.4, 0); (this.pearlRing.material as MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(t * 12); this.pearlRing.scale.setScalar(1 + 0.15 * Math.sin(t * 9)); }
    this.sweepFan.visible = fan > 0; (this.sweepFan.material as MeshBasicMaterial).opacity = 0.35 * fan;
    this.ringK = ringOn ? ring : Math.max(0, this.ringK - dt * 2);
    this.ripples.forEach((r, i) => { const k = Math.max(0, this.ringK - i * 0.18); r.visible = k > 0.01; r.scale.setScalar(0.5 + k * 5.4); (r.material as MeshBasicMaterial).opacity = 0.7 * (1 - k * 0.6) * Math.min(1, k * 4); });
  }
  protected defeat(t: number, _dt: number, k: number): void {
    // the neck droops, the wings fold, the Tide Pearl rises free as a column of blue light, and the heron sinks into the sea mist
    const u = k < 0.35 ? 0 : (k - 0.35) / 0.65; this.neck.rotation.set(0.9 + u * 0.4, Math.sin(t * 3) * 0.2 * (1 - u), 0);
    this.wings.forEach((w, i) => { const sd = i === 0 ? -1 : 1; w.rotation.set(0, 0, sd * (0.6 - u * 0.5)); });
    this.body.position.set(0, -easeInOut(u) * 0.6, 0); this.body.rotation.set(-0.1 * u, 0, 0);
    this.pearl.position.y = 1.45 + u * 3; this.pearl.scale.setScalar(1 + u); (this.pearlGlow.material as { opacity: number }).opacity = 0.9; this.pearlGlow.position.y = this.pearl.position.y; this.pearlGlow.scale.setScalar(4 + u * 4);
    this.sweepFan.visible = false; this.ripples.forEach(r => { r.visible = false; }); this.pearlRing.visible = false;
    this.root.scale.setScalar(Math.max(0.001, 1 - easeInOut(Math.max(0, (k - 0.8) / 0.2))));
  }
}

// ================================================================================================================================ people
/** The look of one of the shore's two people. */
interface NpcLook { coat: number; trim: number; hat: number; skin: number; hair: number; tall: boolean; beard: boolean; lantern: boolean }
const MAK: NpcLook = { coat: 0x2f6fa8, trim: 0xf0d27a, hat: 0xf4f0e4, skin: 0xd9a47c, hair: 0xe8e4dc, tall: false, beard: true, lantern: false };
const KEEPER: NpcLook = { coat: 0x7a4a3a, trim: 0xe8c860, hat: 0x2b3a5c, skin: 0xc98f68, hair: 0x4a3a30, tall: true, beard: false, lantern: true };

/** A friendly talker for the shore: bobs, turns to the hero, bounces while talking, waves hello, floats a "!" when he has something to say. */
export class ShoreNpc {
  readonly root = new Group(); private readonly body = new Group(); private readonly head = new Group(); private readonly armR = new Group(); private readonly marker = new Group();
  private readonly lanternGlow = glowSprite(0xffe9a0, 1.2, 0.5);
  private talk = 0; private talking = false; private wave_ = 0; private last = -1; private lit = 0; private litTarget = 0;
  constructor(kind: 'mak' | 'keeper') {
    const L = kind === 'mak' ? MAK : KEEPER, h = L.tall ? 1.0 : 0.9;
    this.root.add(blobShadow(0.5));
    const k = new Kit();
    k.ball(0.34, 0, 0.62 * h, 0, L.coat, 1, 1.25 * h, 0.85, 2); k.cyl(0.36, 0.4, 0.08, 10, 0, 0.1, 0, L.trim); k.box(0.5, 0.06, 0.34, 0, 0.78 * h, 0.02, L.trim);
    for (const s of [-1, 1]) { k.cyl(0.07, 0.08, 0.28, 6, s * 0.14, 0.05, 0.04, 0x2a2a3a); k.ball(0.09, s * 0.14, 0.02, 0.1, 0x2a2a3a, 1, 0.6, 1.4, 1); }
    const bodyMesh = addMesh(this.body, k.build(0.12, 0.8), withPaint(new MeshLambertMaterial({ vertexColors: true })), 0.03);
    void bodyMesh;
    const hk = new Kit();
    hk.ball(0.24, 0, 0, 0, L.skin, 1, 1.05, 1, 2);
    for (const s of [-1, 1]) { hk.ball(0.035, s * 0.09, 0.03, 0.21, 0x1c1c26, 1, 1.3, 0.6, 0); hk.ball(0.04, s * 0.15, -0.03, 0.18, 0xf0a090, 1, 0.7, 0.5, 1); hk.add(new BoxGeometry(0.1, 0.025, 0.03), L.hair, M(s * 0.09, 0.1, 0.2, 0, 0, s * -0.15)); }
    hk.ball(0.04, 0, -0.02, 0.24, 0xc88a64, 1, 1, 1.2, 1);
    if (L.beard) { hk.ball(0.17, 0, -0.17, 0.1, L.hair, 1.2, 1, 0.9, 1); hk.ball(0.08, -0.07, -0.06, 0.22, L.hair, 1.5, 0.5, 1, 1); hk.ball(0.08, 0.07, -0.06, 0.22, L.hair, 1.5, 0.5, 1, 1); }
    if (kind === 'mak') { hk.cyl(0.26, 0.27, 0.12, 12, 0, 0.17, 0, L.hat); hk.cyl(0.19, 0.23, 0.14, 12, 0, 0.27, 0, L.hat); hk.cyl(0.285, 0.285, 0.03, 12, 0, 0.12, 0, 0x2f4a78); hk.ball(0.04, 0, 0.14, 0.27, L.trim, 1, 1, 0.5, 0); }   // a sailor's cap
    else { hk.cyl(0.25, 0.28, 0.07, 12, 0, 0.12, 0, L.hat); hk.cyl(0.2, 0.24, 0.16, 12, 0, 0.23, 0, L.hat); hk.box(0.4, 0.03, 0.2, 0, 0.14, 0.2, 0x1a2540); hk.ball(0.04, 0, 0.18, 0.25, L.trim, 1, 1, 0.5, 0); hk.ball(0.12, 0, -0.14, 0.12, 0xb8b0a0, 1.2, 0.8, 0.9, 1); }   // a keeper's peaked cap and grey whiskers
    this.head.position.y = (h > 0.95 ? 1.28 : 1.1); addMesh(this.head, hk.build(0, 1), withPaint(new MeshLambertMaterial({ vertexColors: true })), 0.025); this.body.add(this.head);
    const ak = new Kit(); ak.add(new CylinderGeometry(0.06, 0.07, 0.4, 6), L.coat, M(0.04, -0.2, 0.05, 0.3, 0, 0.15)); ak.ball(0.07, 0.07, -0.4, 0.12, L.skin, 1, 1, 1, 1);
    addMesh(this.armR, ak.build(0, 1), withPaint(new MeshLambertMaterial({ vertexColors: true })), 0.02); this.armR.position.set(0.34, 0.98 * h, 0); this.body.add(this.armR);
    const armL = new Group(); armL.position.set(-0.34, 0.98 * h, 0); const al = new Kit(); al.add(new CylinderGeometry(0.06, 0.07, 0.4, 6), L.coat, M(-0.04, -0.2, 0.05, 0.3, 0, -0.15)); al.ball(0.07, -0.07, -0.4, 0.12, L.skin, 1, 1, 1, 1);
    addMesh(armL, al.build(0, 1), withPaint(new MeshLambertMaterial({ vertexColors: true })), 0.02); this.body.add(armL);
    if (L.lantern) { const lk = new Kit(); lk.cyl(0.012, 0.012, 0.22, 4, 0, 0.1, 0, 0x4a3a2a); lk.box(0.14, 0.18, 0.14, 0, -0.06, 0, 0xffd878); lk.cyl(0.02, 0.09, 0.05, 6, 0, 0.06, 0, 0x4a3a2a); const lg = new Group(); addMesh(lg, lk.build(0, 1), new MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4a10, emissiveIntensity: 0.8 })); lg.position.set(-0.46, 0.5 * h, 0.2); this.lanternGlow.position.set(-0.46, 0.44 * h, 0.2); this.body.add(lg, this.lanternGlow); }
    else this.lanternGlow.visible = false;
    this.root.add(this.body);
    const yellow = new MeshBasicMaterial({ color: 0xffe066 }); this.marker.position.y = h > 0.95 ? 2.2 : 2.0;
    const bar = new Mesh(new BoxGeometry(0.1, 0.26, 0.1), yellow); bar.position.y = 0.12; const dot = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), yellow); dot.position.y = -0.1; this.marker.add(bar, dot); this.root.add(this.marker);
    this.root.userData.h = h;
  }
  setMarker(v: boolean): void { this.marker.visible = v; }
  setTalking(on: boolean): void { this.talking = on; }
  /** Glows warmer once his request is done (the keeper's lantern). */
  setLit(on: boolean): void { this.litTarget = on ? 1 : 0; }
  wave(seconds = 1.5): void { this.wave_ = Math.max(this.wave_, seconds); }
  update(t: number, facing: number): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.last)); this.last = t;
    this.talk += ((this.talking ? 1 : 0) - this.talk) * Math.min(1, dt * 6); this.wave_ = Math.max(0, this.wave_ - dt); this.lit += (this.litTarget - this.lit) * Math.min(1, dt * 2.5);
    const wk = this.wave_ > 0 ? Math.min(1, this.wave_ * 3, (1.5 - this.wave_) * 5 + 0.2) : 0;
    this.root.rotation.y = facing + Math.sin(t * 0.5) * 0.08 * (1 - this.talk);
    this.body.position.y = Math.sin(t * 1.6) * 0.015 + Math.abs(Math.sin(t * 6)) * 0.04 * this.talk;
    this.head.rotation.set(Math.sin(t * 0.8) * 0.04 - 0.1 * this.talk * (0.5 + 0.5 * Math.sin(t * 3)), Math.sin(t * 0.6) * 0.15 * (1 - this.talk), 0);
    this.armR.rotation.set(-0.2 * this.talk * Math.sin(t * 4) - wk * 2.4, 0, -wk * 0.4 + Math.sin(t * 9) * 0.25 * wk);
    (this.lanternGlow.material as { opacity: number }).opacity = 0.35 + 0.3 * this.lit + 0.05 * Math.sin(t * 5); this.lanternGlow.scale.setScalar(1.0 + 0.5 * this.lit);
    this.marker.position.y = (this.root.userData.h > 0.95 ? 2.2 : 2.0) + Math.sin(t * 3) * 0.07; this.marker.rotation.y = t * 1.6;
  }
}
