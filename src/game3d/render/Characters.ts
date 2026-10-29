import { withPaint } from './stylize';
import {
  AdditiveBlending, BoxGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Matrix4, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, OctahedronGeometry, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import type { Enemy, EnemyState, Shape } from '../systems/enemies';
import { Spring, bump, easeInOut, easeOutBack, easeOutCubic, recoilImpulse, sproutStyle, type SproutStyle } from '../systems/charAnim';
import { addWorldOutline } from './env/worldOutline';
import { blobShadow, glowSprite, lambert, mesh } from './common';
import { MOSS_SHELL_Y, mossHeadGeometry, mossJawGeometry, mossLegGeometry, mossShellGeometry, mossSpikesGeometry, mossSurface, mossTailGeometry, sproutBodyGeometry, sproutLeafGeometry, elderBodyGeometry, elderArmGeometry, elderHeadGeometry, ELDER_NECK_Y, ELDER_SHOULDER, elderStaffGeometry, glimBodyGeometry, shardlingBodyGeometry, shardlingCrestGeometry, WARDEN_NECK_Y, wardenBodyGeometry, wardenFistGeometry, wardenHeadGeometry, wardenHeartGeometry, petalFlowerGeometry, petalStemGeometry, runeStoneGeometry } from './env/characterGeo';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Elder Tok Wan: a robed mentor built from parts (robe, two arms, head with hat and beard) so he can breathe, glance around,
 * blink, nod while he talks, wave hello and raise his staff when a quest is done. Same cartoon outline as the hero.
 */
export class ElderModel {
  readonly root = new Group();
  private readonly marker = new Group();
  private readonly orb: Group;
  private readonly orbGlow: ReturnType<typeof glowSprite>;
  private readonly staff = new Group();
  private readonly torso = new Group();
  private readonly head = new Group();
  private readonly arms: Group[] = [];
  private readonly lids: Mesh[] = [];
  private readonly brows: Mesh[] = [];
  private readonly nod = new Spring(110, 8);
  private talk = 0; private talking = false; private wave_ = 0; private cheer_ = 0;
  private last = -1; private nextNod = 0.4; private nextBlink = 2; private blinkT = -1; private cheerCued = false;
  constructor() {
    this.root.add(blobShadow(0.6));
    const vc = withPaint(new MeshLambertMaterial({ vertexColors: true }));
    const part = (g: ReturnType<typeof elderBodyGeometry>, parent: Group, th = 0.03): Mesh => { const m = new Mesh(g, vc); addWorldOutline(m, th); parent.add(m); return m; };
    this.root.add(this.torso);
    part(elderBodyGeometry(), this.torso);
    this.head.position.y = ELDER_NECK_Y; part(elderHeadGeometry(), this.head, 0.026); this.torso.add(this.head);
    for (const s of [-1, 1] as const) {
      const arm = new Group(); arm.position.set(s * ELDER_SHOULDER.x, ELDER_SHOULDER.y, ELDER_SHOULDER.z); part(elderArmGeometry(s), arm, 0.022); this.torso.add(arm); this.arms.push(arm);
    }
    // eyelids: skin-coloured shells over the eyes that close for a blink
    const lidMat = new MeshLambertMaterial({ color: 0xe0b08a });
    for (const s of [-1, 1]) { const lid = new Mesh(new SphereGeometry(0.047, 10, 8), lidMat); lid.position.set(s * 0.07, 1.25 - ELDER_NECK_Y, 0.176); lid.scale.set(1, 0.01, 0.7); lid.visible = false; this.head.add(lid); this.lids.push(lid); }
    // bushy white brows that lift when he talks, wave and cheer
    const browMat = new MeshLambertMaterial({ color: 0xf6f4ee });
    for (const s of [-1, 1]) { const b = new Mesh(new SphereGeometry(0.06, 10, 8), browMat); b.position.set(s * 0.075, 1.31 - ELDER_NECK_Y, 0.16); b.scale.set(1.5, 0.6, 1); this.head.add(b); this.brows.push(b); }
    this.staff.position.set(0.42, 0, 0.42);
    const staffMesh = new Mesh(elderStaffGeometry(), vc); addWorldOutline(staffMesh, 0.02); this.staff.add(staffMesh);
    this.orb = new Group(); this.orb.position.y = 1.62;
    this.orb.add(mesh(new IcosahedronGeometry(0.1, 0), new MeshLambertMaterial({ color: 0xbfffd8, emissive: 0x6cffb0, emissiveIntensity: 1 })));
    this.orbGlow = glowSprite(0x8dffc0, 0.9, 0.8); this.orb.add(this.orbGlow);
    this.staff.add(this.orb); this.root.add(this.staff);
    // "!" marker above the head: a bar and a dot
    this.marker.position.y = 2.2;
    const yellow = new MeshBasicMaterial({ color: 0xffe066 });
    this.marker.add(mesh(new BoxGeometry(0.1, 0.26, 0.1), yellow, 0, 0.12, 0));
    this.marker.add(mesh(new BoxGeometry(0.1, 0.1, 0.1), yellow, 0, -0.1, 0));
    this.root.add(this.marker);
  }
  setMarker(visible: boolean): void { this.marker.visible = visible; }
  /** He is in conversation: nods along and gestures with his free hand. */
  setTalking(on: boolean): void { this.talking = on; }
  /** A friendly wave when the hero walks up. */
  wave(seconds = 1.7): void { this.wave_ = Math.max(this.wave_, seconds); }
  /** Quest complete: both arms up, staff raised, orb flares. Returns true once so the scene can add its sparkles. */
  cheer(seconds = 1.9): void { this.cheer_ = seconds; this.cheerCued = false; }
  /** True for the single frame when the cheer reaches its peak (the scene bursts sparkles then). */
  takeCheerCue(): boolean { if (this.cheer_ > 0 && !this.cheerCued && this.cheer_ < 1.55) { this.cheerCued = true; return true; } return false; }
  update(t: number, facing: number): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.last)); this.last = t;
    this.root.rotation.y = facing;
    this.talk += ((this.talking ? 1 : 0) - this.talk) * Math.min(1, dt * 6);
    this.wave_ = Math.max(0, this.wave_ - dt); this.cheer_ = Math.max(0, this.cheer_ - dt);
    const wk = this.wave_ > 0 ? Math.min(1, this.wave_ * 4, (1.7 - this.wave_) * 5 + 0.2) : 0;
    const ck = this.cheer_ > 0 ? Math.min(1, this.cheer_ * 3, (1.9 - this.cheer_) * 4 + 0.15) : 0;
    // breathing + a lazy sway in the robe
    const br = Math.sin(t * 1.7);
    this.torso.scale.y = 1 + br * 0.012; this.torso.rotation.z = Math.sin(t * 0.8) * 0.012 + Math.sin(t * 9) * 0.004 * this.talk;
    this.torso.position.y = bump(1 - this.cheer_ / 1.9) * 0.09 * (this.cheer_ > 0 ? 1 : 0) * Math.abs(Math.sin(t * 8));
    // head: slow glances, a settled look when talking, nods that spring back
    this.nextNod -= dt;
    if (this.talking && this.nextNod <= 0) { this.nod.kick(2.2 + Math.random() * 1.2); this.nextNod = 0.55 + Math.random() * 0.7; }
    this.nod.step(dt);
    const glance = 1 - this.talk * 0.75;
    this.head.rotation.y = (Math.sin(t * 0.45) * 0.18 + Math.sin(t * 0.9 + 1) * 0.06) * glance;
    this.head.rotation.x = Math.sin(t * 0.6) * 0.03 + this.nod.value * 0.22 - ck * 0.18;
    this.head.rotation.z = Math.sin(t * 0.7 + 2) * 0.03 * glance + wk * 0.08;
    this.head.position.y = ELDER_NECK_Y + br * 0.006;
    // brows: a slow idle twitch, raised while he talks (one then the other), high when he waves or cheers
    const talkLift = this.talk * (0.35 + 0.35 * Math.sin(t * 3.1));
    this.brows.forEach((b, i) => {
      const lift = Math.max(0, Math.sin(t * 0.5 + 1) - 0.85) * 2 + talkLift * (i === 0 ? 1 : 0.6) + wk * 0.7 + ck;
      b.position.y = 1.31 - ELDER_NECK_Y + lift * 0.022; b.rotation.z = (i === 0 ? 1 : -1) * (0.12 - lift * 0.18);
    });
    // blinking (a double blink now and then)
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) { this.blinkT = 0; this.nextBlink = Math.random() < 0.25 ? 0.22 : 2.2 + Math.random() * 3; }
    if (this.blinkT >= 0) { this.blinkT += dt; if (this.blinkT > 0.17) this.blinkT = -1; }
    const closed = this.blinkT < 0 ? 0 : Math.sin((this.blinkT / 0.17) * Math.PI);
    for (const l of this.lids) { l.scale.y = Math.max(0.01, closed); l.visible = closed > 0.05; }
    // arms: left is free (gestures and waves), right holds the staff
    const left = this.arms[0], right = this.arms[1];
    const gesture = 0.5 + 0.5 * Math.sin(t * 2.6);
    left.rotation.x = Math.sin(t * 1.7 + 0.5) * 0.03 - (0.55 + gesture * 0.35) * this.talk - (1.7 + Math.sin(t * 9) * 0.1) * wk - 2.3 * ck;
    left.rotation.z = -0.06 * this.talk + Math.sin(t * 5.2) * 0.12 * this.talk + Math.sin(t * 9) * 0.38 * wk - 0.25 * ck;
    right.rotation.x = Math.sin(t * 1.7) * 0.03 - 0.25 * this.talk * gesture - 2.0 * ck;
    right.rotation.z = 0.2 * ck;
    // the staff stays in the right hand and lifts with it
    this.staff.position.y = 0.16 * ck + bump(1 - this.cheer_ / 1.9) * 0.06 * (this.cheer_ > 0 ? 1 : 0);
    this.staff.rotation.z = Math.sin(t * 1.1) * 0.025 - 0.12 * ck; this.staff.rotation.x = 0.05 * ck;
    // orb: gentle bob, flares on the cheer
    this.orb.position.y = 1.62 + Math.sin(t * 2) * 0.04; this.orb.scale.setScalar(1 + ck * 0.7 + Math.sin(t * 3) * 0.05);
    this.orbGlow.material.opacity = 0.8 + ck * 0.2;
    this.marker.position.y = 2.2 + Math.sin(t * 3) * 0.07; this.marker.rotation.y = t * 1.6;
  }
}

/** A one-off happening a view wants the scene to dress with particles, sound or camera shake (the views have no access to those). */
export interface EnemyCue { kind: 'stomp' | 'roar' | 'snort' | 'ember' | 'dust' | 'alert' | 'steam' | 'slam' | 'crystal' | 'shatter'; x: number; y: number; z: number; power?: number; color?: number }

/** Common wrapper: a mesh group tied to a logic `Enemy`, with hit recoil, outlines and a per-creature defeat animation. */
export abstract class EnemyView {
  readonly root = new Group();
  protected readonly body = new Group();
  protected readonly mats: MeshLambertMaterial[] = [];
  protected appear = 0;
  /** Hit recoil: a spring along the direction the blow came from (in the creature's own frame), added after every pose. */
  protected readonly recoil = new Spring(240, 15);
  protected recoilX = 0; protected recoilZ = -1;
  protected abstract readonly mass: number;
  protected outlineOn = true;
  private cues: EnemyCue[] = [];
  constructor(readonly enemy: Enemy) { this.root.add(this.body); }
  protected mat(color: number): MeshLambertMaterial { const m = lambert(color); this.mats.push(m); return m; }
  /** Vertex-coloured material that takes part in the hurt flash. */
  protected vmat(): MeshLambertMaterial { const m = withPaint(new MeshLambertMaterial({ vertexColors: true })); this.mats.push(m); return m; }
  /** A body part with its cartoon outline (skipped when outlines are off). */
  protected part(geo: ReturnType<typeof sproutBodyGeometry>, material: MeshLambertMaterial, parent: Group, thickness: number): Mesh {
    const m = new Mesh(geo, material); if (this.outlineOn) addWorldOutline(m, thickness); parent.add(m); return m;
  }
  /** A point given in the creature's own frame (x right, z forward) as a world x/z. */
  protected world(lx: number, lz: number): { x: number; z: number } {
    const h = this.enemy.heading, c = Math.cos(h), s = Math.sin(h);
    return { x: this.root.position.x + lx * c + lz * s, z: this.root.position.z - lx * s + lz * c };
  }
  protected cue(kind: EnemyCue['kind'], lx: number, lz: number, up = 0, power = 1, color?: number): void {
    if (this.cues.length > 24) return;
    const w = this.world(lx, lz); this.cues.push({ kind, x: w.x, y: this.root.position.y + up, z: w.z, power, color });
  }
  /** The scene collects these every frame and turns them into dust, sparks, sound and shaking. */
  takeCues(): EnemyCue[] { if (!this.cues.length) return this.cues; const c = this.cues; this.cues = []; return c; }
  /** The scene calls this when a blow lands: `dir` points away from the hero, `step` is the combo step (0..2, 3 = spin). */
  react(dirX: number, dirZ: number, step: number): void {
    const h = this.enemy.heading, c = Math.cos(h), s = Math.sin(h);
    this.recoilX = dirX * c - dirZ * s; this.recoilZ = dirX * s + dirZ * c;   // into the creature's local frame (x right, z forward)
    this.recoil.kick(recoilImpulse(step, this.mass) * 9);
  }
  protected abstract animate(t: number, dt: number): void;
  /** `k` runs 0..1 over the enemy's `deathTime`. */
  protected abstract defeat(t: number, dt: number, k: number): void;
  update(t: number, dt: number, y: number): void {
    const e = this.enemy;
    this.appear = Math.min(1, this.appear + dt * 3);
    this.root.position.set(e.pos.x, y, e.pos.z);
    this.root.rotation.y = e.heading;
    const f = e.hurtFlash > 0 ? e.hurtFlash / 0.18 : 0;
    for (const m of this.mats) m.emissive.setRGB(f * 0.9, f * 0.9, f * 0.9);
    this.recoil.step(dt);
    if (e.defeated) {
      const k = Math.min(1, e.poof / e.def.deathTime);
      this.defeat(t, dt, k);
      this.root.visible = k < 1;
      return;
    }
    this.root.scale.setScalar(Math.max(0.001, easeOutBack(this.appear)));
    this.animate(t, dt);
    // the shove from the last blow: the body slides and tips away from the hero, then springs back
    const a = this.recoil.value;
    this.body.position.x += this.recoilX * a * 0.09; this.body.position.z += this.recoilZ * a * 0.09;
    this.body.rotation.x += this.recoilZ * a * 0.07; this.body.rotation.z -= this.recoilX * a * 0.07;
  }
}

/**
 * A grumpy little sprout: a green bulb with a leaf tuft. Each one has its own temperament (bouncy, sleepy or jittery) and size.
 * v2.27: it now scowls (animated brows), shouts with a mouth full of tiny fangs, steams before its hop and kicks up dust when it lands.
 */
export class SproutView extends EnemyView {
  protected readonly mass = 1;
  private readonly tuft = new Group();
  private readonly lids: Mesh[] = [];
  private readonly brows: Mesh[] = [];
  private readonly fangs: Mesh[] = [];
  private readonly mouth: Mesh;
  private readonly style: SproutStyle;
  private prev: EnemyState = 'idle'; private notice = 0; private blink = -1; private nextBlink: number;
  private air = false; private steamT = 0; private anger = 0;
  constructor(enemy: Enemy, outlines = true) {
    super(enemy);
    this.outlineOn = outlines; this.style = sproutStyle(enemy.id); this.nextBlink = 1 + (enemy.id % 5) * 0.6;
    this.root.add(blobShadow(0.55 * this.style.scale));
    this.part(sproutBodyGeometry(), this.vmat(), this.body, 0.03);
    this.tuft.position.y = 0.88;
    this.part(sproutLeafGeometry(), this.vmat(), this.tuft, 0.022);
    this.body.add(this.tuft);
    const lidMat = this.mat(0x8fcf52);
    for (const s of [-1, 1]) { const lid = new Mesh(new SphereGeometry(0.125, 10, 8), lidMat); lid.position.set(s * 0.17, 0.58, 0.372); lid.scale.set(1, 0.01, 0.8); lid.visible = false; this.body.add(lid); this.lids.push(lid); }
    const browMat = this.mat(0x2a5f27), browGeo = new BoxGeometry(0.25, 0.075, 0.06);
    for (const s of [-1, 1]) { const b = new Mesh(browGeo, browMat); b.position.set(s * 0.17, 0.74, 0.4); this.body.add(b); this.brows.push(b); }
    this.mouth = new Mesh(new SphereGeometry(0.1, 10, 8), new MeshBasicMaterial({ color: 0x3a1014 })); this.mouth.position.set(0, 0.2, 0.372); this.mouth.scale.set(1.2, 0.05, 0.4); this.body.add(this.mouth);
    const fangMat = this.mat(0xfffbe8), fangGeo = new ConeGeometry(0.03, 0.085, 4);
    for (const s of [-1, 1]) { const f = new Mesh(fangGeo, fangMat); f.rotation.x = Math.PI; f.position.set(s * 0.06, 0.2, 0.385); f.visible = false; this.body.add(f); this.fangs.push(f); }
    this.body.scale.setScalar(this.style.scale);
  }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, st = this.style, ph = e.id * 1.7, p = e.telegraphProgress, was = this.prev;
    if (this.prev === 'idle' && e.state === 'chase') { this.notice = 0.55; this.cue('alert', 0, 0, 1.5); }   // spotted the hero: a little jump of surprise
    if (was === 'strike' && e.state === 'recover') this.cue('slam', 0, 0.9, 0.05, 0.5);                     // landed: a puff of dust
    this.prev = e.state; this.notice = Math.max(0, this.notice - dt);
    let y = 0, squash = 1, lean = 0, yaw = 0, tuftZ = Math.sin(t * 5 + ph) * st.leaf, tuftS = 1, wob = 0, angry = 0, mouth = 0.05;
    let air = false;
    switch (e.state) {
      case 'idle': {
        squash = 1 + Math.sin(t * st.breath + ph) * 0.045;
        yaw = Math.sin(t * st.look + ph) * 0.55 * (0.6 + 0.4 * Math.sin(t * 0.37 + ph));
        const cyc = (t * 0.15 + ph * 0.13) % 1;
        if (st.temperament === 'sleepy' && cyc < 0.12) { const yn = bump(cyc / 0.12); squash += yn * 0.16; tuftZ += yn * 0.3; tuftS = 1 - yn * 0.2; mouth = 0.2 + yn * 0.8; }   // a big yawn
        break;
      }
      case 'chase': {
        angry = 0.7; mouth = 0.3;
        if (this.notice > 0) { const n = 1 - this.notice / 0.55; y = bump(n) * 0.4; squash = 1 + bump(n) * 0.18; tuftS = 1 + bump(n) * 0.5; mouth = 0.9; break; }
        const hop = Math.abs(Math.sin(t * st.hopRate + ph)); air = hop > 0.12;
        y = hop * st.hopHeight; squash = 1 + Math.cos(t * st.hopRate + ph) * 0.07; lean = 0.14 * (air ? 1 : 0); tuftZ = -0.25 * hop + Math.sin(t * 5 + ph) * st.leaf * 0.5; tuftS = 1 + hop * 0.15;
        mouth = 0.25 + hop * 0.4;
        if (st.temperament === 'jittery') yaw = Math.sin(t * 13 + ph) * 0.12;
        break;
      }
      case 'telegraph': squash = 1 - 0.28 * Math.min(1, p * 1.5); lean = -0.1 * p; wob = Math.sin(t * 60) * 0.03 * p; tuftZ = 0.55 * p; tuftS = 1 - 0.25 * p; angry = 1; mouth = 0.3 + 0.7 * p;
        this.steamT -= dt; if (this.steamT <= 0) { this.steamT = 0.16; this.cue('steam', 0, 0, 0.95, 1, 0xff9a6a); }   // crouches, shivers and steams before the hop
        break;
      case 'strike': { const k = Math.min(1, e.t / 0.2); y = Math.sin(k * Math.PI) * 0.9; squash = 1.2; lean = 0.38 * Math.sin(k * Math.PI); tuftZ = -0.5; tuftS = 1.25; angry = 1; mouth = 1; break; }
      case 'recover': { const k = Math.min(1, e.t / 0.6); squash = 0.88 + k * 0.12; wob = Math.sin(t * 9) * 0.04 * (1 - k); tuftZ = 0.35 * (1 - k) + Math.sin(t * 8) * 0.12 * (1 - k); yaw = Math.sin(t * 6) * 0.35 * (1 - k); angry = 0.2; mouth = 0.45 + Math.sin(t * 12) * 0.15; break; }   // dizzy, panting
    }
    if (this.air && !air && e.state === 'chase') this.cue('dust', 0, 0, 0.05, 0.3);   // each hop lands with a tiny puff
    this.air = air;
    this.body.position.set(wob, y * st.scale, 0); this.body.rotation.set(lean, yaw, 0);
    const s = st.scale; this.body.scale.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
    this.tuft.rotation.z = tuftZ; this.tuft.scale.setScalar(tuftS);
    // face: brows slant down toward the nose as it gets angry, the mouth opens and shows its fangs
    this.anger += (angry - this.anger) * Math.min(1, dt * 14);
    this.brows.forEach((b, i) => { const sd = i === 0 ? -1 : 1; b.rotation.z = sd * (this.anger * 0.62 - 0.1); b.position.y = 0.745 - 0.035 * this.anger; b.position.z = 0.4 + 0.02 * this.anger; });
    this.mouth.scale.y = Math.max(0.05, mouth); this.fangs.forEach(f => { f.visible = mouth > 0.3; f.position.y = 0.2 + this.mouth.scale.y * 0.07; });
    // blink
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blink < 0) { this.blink = 0; this.nextBlink = 1.6 + ((e.id * 7) % 5) * 0.5; }
    if (this.blink >= 0) { this.blink += dt; if (this.blink > 0.16) this.blink = -1; }
    const closed = this.blink < 0 ? (e.state === 'recover' ? 0.55 : 0) : Math.sin((this.blink / 0.16) * Math.PI);
    for (const l of this.lids) { l.scale.y = Math.max(0.01, closed); l.visible = closed > 0.05; }
    const isAngry = e.state === 'telegraph', [tr, tg, tb] = st.tint;
    this.mats[0].color.setRGB(tr, isAngry ? tg * 0.62 : tg, isAngry ? tb * 0.55 : tb);
  }
  protected defeat(_t: number, _dt: number, k: number): void {
    // squashed flat by the blow, then it spins up and pops away like a seed
    const sq = easeOutCubic(k / 0.3), u = k < 0.3 ? 0 : (k - 0.3) / 0.7, s = this.style.scale;
    this.body.position.set(0, easeInOut(u) * 0.7 * s, 0); this.body.rotation.set(0, u * u * 9, 0);
    this.body.scale.set(s * (1 + 0.35 * sq * (1 - u)), s * (1 - 0.45 * sq * (1 - u)), s * (1 + 0.35 * sq * (1 - u)));
    this.tuft.rotation.z = 0.5 + u * 3; this.lids.forEach(l => { l.scale.y = 1; l.visible = true; });
    this.mouth.scale.y = 0.8; this.brows.forEach((b, i) => { b.rotation.z = (i === 0 ? -1 : 1) * -0.3; });   // an "ow" face
    this.root.scale.setScalar(Math.max(0.001, 1 - easeInOut(u)));
  }
}

const EYE_COOL = new Color(0xffc23a), EYE_HOT = new Color(0xff4a2a), EYE_WHITE = new Color(0xfff4cf);

/**
 * The Old Mossback: a huge, cracked stone tortoise with a spiked back, glowing crystals and a mouthful of tusks. Heavy and slow, but it
 * is now properly menacing: it roars when it first sees you, bristles its thorns, growls with its jaw, stomps (dust and a rumble in the
 * ground), rears up for the slam, gnashes its teeth and paws the ground before a charge, swells with green spores, lashes its club tail
 * and leaks embers from its cracks. At half health it turns red-hot and roars again. When beaten it shudders, slumps, lets its crystals
 * float away and sinks into the grass.
 */
export class MossbackView extends EnemyView {
  protected readonly mass = 4;
  private readonly legs: Group[] = [];
  private readonly head = new Group();
  private readonly jaw = new Group();
  private readonly spikes = new Group();
  private readonly tail = new Group();
  private readonly crystals: { m: Mesh; y: number; r: number }[] = [];
  private readonly eyes: { ball: Mesh; slit: Mesh; glow: ReturnType<typeof glowSprite>; s: number }[] = [];
  private readonly throat = glowSprite(0xff7a30, 1.3, 0);
  private readonly eyeMat = new MeshBasicMaterial({ color: 0xffc23a });
  private readonly crackMat = new MeshBasicMaterial({ color: 0xff8a30 });
  private readonly crystalMat = new MeshLambertMaterial({ color: 0x66e0cf, emissive: 0x22b8a6, emissiveIntensity: 0.8, flatShading: true });
  private roar = 0; private roarDur = 2; private seen = false; private lastPhase = 1; private flare = 0; private lastHits = 0; private pain = 0;
  private jawOpen = 0; private bristle = 1; private stepSign = [1, 1, 1, 1]; private dustT = 0; private emberT = 0.3; private snortT = 2; private tailYaw = 0;
  constructor(enemy: Enemy) {
    super(enemy);
    this.root.add(blobShadow(1.9));
    const vm = this.vmat();
    this.part(mossShellGeometry(), vm, this.body, 0.07);
    this.spikes.position.y = MOSS_SHELL_Y; this.part(mossSpikesGeometry(), vm, this.spikes, 0.035); this.body.add(this.spikes);
    // glowing cracks across the shell: short zigzag strips lying on its surface
    for (const [x0, z0, a0] of [[0.4, -0.2, 0.5], [-0.55, 0.5, 2.4], [0.85, 0.85, 1.1], [-0.95, -0.6, -0.4], [0.15, 0.75, 3.1], [0.65, -1.0, -1.8], [-0.25, -0.9, -2.6]] as const) {
      let x = x0, z = z0;
      for (let j = 0; j < 4; j++) {
        const a = a0 + (j % 2 ? 0.8 : -0.8), len = 0.3, mx = x + Math.sin(a) * len / 2, mz = z + Math.cos(a) * len / 2, { p, n } = mossSurface(mx, mz);
        const d = new Vector3(Math.sin(a), 0, Math.cos(a)), nz = d.addScaledVector(n, -d.dot(n)).normalize(), nx = new Vector3().crossVectors(n, nz).normalize();
        const c = new Mesh(new BoxGeometry(0.07, 0.07, len * 1.2), this.crackMat);
        c.position.copy(p).addScaledVector(n, 0.06); c.position.y += MOSS_SHELL_Y; c.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(nx, n.clone(), nz));
        this.body.add(c); this.cracks.push(c); x += Math.sin(a) * len; z += Math.cos(a) * len;
      }
    }
    for (const [x, z, s, r] of [[0.5, -0.5, 0.5, 0.25], [-0.55, 0.35, 0.42, -0.3], [0.95, 0.45, 0.32, 0.3], [-1.0, -0.7, 0.36, -0.25], [0.15, 0.95, 0.3, 0.1]] as const) {
      const c = mesh(new OctahedronGeometry(s, 0), this.crystalMat, x, MOSS_SHELL_Y + mossSurface(x, z).p.y - 0.1 + s * 0.4, z); c.scale.y = 1.9; c.rotation.z = r; this.body.add(c); this.crystals.push({ m: c, y: c.position.y, r });
    }
    this.tail.position.set(0, 0.95, -1.8); this.part(mossTailGeometry(), vm, this.tail, 0.045); this.body.add(this.tail);
    this.head.position.set(0, 1.0, 1.75); this.head.scale.setScalar(1.3);
    this.part(mossHeadGeometry(), vm, this.head, 0.05);
    this.jaw.position.set(0, -0.12, 0.05); this.part(mossJawGeometry(), vm, this.jaw, 0.04); this.head.add(this.jaw);
    const slitMat = new MeshBasicMaterial({ color: 0x120805 });
    for (const s of [-1, 1]) {
      const ball = new Mesh(new SphereGeometry(0.11, 10, 8), this.eyeMat); ball.position.set(s * 0.25, 0.15, 0.5); ball.scale.set(1.35, 0.7, 0.65); ball.rotation.z = s * 0.42;
      const slit = new Mesh(new BoxGeometry(0.035, 0.15, 0.04), slitMat); slit.position.set(s * 0.25, 0.15, 0.56); slit.rotation.z = s * 0.42;
      const glow = glowSprite(0xffc23a, 0.8, 0.6); glow.position.set(s * 0.25, 0.15, 0.58);
      this.head.add(ball, slit, glow); this.eyes.push({ ball, slit, glow, s });
    }
    this.throat.position.set(0, -0.1, 0.4); this.head.add(this.throat);
    this.body.add(this.head);
    for (const [x, z] of [[0.95, 0.95], [-0.95, 0.95], [0.95, -0.95], [-0.95, -0.95]] as const) {
      const leg = new Group(); leg.position.set(x, 0.75, z);
      this.part(mossLegGeometry(), vm, leg, 0.05);
      this.legs.push(leg); this.body.add(leg);
    }
  }
  private readonly cracks: Mesh[] = [];
  private startRoar(seconds: number): void { this.roar = this.roarDur = seconds; this.cue('roar', 0, 2.2, 1.8, 1); }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, p = e.telegraphProgress, atk = e.currentAttack, phase2 = e.phase >= 2;
    if (!this.seen && e.state !== 'idle') { this.seen = true; this.startRoar(2.1); }          // first sight of the hero: a full roar
    if (e.phase !== this.lastPhase) { this.lastPhase = e.phase; this.startRoar(2.3); }          // gets angry: rears up and roars again
    this.roar = Math.max(0, this.roar - dt);
    const rk = this.roar > 0 ? Math.min(1, (this.roarDur - this.roar) / 0.28) * Math.min(1, this.roar / 0.7) : 0;   // snaps up fast, eases off
    if (e.hitCount !== this.lastHits) { this.lastHits = e.hitCount; this.flare = 1; this.pain = 0.4; }               // crystals flash and it snarls on every blow
    this.flare = Math.max(0, this.flare - dt * 4); this.pain = Math.max(0, this.pain - dt);
    const pk = this.pain / 0.4;
    const trot = phase2 ? 4.6 : 3.6;
    // idle: slow breathing, the weight drifting from side to side, a slow look around
    let lift = Math.sin(t * 1.2) * 0.04, pitch = 0, roll = Math.sin(t * 0.7) * 0.02, sx = Math.sin(t * 0.7) * 0.05, sz = 0, scale = 1 + Math.sin(t * 1.3) * 0.014;
    let hp = Math.sin(t * 1.5) * 0.04, hy = Math.sin(t * 0.6) * 0.22, front = 0, side = 0, gait = 0, crystalBoost = 0, shakeAmt = 0, jawT = 0.08 + Math.sin(t * 1.5) * 0.04, tailLash = 0;
    switch (e.state) {
      case 'chase': {
        const s = Math.sin(t * trot); lift = Math.abs(s) * 0.07; roll = s * 0.04; sx = 0; hp = Math.sin(t * trot * 2) * 0.05; hy = 0; gait = 0.5;
        jawT = 0.3 + Math.abs(Math.sin(t * trot * 2)) * 0.14; tailLash = 0.3; break;           // growling as it stomps toward you
      }
      case 'telegraph':
        hy = 0; sx = 0; roll = 0;
        if (atk === 'slam') { front = -1.1 * p; pitch = -0.3 * p; lift = p * 0.55; hp = -0.45 * p; jawT = 0.2 + 0.7 * p; }                       // rears up on its back legs, jaws wide
        else if (atk === 'charge') { hp = 0.5 * p; pitch = 0.1 * p; sz = -0.4 * p; shakeAmt = 0.035 * p; this.legs[0].rotation.x = -0.55 * Math.abs(Math.sin(t * 16)) * p; this.legs[1].rotation.x = 0; lift = -0.05 * p; jawT = 0.15 + Math.abs(Math.sin(t * 15)) * 0.6 * p; tailLash = 1; }  // head down, gnashing, pawing the ground
        else { scale += 0.16 * p; hp = -0.35 * p; side = 0.22 * p; shakeAmt = 0.02 * p; crystalBoost = p; lift = p * 0.15; jawT = 0.3 + 0.7 * p; }  // swells with spores, mouth open
        break;
      case 'strike': {
        const k = Math.min(1, e.t / 0.2); hy = 0; sx = 0; roll = 0;
        if (atk === 'slam') { pitch = k < 0.5 ? -0.3 + 1.05 * k : 0.22 * (1 - (k - 0.5) * 2) * 0.5 + 0.0; front = k < 0.5 ? -1.1 + 2.6 * k : 0.2 * (1 - k); lift = 0.55 * (1 - Math.min(1, k * 2.5)); hp = 0.25; jawT = 0.9 * (1 - k); }   // the jaws snap shut as it crashes down
        else if (atk === 'charge') { pitch = 0.1; gait = 1.4; lift = Math.abs(Math.sin(t * 20)) * 0.08; hp = 0.4; jawT = 0.5; tailLash = 1.4; }
        else { scale += 0.16 * (1 - Math.min(1, k * 3)) - 0.06 * Math.min(1, k * 3); crystalBoost = 1 - k; hp = 0.15; jawT = 1; }
        break;
      }
      case 'recover': { const k = Math.min(1, e.t / (e.def.recoverTime * (phase2 ? 0.8 : 1))); lift = -0.06 * (1 - k); pitch = 0.06 * (1 - k); scale = 1 + Math.sin(t * 7) * 0.02 * (1 - k); hp = 0.25 * (1 - k); hy = 0; jawT = 0.18 + Math.abs(Math.sin(t * 6)) * 0.12; break; }  // tired: panting, head low
    }
    // roar overrides: rear up, head back, jaws wide, the whole body shaking, crystals flaring; a hit makes it snarl
    front += -0.8 * rk; pitch += -0.3 * rk; hp += -0.55 * rk + 0.35 * pk * Math.sin(t * 40); shakeAmt += 0.05 * rk; crystalBoost = Math.max(crystalBoost, rk); lift += 0.25 * rk;
    jawT = Math.max(jawT, rk, pk * 0.7);
    this.legs.forEach((l, i) => {
      const right = i % 2 === 0, frontLeg = i < 2;
      const ph = gait ? Math.sin(t * (gait > 1 ? 20 : trot) + (i === 0 || i === 3 ? 0 : Math.PI)) : 0;
      const swing = ph * 0.5 * gait;
      if (!(e.state === 'telegraph' && atk === 'charge' && i < 2)) l.rotation.x = swing + (frontLeg ? front : 0);
      l.rotation.z = (right ? 1 : -1) * side;
      // a foot comes down: dust and a thump (the scene shakes the camera by how close the hero is)
      const sg = ph < 0 ? -1 : 1;
      if (gait && this.stepSign[i] > 0 && sg < 0) { const lx = l.position.x * (e.state === 'strike' ? 1.1 : 1), lz = l.position.z; this.cue('stomp', lx, lz, 0, phase2 ? 1.3 : 1); }
      this.stepSign[i] = sg;
    });
    this.body.position.set(sx + Math.sin(t * 55) * shakeAmt, lift, sz);
    this.body.rotation.set(pitch, 0, roll); this.body.scale.setScalar(scale);
    this.head.rotation.set(hp - this.recoil.value * 0.5, hy, 0);
    // the jaw snaps toward its target quickly (so a bite looks like a bite)
    this.jawOpen += (jawT - this.jawOpen) * Math.min(1, dt * 20); this.jaw.rotation.x = this.jawOpen * 0.8;
    this.throat.material.opacity = Math.max(0, this.jawOpen - 0.35) * (atk === 'sporeRing' && (e.state === 'telegraph' || e.state === 'strike') ? 1.1 : 0.8);
    this.throat.material.color.setHex(atk === 'sporeRing' && (e.state === 'telegraph' || e.state === 'strike') ? 0x9bf060 : phase2 ? 0xff5a20 : 0xff8a30);
    // the thorns bristle when it is angry; the club tail lashes
    const bTarget = (phase2 ? 1.12 : 1) + 0.2 * rk + 0.12 * p + 0.12 * this.flare;
    this.bristle += (bTarget - this.bristle) * Math.min(1, dt * 10); this.spikes.scale.setScalar(this.bristle);
    this.tailYaw = Math.sin(t * (1.2 + tailLash * 4)) * (0.22 + tailLash * 0.3);
    this.tail.rotation.set(-0.12 - 0.25 * rk, this.tailYaw, 0);
    // eyes: amber, red in phase 2, white-hot on a roar, a blow or a wind-up; narrowed when hurt
    const hot = Math.max(rk, this.flare * 0.6, e.state === 'telegraph' ? p * 0.7 : 0);
    this.eyeMat.color.copy(phase2 ? EYE_HOT : EYE_COOL).lerp(EYE_WHITE, hot);
    for (const ey of this.eyes) { ey.ball.scale.y = 0.7 * (1 - 0.55 * pk); ey.slit.scale.y = 1 - 0.5 * pk; ey.glow.material.opacity = 0.45 + 0.4 * hot + Math.sin(t * 3 + ey.s) * 0.06; ey.glow.scale.setScalar(0.75 + 0.5 * hot); ey.glow.material.color.copy(this.eyeMat.color); }
    const boost = Math.max(crystalBoost, this.flare * 0.8);
    this.crystalMat.emissiveIntensity = (phase2 ? 1.3 : 0.7) + Math.sin(t * 3) * 0.2 + boost * 1.3;
    this.crystalMat.emissive.setHex(phase2 ? 0xe8742a : 0x22b8a6); this.crystalMat.color.setHex(phase2 ? 0xd8602a : 0x66e0cf);
    this.crystals.forEach((c, i) => { c.m.position.y = c.y + Math.sin(t * 1.6 + i) * 0.04 + boost * 0.12; c.m.rotation.y = Math.sin(t * 0.5 + i) * 0.25; c.m.scale.set(1 + boost * 0.25, 1.9 + boost * 0.4, 1 + boost * 0.25); });
    // the cracks glow like embers, pulsing with its breath and flaring when it attacks
    const ci = (phase2 ? 0.85 : 0.45) + Math.sin(t * 2.2) * 0.18 + boost * 0.6 + rk * 0.4;
    this.crackMat.color.setRGB(Math.min(1, ci), Math.min(1, ci * (phase2 ? 0.55 : 0.5)), Math.min(1, ci * 0.12));
    // cues for the scene: charge dust, snorts, embers
    if (e.state === 'strike' && atk === 'charge') { this.dustT -= dt; if (this.dustT <= 0) { this.dustT = 0.05; this.cue('dust', -0.95, -0.4, 0.1, 1.2); this.cue('dust', 0.95, -0.4, 0.1, 1.2); } }
    this.snortT -= dt; if (this.snortT <= 0 && (e.state === 'chase' || e.state === 'recover' || e.state === 'telegraph')) { this.snortT = 1.4 + Math.random() * 1.6; this.cue('snort', 0, 2.9, 1.2, 1); }
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = phase2 ? 0.1 : 0.45;
      const x = (Math.random() - 0.5) * 2.2, z = (Math.random() - 0.5) * 2.8, sf = mossSurface(x, z);
      this.cue('ember', x, z, MOSS_SHELL_Y + sf.p.y, 1, phase2 ? 0xff8a30 : 0x66e0cf);
    }
  }
  protected defeat(t: number, _dt: number, k: number): void {
    // 0-0.2 shudders, strobing white; 0.2-0.65 slumps, legs splaying, head drooping, jaws hanging open, crystals floating off; 0.65-1 sinks away
    const shud = k < 0.2 ? 1 - k / 0.2 : 0, u = easeInOut(Math.min(1, Math.max(0, (k - 0.2) / 0.45))), sink = easeInOut(Math.max(0, (k - 0.65) / 0.35));
    this.body.position.set(Math.sin(t * 55) * 0.08 * shud, -0.6 * u - 0.9 * sink, 0);
    this.body.rotation.set(0.12 * u, 0, Math.sin(t * 40) * 0.03 * shud); this.body.scale.setScalar(1);
    this.head.rotation.set(0.6 * u, 0, 0); this.jaw.rotation.x = (0.35 + 0.5 * Math.sin(t * 30) * shud + 0.4 * u);
    this.spikes.scale.setScalar(Math.max(0.4, 1 - 0.6 * u)); this.tail.rotation.set(-0.12 + 0.5 * u, 0, 0);
    this.legs.forEach((l, i) => { l.rotation.x = (i < 2 ? -0.2 : 0.25) * u; l.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.5 * u; });
    this.eyeMat.color.setHex(shud > 0.4 && Math.sin(t * 60) > 0 ? 0xffffff : u > 0.5 ? 0x4a5a5a : 0xffc23a);
    for (const ey of this.eyes) ey.glow.material.opacity = Math.max(0, 0.6 * (1 - u * 1.5));
    this.throat.material.opacity = 0;
    const ci = shud > 0 ? 1 : Math.max(0, 0.9 * (1 - u * 1.3)); this.crackMat.color.setRGB(ci, ci * 0.5, ci * 0.12);
    this.crystalMat.emissiveIntensity = shud > 0 ? 1.4 + Math.sin(t * 70) * 0.8 : Math.max(0.1, 1.2 * (1 - u));
    this.crystals.forEach((c, i) => { c.m.position.y = c.y + u * (1.2 + i * 0.25); c.m.rotation.y = t * (1 + i * 0.4) * u; const s = Math.max(0.001, 1 - u * 0.9); c.m.scale.set(s, 1.9 * s, s); });
    this.root.scale.set(1 + 0.06 * sink, Math.max(0.001, 1 - sink), 1 + 0.06 * sink);
  }
}

// ---------------------------------------------------------------------------------------------------------------- v2.28 Crystal Hollow

const SHARD_HUES = [{ c: 0x7fe3ff, e: 0x1f8fb8 }, { c: 0xff9fd8, e: 0xb8408a }, { c: 0xc59bff, e: 0x6a48b8 }] as const;

/**
 * The Shardling: a grumpy little rock critter with a crest of crystal shards (cyan, pink or violet, by creature). Idle: it breathes, glances
 * about and its crest twinkles. It skitters at you with a quick low hop, the crest streaming back. Wind-up: it tucks its head and curls into a
 * ball, shivering, the crest bristling and glowing hotter. Strike: it rolls along the warned line, shedding dust. Hit: shoved back, eyes
 * squeezed shut, crest flaring. Defeat: it flattens, spins up and the crest shatters off in a swirl of sparkles (no gore).
 */
export class ShardlingView extends EnemyView {
  protected readonly mass = 1;
  private readonly crest = new Group();
  private readonly crestMat: MeshLambertMaterial;
  private readonly lids: Mesh[] = [];
  private readonly brows: Mesh[] = [];
  private readonly mouth: Mesh;
  private readonly hue: { c: number; e: number };
  private readonly sc: number; private readonly ph: number;
  private prev: EnemyState = 'idle'; private notice = 0; private blink = -1; private nextBlink: number; private anger = 0;
  private lastHits = 0; private pain = 0; private flare = 0; private dustT = 0; private shattered = false; private glintT = 1;
  constructor(enemy: Enemy, outlines = true) {
    super(enemy);
    this.outlineOn = outlines;
    const id = enemy.tag ?? enemy.id;
    this.hue = SHARD_HUES[Math.abs(id) % SHARD_HUES.length]; this.sc = 0.94 + ((Math.abs(id) * 37) % 11) / 11 * 0.14; this.ph = id * 1.9; this.nextBlink = 1 + (Math.abs(id) % 5) * 0.6;
    this.root.add(blobShadow(0.55 * this.sc));
    this.part(shardlingBodyGeometry(), this.vmat(), this.body, 0.03);
    // the crest has its own glowing material (not in `mats`, so the hurt flash does not wash it out)
    this.crestMat = new MeshLambertMaterial({ vertexColors: true, color: this.hue.c, emissive: this.hue.e, emissiveIntensity: 0.6, flatShading: true });
    this.crest.position.y = 0.78; this.part(shardlingCrestGeometry(), this.crestMat, this.crest, 0.02); this.body.add(this.crest);
    const lidMat = this.mat(0x7e86d0);
    for (const s of [-1, 1]) { const lid = new Mesh(new SphereGeometry(0.125, 10, 8), lidMat); lid.position.set(s * 0.17, 0.53, 0.372); lid.scale.set(1, 0.01, 0.8); lid.visible = false; this.body.add(lid); this.lids.push(lid); }
    const browMat = this.mat(0x2a2c5c), browGeo = new BoxGeometry(0.2, 0.06, 0.05);
    for (const s of [-1, 1]) { const b = new Mesh(browGeo, browMat); b.position.set(s * 0.17, 0.68, 0.4); this.body.add(b); this.brows.push(b); }
    this.mouth = new Mesh(new SphereGeometry(0.08, 10, 8), new MeshBasicMaterial({ color: 0x20102a })); this.mouth.position.set(0, 0.27, 0.43); this.mouth.scale.set(1.2, 0.05, 0.4); this.body.add(this.mouth);
    this.body.scale.setScalar(this.sc);
  }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, st = e.state, p = e.telegraphProgress, ph = this.ph, s = this.sc;
    if (this.prev === 'idle' && st === 'chase') { this.notice = 0.5; this.cue('alert', 0, 0, 1.3); }     // spotted the hero: a hop of surprise
    if (this.prev === 'strike' && st === 'recover') this.cue('slam', 0, 0.8, 0.05, 0.5);                  // the roll ends: a puff of dust
    this.prev = st; this.notice = Math.max(0, this.notice - dt);
    if (e.hitCount !== this.lastHits) { this.lastHits = e.hitCount; this.pain = 0.3; this.flare = 1; this.cue('crystal', 0, 0, 0.9, 0.6, this.hue.c); }
    this.pain = Math.max(0, this.pain - dt); this.flare = Math.max(0, this.flare - dt * 4);
    const pk = this.pain / 0.3;
    let y = 0, squash = 1, pitch = 0, yaw = 0, crestS = 1, crestLean = 0, glow = 0.55, wob = 0, angry = 0, mouth = 0.05, roll = 0;
    switch (st) {
      case 'idle':
        squash = 1 + Math.sin(t * 2.4 + ph) * 0.04; yaw = Math.sin(t * 0.9 + ph) * 0.5 * (0.6 + 0.4 * Math.sin(t * 0.37 + ph)); glow = 0.5 + 0.25 * Math.sin(t * 1.6 + ph); crestS = 1 + 0.05 * Math.sin(t * 2.2 + ph);
        this.glintT -= dt; if (this.glintT <= 0) { this.glintT = 2.4 + Math.random() * 2.2; this.cue('crystal', 0, -0.1, 1.0, 0.2, this.hue.c); }   // a twinkle off the crest now and then
        break;
      case 'chase': {
        if (this.notice > 0) { const n = 1 - this.notice / 0.5; y = bump(n) * 0.35; squash = 1 + bump(n) * 0.16; crestS = 1 + bump(n) * 0.4; mouth = 0.7; angry = 0.5; glow = 1; break; }
        const hop = Math.abs(Math.sin(t * 9 + ph)); y = hop * 0.1; squash = 1 + Math.cos(t * 9 + ph) * 0.05; pitch = 0.16; crestLean = -0.35; crestS = 1.05; glow = 0.8; angry = 0.6; wob = Math.sin(t * 18 + ph) * 0.025; mouth = 0.2;
        break;
      }
      case 'telegraph': pitch = 0.95 * p; squash = 1 - 0.3 * p; crestS = 1 + 0.55 * p; glow = 0.7 + 1.0 * p; wob = Math.sin(t * 58) * 0.03 * p; angry = 1; mouth = 0.1 + 0.5 * p;
        this.dustT -= dt; if (this.dustT <= 0) { this.dustT = 0.14; this.cue('steam', 0, 0, 0.8, 1, this.hue.c); }       // curls up, shivers and fizzes before the roll
        break;
      case 'strike': roll = e.t * Math.PI * 2 * 2.6; y = 0.1; squash = 0.9; crestS = 1.3; glow = 1.8; angry = 1; mouth = 0.9;
        this.dustT -= dt; if (this.dustT <= 0) { this.dustT = 0.06; this.cue('dust', 0, -0.2, 0.05, 0.5); }
        break;
      case 'recover': { const k = Math.min(1, e.t / e.def.recoverTime); wob = Math.sin(t * 9) * 0.04 * (1 - k); yaw = Math.sin(t * 5) * 0.4 * (1 - k); squash = 0.88 + k * 0.12 + Math.sin(t * 11) * 0.02 * (1 - k); crestS = 0.8 + 0.2 * k; glow = 0.3 + 0.3 * k; mouth = 0.4 + Math.sin(t * 12) * 0.15; break; }   // dizzy and panting
    }
    squash *= 1 - 0.12 * pk; yaw += Math.sin(t * 50) * 0.12 * pk;
    const c = 0.42 * s;    // the roll turns about the middle of the body, not its feet
    this.body.position.set(wob, y * s + (st === 'strike' ? c * (1 - Math.cos(roll)) : 0), st === 'strike' ? -c * Math.sin(roll) : 0);
    this.body.rotation.set(pitch + (st === 'strike' ? roll : 0), yaw, 0);
    this.body.scale.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
    this.crest.position.y = 0.78; this.crest.rotation.set(crestLean + Math.sin(t * 7 + ph) * 0.04, 0, 0); this.crest.scale.setScalar(crestS);
    this.crestMat.emissiveIntensity = glow + this.flare * 1.2;
    // face: brows slant as it gets angry, the mouth opens, the eyes squeeze shut when hit or dizzy, and blink now and then
    this.anger += (angry - this.anger) * Math.min(1, dt * 14);
    this.brows.forEach((b, i) => { const sd = i === 0 ? -1 : 1; b.rotation.z = sd * (this.anger * 0.6 - 0.1); b.position.y = 0.685 - 0.03 * this.anger; });
    this.mouth.scale.y = Math.max(0.05, mouth);
    this.nextBlink -= dt; if (this.nextBlink <= 0 && this.blink < 0) { this.blink = 0; this.nextBlink = 1.8 + ((Math.abs(e.tag ?? e.id) * 7) % 5) * 0.5; }
    if (this.blink >= 0) { this.blink += dt; if (this.blink > 0.16) this.blink = -1; }
    const closed = Math.max(this.blink < 0 ? 0 : Math.sin((this.blink / 0.16) * Math.PI), pk * 0.75, st === 'recover' ? 0.5 : 0);
    for (const l of this.lids) { l.scale.y = Math.max(0.01, closed); l.visible = closed > 0.05; }
    const hot = st === 'telegraph' ? p : st === 'strike' ? 1 : 0;   // the stone flushes pink as it winds up
    this.mats[0].color.setRGB(1 + 0.15 * hot, 1 - 0.35 * hot, 1 - 0.12 * hot);
  }
  protected defeat(t: number, _dt: number, k: number): void {
    if (!this.shattered) { this.shattered = true; this.cue('shatter', 0, 0, 0.7, 1, this.hue.c); }
    // flattened by the blow, then it spins up while the crest breaks loose, rises, spins and fades
    const sq = easeOutCubic(k / 0.25), u = k < 0.25 ? 0 : (k - 0.25) / 0.75, s = this.sc, sw = 1 + 0.4 * sq * (1 - u);
    this.body.position.set(0, easeInOut(u) * 0.3 * s, 0); this.body.rotation.set(0, u * 6, 0); this.body.scale.set(s * sw, s * (1 - 0.5 * sq * (1 - u)), s * sw);
    this.crest.position.y = 0.78 + u * 1.5; this.crest.rotation.set(0, u * 11, 0); this.crest.scale.setScalar(Math.max(0.001, 1 - u * 0.85)); this.crestMat.emissiveIntensity = 2.2 * (1 - u * 0.5) + Math.sin(t * 60) * 0.3 * (1 - u);
    this.lids.forEach(l => { l.scale.y = 1; l.visible = true; }); this.mouth.scale.y = 0.8; this.brows.forEach((b, i) => { b.rotation.z = (i === 0 ? -1 : 1) * -0.3; });   // an "ow" face
    this.root.scale.setScalar(Math.max(0.001, 1 - easeInOut(u)));
  }
}

const WARDEN_EYE_ASLEEP = new Color(0x2a2850), WARDEN_EYE = new Color(0xffc23a), WARDEN_EYE_HOT = new Color(0xff5a3a);
const HEART_PINK = new Color(0xff9fd8), HEART_GOLD = new Color(0xffd070), HEART_HOT = new Color(0xffb050);
const damp = (from: number, to: number, dt: number, rate = 14): number => from + (to - from) * Math.min(1, dt * rate);

/**
 * The Hollow Warden: a chibi crystal guardian (big round head, squat body, floating stone fists, a crown of crystals) that swallowed the
 * Heartstone's light. Asleep until it senses the hero, then it wakes with a roar. Every attack has its own readable wind-up: for the
 * crystal rain it raises both fists high while shards climb over its head; for the prism beam it pulls its fists in and its heart swells and
 * whitens; for the ring it crouches and presses its fists to the floor. Between attacks it slumps and its dim heart is EXPOSED (a gold glow
 * and a pulsing ring): that is the moment to strike. At half health it turns hot and roars again. When beaten it shudders, slumps, its
 * heart floats free as a column of light and the guardian crumbles into the floor.
 */
export class WardenView extends EnemyView {
  protected readonly mass = 5;
  private readonly head = new Group();
  private readonly fists: Group[] = [];
  private readonly heart = new Group();
  private readonly heartGem: Mesh<ReturnType<typeof wardenHeartGeometry>, MeshLambertMaterial>;
  private readonly heartGlow = glowSprite(0xff9fd8, 2, 0.4);
  private readonly heartRing = new Mesh(new TorusGeometry(0.62, 0.035, 6, 36), new MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  private readonly crownGlow = glowSprite(0xff9fd8, 3, 0.3);
  private readonly orbit = new Group();
  private readonly orbitBits: Mesh[] = [];
  private readonly beam: Mesh; private readonly beamCore: Mesh;
  private readonly eyeMat = new MeshBasicMaterial({ color: 0x2a2850 });
  private readonly eyeGlow: ReturnType<typeof glowSprite>[] = [];
  private woke = false; private awake = 0; private roar = 0; private roarDur = 2; private lastPhase = 1; private lastHits = 0; private flare = 0; private pain = 0;
  private stepSign = 1; private slamCued = false; private heartK = 0.3; private beamK = 0; private emberT = 0.5;
  constructor(enemy: Enemy) {
    super(enemy);
    this.root.add(blobShadow(2.0));
    const vm = this.vmat();
    this.part(wardenBodyGeometry(), vm, this.body, 0.06);
    this.head.position.set(0, WARDEN_NECK_Y, 0.12); this.part(wardenHeadGeometry(), vm, this.head, 0.05); this.body.add(this.head);
    const slitMat = new MeshBasicMaterial({ color: 0x0c0a1c });
    for (const s of [-1, 1]) {   // glowing eyes: an angled amber bar over a dark slit, with a soft halo
      const ball = new Mesh(new SphereGeometry(0.13, 10, 8), this.eyeMat); ball.position.set(s * 0.32, 0.68, 0.82); ball.scale.set(1.5, 0.62, 0.5); ball.rotation.z = s * 0.38;
      const slit = new Mesh(new BoxGeometry(0.04, 0.17, 0.04), slitMat); slit.position.set(s * 0.32, 0.68, 0.87); slit.rotation.z = s * 0.38;
      const glow = glowSprite(0xffc23a, 0.8, 0); glow.position.set(s * 0.32, 0.68, 0.88); this.head.add(ball, slit, glow); this.eyeGlow.push(glow);
    }
    this.crownGlow.position.set(0, 1.35, -0.1); this.head.add(this.crownGlow);
    for (const s of [-1, 1] as const) { const f = new Group(); f.position.set(s * 1.35, 1.05, 0.5); this.part(wardenFistGeometry(s), vm, f, 0.04); this.body.add(f); this.fists.push(f); }
    // the heart floats in the chest window
    this.heartGem = new Mesh(wardenHeartGeometry(), new MeshLambertMaterial({ color: 0xff9fd8, emissive: 0xff7ac0, emissiveIntensity: 0.4, flatShading: true })) as WardenView['heartGem'];
    this.heartGem.scale.set(1, 1.4, 0.8); this.heart.position.set(0, 1.15, 0.78); this.heartRing.visible = false;
    this.heart.add(this.heartGem, this.heartGlow, this.heartRing); this.body.add(this.heart);
    // shards that circle above it
    const bitMat = new MeshLambertMaterial({ color: 0xc59bff, emissive: 0x7a50d8, emissiveIntensity: 0.9, flatShading: true });
    for (let i = 0; i < 4; i++) { const b = new Mesh(new OctahedronGeometry(0.2, 0), bitMat); b.scale.y = 1.6; this.orbit.add(b); this.orbitBits.push(b); }
    this.orbit.position.y = 1.6; this.body.add(this.orbit);
    // the prism beam: an additive column along +Z from the chest, only drawn while it fires
    const beamMat = (c: number): MeshBasicMaterial => new MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.beam = new Mesh(new CylinderGeometry(0.85, 0.85, 13, 14, 1, true), beamMat(0xff9fe8)); this.beamCore = new Mesh(new CylinderGeometry(0.35, 0.35, 13, 10, 1, true), beamMat(0xffffff));
    for (const b of [this.beam, this.beamCore]) { b.rotation.x = Math.PI / 2; b.position.set(0, 1.15, 6.9); b.renderOrder = 4; b.visible = false; this.body.add(b); }
  }
  private startRoar(seconds: number): void { this.roar = this.roarDur = seconds; this.cue('roar', 0, 2.2, 2.2, 1, 0xc59bff); }
  protected animate(t: number, dt: number): void {
    const e = this.enemy, p = e.telegraphProgress, atk = e.currentAttack, ph2 = e.phase >= 2, st = e.state;
    if (!this.woke && st !== 'idle') { this.woke = true; this.startRoar(1.9); }
    if (e.phase !== this.lastPhase) { this.lastPhase = e.phase; this.startRoar(2.1); }
    this.awake = damp(this.awake, this.woke ? 1 : 0, dt, 3); const sl = 1 - this.awake;
    this.roar = Math.max(0, this.roar - dt);
    const rk = this.roar > 0 ? Math.min(1, (this.roarDur - this.roar) / 0.25) * Math.min(1, this.roar / 0.6) : 0;
    if (e.hitCount !== this.lastHits) { this.lastHits = e.hitCount; this.flare = 1; this.pain = 0.35; this.cue('crystal', 0, 0.5, 1.5, 1, e.exposed ? 0xffe9a0 : 0xc59bff); }
    this.flare = Math.max(0, this.flare - dt * 4); this.pain = Math.max(0, this.pain - dt); const pk = this.pain / 0.35;
    // defaults = a calm, slightly swaying idle (or a droopy sleep before it wakes)
    let lift = Math.sin(t * 1.3) * 0.04, pitch = 0, roll = Math.sin(t * 0.8) * 0.015, sy = 1, shake = 0, headP = Math.sin(t * 1.1) * 0.03 + 0.5 * sl, headY = Math.sin(t * 0.5) * 0.2 * this.awake;
    let lx = -1.35, rx = 1.35, fy = 1.05 + Math.sin(t * 1.5) * 0.06 - 0.5 * sl, fz = 0.5, raise = 0;
    let orbitR = 2.0 - 1.1 * sl, orbitY = 1.6, orbitSpeed = 0.8, heartT = 0.3 + 0.15 * Math.sin(t * 1.6) - 0.1 * sl, eyeHot = 0, beamT = 0, ringOn = false;
    switch (st) {
      case 'chase': {
        const s = Math.sin(t * 3); lift = Math.abs(s) * 0.1; roll = s * 0.03; fy = 0.9; fz = 0.5 + s * 0.35; orbitSpeed = 1.4; heartT = 0.5; headP = 0.05;
        const sg = s < 0 ? -1 : 1; if (sg !== this.stepSign) { this.stepSign = sg; this.cue('stomp', sg * 0.5, 0.1, 0, ph2 ? 1.3 : 1, 0x9aa0c8); }   // a heavy footfall at the bottom of every bob
        break;
      }
      case 'telegraph':
        if (atk === 'shardRain') { fy = 1.05 + 1.85 * p; lx = -(1.35 - 0.45 * p); rx = 1.35 - 0.45 * p; fz = 0.2; raise = p; pitch = -0.22 * p; headP = -0.25 * p; orbitY = 1.6 + 1.5 * p; orbitR = 1.4 - 0.5 * p; orbitSpeed = 1 + 5 * p; heartT = 0.5 + 0.5 * p; eyeHot = p; }   // fists high, shards climbing
        else if (atk === 'prismBeam') { lx = -(1.35 - 0.85 * p); rx = 1.35 - 0.85 * p; fy = 1.15; fz = 0.5 + 0.5 * p; pitch = -0.12 * p; headP = -0.18 * p; orbitR = 2 - 1.1 * p; orbitSpeed = 1 + 3 * p; heartT = 0.6 + 1.2 * p; shake = 0.03 * p; eyeHot = p; }   // fists in, heart swelling and whitening
        else { lift = -0.28 * p; sy = 1 - 0.12 * p; fy = 1.05 - 0.7 * p; lx = -(1.35 + 0.35 * p); rx = 1.35 + 0.35 * p; pitch = 0.12 * p; orbitR = 2 - 1.3 * p; orbitSpeed = 1 + 4 * p; heartT = 0.5 + 0.7 * p; shake = 0.025 * p; eyeHot = p; }   // crouched, fists to the floor
        break;
      case 'strike': {
        const k = Math.min(1, e.t / e.def.strikeTime);
        if (atk === 'shardRain') { const u = Math.min(1, e.t / 0.16); fy = 2.9 - 2.5 * u * u; lx = -0.9; rx = 0.9; fz = 0.2; pitch = 0.22 * (1 - k); headP = 0.25 * u; heartT = 1; orbitY = 1.6 + 1.5 * (1 - u); if (u >= 1 && !this.slamCued) { this.slamCued = true; this.cue('slam', 0, 1.0, 0.1, 1.4, 0x9aa0c8); } }
        else if (atk === 'prismBeam') { lx = -0.5; rx = 0.5; fy = 1.15; fz = 1.0; pitch = 0.1 * (1 - k); heartT = 2; orbitR = 0.9; orbitSpeed = 6; beamT = (1 - k * k); shake = 0.02; eyeHot = 1; }
        else { lift = -0.15 * (1 - k); fy = 0.25; lx = -1.7; rx = 1.7; heartT = 1.6; orbitR = 0.7 + 8 * k; orbitSpeed = 3; eyeHot = 1; }
        break;
      }
      case 'recover': {   // slumped and tired: the dim heart shows and the ring pulses. THIS is when to hit it
        const k = Math.min(1, e.t / (e.def.recoverTime * (ph2 ? 0.8 : 1)));
        lift = -0.25 * (1 - k * 0.5); headP = 0.5 * (1 - 0.3 * k); fy = 0.4; lx = -1.55; rx = 1.55; pitch = 0.12; orbitY = 0.5; orbitR = 2.4; orbitSpeed = 0.4; heartT = 1.4 + 0.2 * Math.sin(t * 8); eyeHot = -0.4; ringOn = true;
        break;
      }
    }
    if (st !== 'strike') this.slamCued = false;
    // roar: rear back, head up, fists high, the whole body shaking; a blow makes it jerk
    headP += -0.5 * rk + 0.3 * pk * Math.sin(t * 40); pitch += -0.25 * rk; fy += 0.8 * rk; lift += 0.2 * rk; shake += 0.04 * rk; heartT = Math.max(heartT, rk * 1.3); eyeHot = Math.max(eyeHot, rk);
    // body and head
    this.body.position.set(Math.sin(t * 55) * shake, lift, 0); this.body.rotation.set(pitch, 0, roll); this.body.scale.set(1, sy, 1);
    this.head.rotation.set(headP - this.recoil.value * 0.4, headY, 0);
    // fists glide toward their pose (so every transition flows), and tilt back when raised
    const fl = this.fists[0], fr = this.fists[1];
    for (const [f, tx] of [[fl, lx], [fr, rx]] as const) { f.position.x = damp(f.position.x, tx, dt); f.position.y = damp(f.position.y, fy, dt); f.position.z = damp(f.position.z, fz, dt); f.rotation.x = damp(f.rotation.x, -0.6 * raise, dt); }
    // the orbiting shards
    this.orbit.position.y = damp(this.orbit.position.y, orbitY, dt, 6);
    this.orbitBits.forEach((b, i) => { const a = t * orbitSpeed + (i / this.orbitBits.length) * Math.PI * 2; b.position.set(Math.cos(a) * orbitR, Math.sin(t * 2 + i) * 0.15, Math.sin(a) * orbitR); b.rotation.y = t * 2 + i; });
    // heart: pink and dim; hot gold and pulsing while exposed; swelling before the beam; flaring on a blow
    this.heartK = damp(this.heartK, heartT, dt, 8);
    const boost = Math.max(this.heartK, this.flare * 1.1), exposed = e.exposed;
    const tone = exposed ? HEART_GOLD : ph2 ? HEART_HOT : HEART_PINK;
    this.heartGem.material.color.copy(tone); this.heartGem.material.emissive.copy(tone).multiplyScalar(0.8);
    this.heartGem.material.emissiveIntensity = 0.3 + boost * 1.1; this.heartGem.scale.set(1 + boost * 0.12, 1.4 + boost * 0.15, 0.8); this.heart.scale.setScalar(1 + (atk === 'prismBeam' && st === 'telegraph' ? 0.5 * p : 0) + (exposed ? 0.2 : 0));
    this.heartGem.rotation.y = t * (0.9 + boost);
    const gm = this.heartGlow.material as { opacity: number; color: Color }; gm.opacity = Math.min(1, 0.2 + boost * 0.4); gm.color.copy(tone); this.heartGlow.scale.setScalar(1.6 + boost * 1.2);
    this.heartRing.visible = ringOn; if (ringOn) { const pulse = 0.5 + 0.5 * Math.sin(t * 9); (this.heartRing.material as MeshBasicMaterial).opacity = 0.35 + 0.5 * pulse; this.heartRing.scale.setScalar(1 + 0.25 * pulse); this.heartRing.rotation.set(0, 0, 0); }
    // eyes
    this.eyeMat.color.copy(WARDEN_EYE_ASLEEP).lerp(ph2 ? WARDEN_EYE_HOT : WARDEN_EYE, this.awake).lerp(WARDEN_EYE_HOT, Math.max(0, eyeHot) * 0.6).lerp(WARDEN_EYE_ASLEEP, Math.max(0, -eyeHot) * 0.7);
    for (const g of this.eyeGlow) { (g.material as { opacity: number }).opacity = this.awake * (0.4 + 0.3 * Math.max(0, eyeHot)); g.scale.setScalar(0.7 + 0.4 * Math.max(0, eyeHot)); }
    (this.crownGlow.material as { opacity: number }).opacity = 0.2 + 0.15 * boost + (ph2 ? 0.15 : 0);
    // the beam
    this.beamK = damp(this.beamK, beamT, dt, 30); const showBeam = this.beamK > 0.02;
    this.beam.visible = this.beamCore.visible = showBeam;
    if (showBeam) { (this.beam.material as MeshBasicMaterial).opacity = 0.55 * this.beamK; (this.beamCore.material as MeshBasicMaterial).opacity = 0.9 * this.beamK; const w = 0.8 + 0.2 * Math.sin(t * 60); this.beam.scale.set(w, 1, w); }
    // drifting motes of light off the crystals
    this.emberT -= dt; if (this.emberT <= 0) { this.emberT = ph2 ? 0.12 : 0.4; this.cue('ember', (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 1.2, 1, ph2 ? 0xffb050 : 0xc59bff); }
  }
  protected defeat(t: number, _dt: number, k: number): void {
    // 0-0.2 shudders, strobing; 0.2-0.65 slumps (fists drop, head droops, shards fall); the heart tears free and rises as a column of light; 0.65-1 it sinks into the floor
    const shud = k < 0.2 ? 1 - k / 0.2 : 0, u = easeInOut(clamp01((k - 0.2) / 0.45)), sink = easeInOut(clamp01((k - 0.65) / 0.35)), rel = easeInOut(clamp01((k - 0.45) / 0.3));
    this.body.position.set(Math.sin(t * 55) * 0.08 * shud, -0.5 * u - 1.0 * sink, 0); this.body.rotation.set(0.1 * u, 0, Math.sin(t * 40) * 0.03 * shud); this.body.scale.set(1, 1, 1);
    this.head.rotation.set(0.55 * u, 0, 0);
    this.fists[0].position.set(-(1.35 + 0.3 * u), 1.05 - 0.75 * u, 0.5); this.fists[1].position.set(1.35 + 0.3 * u, 1.05 - 0.75 * u, 0.5);
    this.orbit.position.y = 1.6 - 1.3 * u; this.orbitBits.forEach((b, i) => { const a = t * 0.5 + i * 1.57; b.position.set(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4); b.scale.setScalar(Math.max(0.001, 1 - 0.8 * u)); });
    this.eyeMat.color.setHex(shud > 0.4 && Math.sin(t * 60) > 0 ? 0xffffff : u > 0.5 ? 0x2a2850 : 0xffc23a);
    for (const g of this.eyeGlow) (g.material as { opacity: number }).opacity = Math.max(0, 0.6 * (1 - u * 1.5));
    (this.crownGlow.material as { opacity: number }).opacity = Math.max(0, 0.4 * (1 - u));
    // the heart flickers, then breaks away and floats up, growing and fading: the Heartstone's light, set free
    this.heart.position.set(0, 1.15 + rel * 2.8 + 0.5 * u + 1.0 * sink, 0.78 * (1 - rel)); this.heart.scale.setScalar((1 + rel * 1.2) * Math.max(0.001, 1 - sink));
    this.heartGem.material.emissiveIntensity = shud > 0 ? 1.4 + Math.sin(t * 70) * 0.8 : 1.6; this.heartGem.material.color.copy(HEART_GOLD); this.heartGem.rotation.y = t * 3;
    (this.heartGlow.material as { opacity: number }).opacity = Math.max(0, 0.9 * (1 - sink)); this.heartGlow.scale.setScalar(2 + rel * 3); this.heartRing.visible = false;
    this.beam.visible = this.beamCore.visible = false;
    this.root.scale.set(1 + 0.06 * sink, Math.max(0.001, 1 - sink), 1 + 0.06 * sink);
  }
}

/**
 * Glim, a lantern sprite who floats in the Lantern Cavern: a pale round spirit with a crystal horn, leaf ears and a little lantern in one hand.
 * He bobs, blinks, glances at the hero, waves hello, bounces while he talks and spins with joy when his request is done (his lantern then
 * glows brightly). A yellow "!" floats over him while he has something to say.
 */
export class GlimModel {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly marker = new Group();
  private readonly lanternGlow = glowSprite(0xffe9a0, 1.3, 0.3);
  private readonly lanternGem: Mesh;
  private readonly halo = glowSprite(0x9fe8ff, 2.6, 0.3);
  private readonly lids: Mesh[] = [];
  private talk = 0; private talking = false; private wave_ = 0; private cheer_ = 0; private cheerCued = false; private lit = 0; private litTarget = 0;
  private last = -1; private nextBlink = 1.5; private blinkT = -1;
  constructor() {
    this.root.add(blobShadow(0.42));
    const vc = withPaint(new MeshLambertMaterial({ vertexColors: true, emissive: 0x2a5a70, emissiveIntensity: 0.55 }));
    const m = new Mesh(glimBodyGeometry(), vc); addWorldOutline(m, 0.025); this.body.add(m);
    this.body.position.y = 1.0; this.halo.position.set(0, 0, -0.1); this.body.add(this.halo);
    const lidMat = new MeshLambertMaterial({ color: 0xcdeefa });
    for (const s of [-1, 1]) { const lid = new Mesh(new SphereGeometry(0.098, 10, 8), lidMat); lid.position.set(s * 0.12, 0.06, 0.266); lid.scale.set(1, 0.01, 0.7); lid.visible = false; this.body.add(lid); this.lids.push(lid); }
    // the lantern in his right hand: a thin handle and a glowing gem
    this.lanternGem = mesh(new OctahedronGeometry(0.1, 0), new MeshBasicMaterial({ color: 0xfff2a0 }), 0.46, -0.12, 0.24); this.lanternGem.scale.y = 1.35;
    this.lanternGlow.position.copy(this.lanternGem.position);
    this.body.add(mesh(new CylinderGeometry(0.008, 0.008, 0.2, 5), new MeshBasicMaterial({ color: 0x6b4a2a }), 0.46, 0.02, 0.24), this.lanternGem, this.lanternGlow);
    this.root.add(this.body);
    this.marker.position.y = 2.15;
    const yellow = new MeshBasicMaterial({ color: 0xffe066 });
    this.marker.add(mesh(new BoxGeometry(0.1, 0.26, 0.1), yellow, 0, 0.12, 0), mesh(new BoxGeometry(0.1, 0.1, 0.1), yellow, 0, -0.1, 0));
    this.root.add(this.marker);
  }
  setMarker(visible: boolean): void { this.marker.visible = visible; }
  setTalking(on: boolean): void { this.talking = on; }
  /** His lantern burns bright once his request is done. */
  setLit(on: boolean): void { this.litTarget = on ? 1 : 0; }
  wave(seconds = 1.5): void { this.wave_ = Math.max(this.wave_, seconds); }
  cheer(seconds = 1.8): void { this.cheer_ = seconds; this.cheerCued = false; }
  takeCheerCue(): boolean { if (this.cheer_ > 0 && !this.cheerCued && this.cheer_ < 1.5) { this.cheerCued = true; return true; } return false; }
  update(t: number, facing: number): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.last)); this.last = t;
    this.talk += ((this.talking ? 1 : 0) - this.talk) * Math.min(1, dt * 6);
    this.wave_ = Math.max(0, this.wave_ - dt); this.cheer_ = Math.max(0, this.cheer_ - dt); this.lit += (this.litTarget - this.lit) * Math.min(1, dt * 2.5);
    const wk = this.wave_ > 0 ? Math.min(1, this.wave_ * 3, (1.5 - this.wave_) * 5 + 0.2) : 0, ck = this.cheer_ > 0 ? Math.min(1, this.cheer_ * 3, (1.8 - this.cheer_) * 4 + 0.15) : 0;
    // hovering: a slow bob, a gentle sway, bounces while talking and a happy spin on a cheer
    this.root.rotation.y = facing + Math.sin(t * 0.6) * 0.12 * (1 - this.talk);
    this.body.rotation.y = ck * (1.8 - this.cheer_) * Math.PI * 2.2;
    this.body.position.y = 1.0 + Math.sin(t * 1.8) * 0.07 + Math.abs(Math.sin(t * 6)) * 0.05 * this.talk + ck * 0.25 * Math.abs(Math.sin(t * 7));
    this.body.rotation.z = Math.sin(t * 1.1) * 0.05 + Math.sin(t * 9) * 0.1 * wk; this.body.rotation.x = Math.sin(t * 0.9) * 0.03 - 0.1 * this.talk * (0.5 + 0.5 * Math.sin(t * 3));
    // blink now and then
    this.nextBlink -= dt; if (this.nextBlink <= 0 && this.blinkT < 0) { this.blinkT = 0; this.nextBlink = 2 + Math.random() * 3; }
    if (this.blinkT >= 0) { this.blinkT += dt; if (this.blinkT > 0.16) this.blinkT = -1; }
    const closed = this.blinkT < 0 ? 0 : Math.sin((this.blinkT / 0.16) * Math.PI);
    for (const l of this.lids) { l.scale.y = Math.max(0.01, closed); l.visible = closed > 0.05; }
    // the lantern: dim until his request is done, swinging when he waves, flaring on a cheer
    const bright = 0.35 + 0.65 * this.lit + ck * 0.6;
    this.lanternGem.position.y = -0.12 + Math.sin(t * 2.3) * 0.02 + wk * 0.12; this.lanternGlow.position.y = this.lanternGem.position.y; this.lanternGem.rotation.y = t * 1.5;
    (this.lanternGlow.material as { opacity: number }).opacity = Math.min(1, 0.18 + bright * 0.5 + Math.sin(t * 4) * 0.05); this.lanternGlow.scale.setScalar(0.9 + bright * 0.9);
    (this.halo.material as { opacity: number }).opacity = 0.2 + 0.2 * this.lit + 0.1 * Math.sin(t * 1.6);
    this.marker.position.y = 2.15 + Math.sin(t * 3) * 0.07; this.marker.rotation.y = t * 1.6;
  }
}

/**
 * Glowing warning drawn on the ground for an enemy's next attack. v2.27: solid red-orange (the old additive cream washed out on the bright
 * grass), a bright pulsing rim, and on the boss's big circles a ring of spinning warning teeth. It fills up as the strike gets closer
 * and pulses faster the nearer it is.
 */
export class TelegraphMarker {
  readonly root = new Group();
  private readonly baseMat = new MeshBasicMaterial({ color: 0xa30f08, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false, side: DoubleSide });
  private readonly fillMat = new MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: DoubleSide });
  private readonly rimMat = new MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: DoubleSide });   // normal blending: an additive rim bleaches to white on bright grass
  private readonly circleBase = new Mesh(new CircleGeometry(1, 40), this.baseMat);
  private readonly circleFill = new Mesh(new CircleGeometry(1, 40), this.fillMat);
  private readonly rim = new Mesh(new TorusGeometry(1, 0.045, 4, 56), this.rimMat);
  private readonly lineBase = new Mesh(new PlaneGeometry(1, 1), this.baseMat);
  private readonly lineFill = new Mesh(new PlaneGeometry(1, 1), this.fillMat);
  private readonly teeth = new Group();
  private readonly tooth: Mesh[] = [];
  private shape: Shape | null = null;
  constructor() {
    for (const m of [this.circleBase, this.circleFill, this.lineBase, this.lineFill]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 6; }
    this.rim.rotation.x = Math.PI / 2; this.rim.renderOrder = 7;
    const toothGeo = new ConeGeometry(0.16, 0.5, 3);
    for (let i = 0; i < 14; i++) {
      const pivot = new Group(); pivot.rotation.y = -(i / 14) * Math.PI * 2;
      const t = new Mesh(toothGeo, this.rimMat); t.rotation.z = Math.PI / 2; t.rotation.x = Math.PI / 2; t.renderOrder = 7; pivot.add(t); this.teeth.add(pivot); this.tooth.push(t);
    }
    this.root.add(this.circleBase, this.circleFill, this.rim, this.lineBase, this.lineFill, this.teeth);
    this.root.visible = false;
  }
  show(shape: Shape, y: number): void {
    this.shape = shape; this.root.visible = true;
    const isCircle = shape.type === 'circle';
    this.circleBase.visible = this.circleFill.visible = this.rim.visible = isCircle;
    this.lineBase.visible = this.lineFill.visible = !isCircle;
    this.teeth.visible = isCircle && shape.r >= 2;
    if (shape.type === 'circle') {
      this.root.position.set(shape.x, y + 0.12, shape.z); this.root.rotation.y = 0;
      this.circleBase.scale.set(shape.r, shape.r, 1); this.rim.scale.set(shape.r, shape.r, 1);
      for (const t of this.tooth) t.position.x = shape.r + 0.05;
    } else {
      // the line runs from (x,z) along (dx,dz); the plane is 1 wide (across) and 1 long (along)
      this.root.position.set(shape.x + shape.dx * shape.length * 0.5, y + 0.12, shape.z + shape.dz * shape.length * 0.5);
      this.root.rotation.y = Math.atan2(shape.dx, shape.dz);
      this.lineBase.scale.set(shape.width, shape.length, 1);
    }
    this.setProgress(0);
  }
  setProgress(p: number): void {
    const s = this.shape; if (!s) return;
    const k = Math.max(0.02, clamp01(p)), now = performance.now(), pulse = 0.5 + 0.5 * Math.sin(now * (0.012 + 0.022 * k));
    if (s.type === 'circle') { this.circleFill.scale.set(s.r * k, s.r * k, 1); this.teeth.rotation.y = now * 0.0009 * (1 + k * 2); }
    else { this.lineFill.scale.set(s.width * 0.98, s.length * k, 1); this.lineFill.position.z = -s.length * 0.5 * (1 - k); }
    this.fillMat.opacity = 0.36 + 0.22 * pulse + 0.2 * k;
    this.baseMat.opacity = 0.26 + 0.1 * pulse;
    this.rimMat.opacity = 0.55 + 0.4 * pulse;
  }
  hide(): void { this.root.visible = false; this.shape = null; }
}

/** A glowing petal to collect: a little flower that bobs and spins, with a soft halo. */
export class PetalView {
  readonly root = new Group();
  private readonly flower = new Group();
  collected = false;
  private readonly sparks: ReturnType<typeof glowSprite>[] = [];
  constructor(readonly id: number, private readonly baseY: number) {
    // unlit vertex colours so the blossom glows by itself, day and night
    this.flower.add(new Mesh(petalFlowerGeometry(), new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })));
    this.flower.add(glowSprite(0xff9fe0, 1.7, 0.7));
    for (let i = 0; i < 3; i++) { const s = glowSprite(0xfff0a0, 0.22, 0.95); this.sparks.push(s); this.flower.add(s); }
    this.flower.position.y = 0.72;
    this.root.add(this.flower);
    this.root.add(new Mesh(petalStemGeometry(), new MeshLambertMaterial({ vertexColors: true })));
  }
  update(t: number): void {
    this.flower.position.y = 0.78 + Math.sin(t * 2 + this.id) * 0.08; this.flower.rotation.y = t * 0.9 + this.id;
    this.sparks.forEach((s, i) => { const a = t * 1.8 + i * 2.1 + this.id; s.position.set(Math.cos(a) * 0.42, 0.2 + Math.sin(a * 1.3) * 0.18, Math.sin(a) * 0.42); s.material.opacity = 0.55 + 0.4 * Math.sin(a * 2.2); });
  }
  get groundY(): number { return this.baseY; }
}

/**
 * The Rune Stone: an old plinth with three floating rune gems that light up as riddles are answered. It stands beside the end of
 * the trail, turned to face whoever comes up it. A "!" floats above it while it is waiting for riddles to be answered.
 */
export class RuneStoneModel {
  readonly root = new Group();
  private readonly gems: { mat: MeshLambertMaterial; mesh: Mesh; glow: ReturnType<typeof glowSprite> }[] = [];
  private readonly carvings: MeshBasicMaterial[] = [];
  private readonly marker = new Group();
  /** v2.23: a pulsing ring on the ground and a soft beacon so the stone reads as "touch me", even on a small phone screen. */
  private readonly ring = new Mesh(new TorusGeometry(1.7, 0.06, 6, 48), new MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  private readonly beacon = glowSprite(0xffe066, 2.6, 0.5);
  private markerOn = false; private near = false;
  private lit = 0;
  constructor() {
    this.root.add(blobShadow(1.0));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.08; this.ring.visible = false;
    this.beacon.position.y = 2.7; this.beacon.visible = false;
    this.root.add(this.ring, this.beacon);
        this.root.add(new Mesh(runeStoneGeometry(), new MeshLambertMaterial({ vertexColors: true })));
    // three carved marks on the front of the column, one per riddle; they glow when that riddle is solved
    for (let i = 0; i < 3; i++) {
      const m = new MeshBasicMaterial({ color: 0x3b4640 }); this.carvings.push(m);
      const x = (i - 1) * 0.27;
      this.root.add(mesh(new BoxGeometry(0.1, 0.34, 0.05), m, x, 0.8, 0.62 - Math.abs(i - 1) * 0.07).rotateY(-(i - 1) * 0.5));
    }
    // three gems hovering over the top slab
    for (let i = 0; i < 3; i++) {
      const mat = new MeshLambertMaterial({ color: 0xaab8b4, emissive: 0x33c8b8, emissiveIntensity: 0.05, flatShading: true });
      const gem = mesh(new OctahedronGeometry(0.15, 0), mat, (i - 1) * 0.42, 1.85, 0); gem.scale.y = 1.5;
      const glow = glowSprite(0x66e8d4, 1.1, 0); glow.position.copy(gem.position);
      this.root.add(gem, glow); this.gems.push({ mat, mesh: gem, glow });
    }
    this.marker.position.y = 2.7;
    const yellow = new MeshBasicMaterial({ color: 0xffe066 });
    this.marker.add(mesh(new BoxGeometry(0.1, 0.26, 0.1), yellow, 0, 0.12, 0), mesh(new BoxGeometry(0.1, 0.1, 0.1), yellow, 0, -0.1, 0));
    this.root.add(this.marker);
    this.root.rotation.y = Math.atan2(2, 3); // turned toward the south-east, where the trail comes from
  }
  /** How many riddles are solved (0..3): that many gems and carvings are lit. */
  setSolved(n: number): void { this.lit = Math.max(0, Math.min(3, Math.floor(n))); }
  setMarker(visible: boolean): void { this.markerOn = visible; this.applyCue(); }
  /** The hero is close enough to read the stone: the ring brightens and breathes faster. */
  setNear(near: boolean): void { this.near = near; this.applyCue(); }
  private applyCue(): void { this.marker.visible = this.markerOn; this.beacon.visible = this.markerOn; this.ring.visible = this.markerOn || this.near; }
  update(t: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(t * (this.near ? 6 : 2.6));
    this.ring.scale.setScalar(1 + pulse * (this.near ? 0.12 : 0.06));
    (this.ring.material as MeshBasicMaterial).opacity = (this.near ? 0.7 : 0.35) + pulse * 0.3;
    (this.beacon.material as { opacity: number }).opacity = 0.3 + pulse * 0.3;
    this.marker.scale.setScalar(1.7);
    this.gems.forEach((g, i) => {
      const on = i < this.lit ? 1 : 0;
      g.mesh.position.y = 1.85 + Math.sin(t * 1.8 + i * 1.7) * 0.07; g.mesh.rotation.y = t * (0.8 + i * 0.2); g.glow.position.y = g.mesh.position.y;
      g.mat.emissiveIntensity = 0.05 + on * (0.95 + Math.sin(t * 3 + i) * 0.12);
      g.mat.color.setHex(on ? 0xbff4ee : 0xaab8b4); g.glow.material.opacity = on * (0.6 + Math.sin(t * 2.4 + i) * 0.1);
    });
    this.carvings.forEach((m, i) => m.color.setHex(i < this.lit ? 0x7cf0dc : 0x3b4640));
    this.marker.position.y = 2.7 + Math.sin(t * 3) * 0.07; this.marker.rotation.y = t * 1.6;
  }
}
