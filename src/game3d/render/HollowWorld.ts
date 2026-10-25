/**
 * The Crystal Hollow as three.js objects (v2.22). The layout, colliders and rules live in systems/hollowLayout.ts and hollowQuest.ts; this
 * file only draws them and animates them. It reuses the woods' painted look (`withPaint`, the `Kit` modelling helper, glow sprites), keeps
 * every repeated object instanced (wall rocks, crystal clusters) and every landmark merged, so the whole cave is a few dozen draw calls.
 * It is built the first time the hero goes through the Moonlit Gate, so players who never enter pay nothing for it.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, OctahedronGeometry, PlaneGeometry, Points, PointsMaterial, Quaternion, RingGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3,
  type Scene, type Sprite,
} from 'three';
import { Kit, M, mat } from './env/Structures';
import { fbm2, noise2 } from './env/noise';
import { glowSprite, glowTexture } from './common';
import { withPaint } from './stylize';
import { smoothstep } from '../systems/worldShape';
import { ColliderGrid } from '../systems/colliders';
import type { Quality } from '../systems/quality';
import {
  DOOR_POS, ECHO_COLORS, ECHO_ORDER, ECHO_SPOTS, GLOWCAP_SPOTS, GROTTO, HEART_CHAMBER, HEART_POS, HOLLOW_EXIT, HUB, MURAL_POS, POOL_ROOM, POOL_WATER, PRISM_POS,
  SECRET_COLLIDERS, SHARD_SPOTS, STALAGMITES, TABLET_SPOTS, buildHollowDecor, floorDistance, hollowGrid, type EchoColor, type HollowGates,
} from '../systems/hollowLayout';
import type { SkyLook } from '../systems/lighting3d';

/** Colour of each Echo Crystal: also used by the mural, the door sockets and the map. */
export const ECHO_HEX: Readonly<Record<EchoColor, number>> = { gold: 0xffc83a, blue: 0x45a6ff, pink: 0xff6fc0 };
const HUES = [{ c: 0x5fd8ff, g: 0x8fe8ff }, { c: 0x6dffb0, g: 0xaaffd0 }, { c: 0x6a9bff, g: 0x9fbdff }, { c: 0xff8fd0, g: 0xffc8e8 }, { c: 0xc59bff, g: 0xdfc8ff }];

/** What the cave looks like: no sun, a deep blue-violet air, bright coloured fill. Fed to the same `applyLook` the woods use. */
export const HOLLOW_LOOK: SkyLook = {
  sky: [0x080c24, 0x121a40, 0x1e2c5e, 0x25366c], fog: 0x16204a, fogNear: 20, fogFar: 66,
  hemiSky: 0xd6dcf6, hemiGround: 0x8a7a9e, hemiIntensity: 1.25, sun: 0xd8e2ff, sunIntensity: 1.1, sunPos: [-12, 46, 18], exposure: 1.1,
};

/** A cluster of five hexagonal crystals growing from one point, one geometry reused (instanced) with a tint per instance. */
function clusterGeometry(): BufferGeometry {
  const k = new Kit();
  const prism = (x: number, z: number, h: number, r: number, rx: number, rz: number): void => {
    const body = new CylinderGeometry(r * 0.8, r, h * 0.72, 6); body.translate(0, h * 0.36, 0);
    const tip = new CylinderGeometry(0, r * 0.8, h * 0.28, 6); tip.translate(0, h * 0.72 + h * 0.14, 0);
    k.add(body, 0xd6e6f4, M(x, 0, z, rx, 0, rz)); k.add(tip, 0xffffff, M(x, 0, z, rx, 0, rz));
  };
  prism(0, 0, 1.7, 0.2, 0, 0); prism(0.28, 0.1, 1.1, 0.15, 0.25, -0.3); prism(-0.26, 0.05, 1.3, 0.16, -0.2, 0.3); prism(0.05, -0.28, 0.9, 0.13, -0.35, -0.05); prism(-0.08, 0.3, 0.75, 0.12, 0.4, 0.1);
  return k.build(0.4, 0.7);
}
/** One tall crystal (for the Echo Crystals and the Heart Door sockets). */
function crystalGeometry(h: number, r: number): BufferGeometry {
  const body = new CylinderGeometry(r * 0.78, r, h * 0.7, 6); body.translate(0, h * 0.35, 0);
  const tip = new CylinderGeometry(0, r * 0.78, h * 0.3, 6); tip.translate(0, h * 0.7 + h * 0.15, 0);
  const k = new Kit(); k.add(body, 0xffffff); k.add(tip, 0xffffff); return k.build(0, 1);
}
const glowMat = (color: number, opacity: number): MeshBasicMaterial => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
function shaft(r0: number, r1: number, h: number, color: number, opacity: number): Mesh {
  const m = new Mesh(new CylinderGeometry(r1, r0, h, 14, 1, true), glowMat(color, opacity)); m.renderOrder = 2; return m;
}

// ---------------------------------------------------------------------------------------------------------------- small animated pieces
class ShardView {
  readonly root = new Group(); collected = false; private readonly gem: Mesh; private readonly halo: Sprite;
  constructor(readonly id: number, x: number, z: number) {
    this.gem = new Mesh(new OctahedronGeometry(0.3), new MeshBasicMaterial({ color: 0xe4f8ff })); this.gem.scale.set(1, 1.6, 1);
    this.halo = glowSprite(0x8fe0ff, 2.2, 0.8);
    this.root.add(this.gem, this.halo); this.root.position.set(x, 0.95, z);
  }
  update(t: number): void { if (this.collected) return; this.gem.rotation.y = t * 1.7 + this.id; this.root.position.y = 0.95 + Math.sin(t * 2 + this.id * 1.3) * 0.12; (this.halo.material as { opacity: number }).opacity = 0.65 + 0.2 * Math.sin(t * 3 + this.id); }
}

class EchoView {
  readonly root = new Group(); lit = false; private flash = 0; private readonly body: Mesh<BufferGeometry, MeshLambertMaterial>; private readonly halo: Sprite; private readonly beam: Mesh; private readonly ping: Mesh;
  constructor(readonly color: EchoColor) {
    const hex = ECHO_HEX[color], p = ECHO_SPOTS[color];
    const base = new Kit().cyl(0.95, 1.1, 0.28, 10, 0, 0.14, 0, 0x6a6f8c).cyl(0.7, 0.8, 0.14, 10, 0, 0.35, 0, 0x8a90b0).build(0.2, 0.5);
    const baseMesh = new Mesh(base, mat()); baseMesh.castShadow = baseMesh.receiveShadow = true;
    this.body = new Mesh(crystalGeometry(2.1, 0.42), new MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.4, flatShading: true }));
    this.body.position.y = 0.4; this.body.castShadow = true;
    this.halo = glowSprite(hex, 4.2, 0.45); this.halo.position.y = 1.5;
    this.beam = shaft(0.18, 0.5, 9, hex, 0.1); this.beam.position.y = 4.9;
    this.ping = new Mesh(new RingGeometry(0.9, 1.1, 32), glowMat(hex, 0)); this.ping.rotation.x = -Math.PI / 2; this.ping.position.y = 0.08;
    this.root.add(baseMesh, this.body, this.halo, this.beam, this.ping); this.root.position.set(p.x, 0, p.z);
  }
  strike(): void { this.flash = 1; }
  update(t: number, dt: number, done: boolean): void {
    this.flash = Math.max(0, this.flash - dt * 1.6);
    const lit = this.lit || done, idle = 0.4 + 0.15 * Math.sin(t * 2.2 + ECHO_COLORS.indexOf(this.color) * 2);
    const e = (lit ? 1.1 : idle) + this.flash * 1.2;
    this.body.material.emissiveIntensity = e; this.body.rotation.y = t * (lit ? 0.9 : 0.3);
    (this.halo.material as { opacity: number }).opacity = Math.min(1, (lit ? 0.85 : 0.35 + 0.1 * Math.sin(t * 2.2)) + this.flash * 0.4); this.halo.scale.setScalar((lit ? 5.2 : 4.2) + this.flash * 2);
    (this.beam.material as MeshBasicMaterial).opacity = lit ? 0.2 : 0.09 + 0.03 * Math.sin(t * 2);
    const pm = this.ping.material as MeshBasicMaterial; pm.opacity = this.flash * 0.8; this.ping.scale.setScalar(1 + (1 - this.flash) * 3);
  }
}

class GlowcapView {
  readonly root = new Group(); lit = false; private flash = 0; private readonly cap: Mesh<BufferGeometry, MeshLambertMaterial>; private readonly halo: Sprite;
  constructor(readonly id: number) {
    const p = GLOWCAP_SPOTS[id];
    const stalk = new Mesh(new CylinderGeometry(0.16, 0.24, 0.9, 8), mat0(0xe6e0cc)); stalk.position.y = 0.45;
    this.cap = new Mesh(new SphereGeometry(0.7, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), new MeshLambertMaterial({ color: 0x3fd6a0, emissive: 0x3fd6a0, emissiveIntensity: 0.25, flatShading: true }));
    this.cap.position.y = 0.85; this.cap.scale.set(1, 0.8, 1);
    const stone = new Mesh(new CylinderGeometry(0.85, 1.0, 0.22, 10), mat0(0x6a7090)); stone.position.y = 0.11;
    this.halo = glowSprite(0x7dffd0, 3.4, 0.25); this.halo.position.y = 1.0;
    for (const m of [stalk, this.cap, stone]) m.castShadow = true;
    this.root.add(stone, stalk, this.cap, this.halo); this.root.position.set(p.x, 0.05, p.z);
  }
  light(): void { this.lit = true; this.flash = 1; }
  update(t: number, dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.cap.material.emissiveIntensity = (this.lit ? 1.2 + 0.2 * Math.sin(t * 3 + this.id) : 0.25 + 0.08 * Math.sin(t * 2 + this.id)) + this.flash * 1.5;
    (this.halo.material as { opacity: number }).opacity = (this.lit ? 0.85 : 0.2 + 0.08 * Math.sin(t * 2 + this.id)) + this.flash * 0.3; this.halo.scale.setScalar(this.lit ? 4.6 : 3.4);
  }
}
const mat0 = (color: number): MeshLambertMaterial => withPaint(new MeshLambertMaterial({ color, flatShading: true }));

/**
 * A Moon Tablet (v2.28): a small carved standing stone with a crescent glyph, tucked into a quiet corner. Unread, its glyph glints softly
 * (so a careful explorer notices it); once read it settles to a calm steady glow.
 */
class TabletView {
  readonly root = new Group();
  read = false; private flash = 0;
  private readonly glyph: Mesh<BufferGeometry, MeshBasicMaterial>; private readonly halo: Sprite;
  constructor(readonly id: number, p: { x: number; z: number }) {
    const k = new Kit();
    k.box(0.95, 0.16, 0.5, 0, 0.08, 0, 0x555b88); k.box(0.78, 1.25, 0.2, 0, 0.78, 0, 0x6a719e);                 // a plinth and the slab
    k.ball(0.39, 0, 1.4, 0, 0x6a719e, 1, 0.6, 0.5, 1);                                                          // a rounded top
    k.box(0.5, 0.05, 0.04, 0, 0.62, 0.11, 0x3a3f68); k.box(0.5, 0.05, 0.04, 0, 0.48, 0.11, 0x3a3f68);         // carved lines of text
    k.ball(0.09, -0.42, 0.28, 0.2, 0x7a82b0, 1, 0.7, 1, 1); k.ball(0.07, 0.4, 0.22, 0.24, 0x5a6190, 1, 0.7, 1, 1);   // a little rubble at the foot
    const body = new Mesh(k.build(0.2, 1.4), mat0(0xffffff)); body.castShadow = true; this.root.add(body);
    this.glyph = new Mesh(new RingGeometry(0.17, 0.26, 20, 1, 0.9, 4.6), new MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false })); this.glyph.position.set(0, 1.0, 0.115);
    this.halo = glowSprite(0xaee8ff, 2.2, 0.3); this.halo.position.set(0, 1.0, 0.3);
    this.root.add(this.glyph, this.halo); this.root.position.set(p.x, 0.02, p.z);
  }
  /** Played when the hero reads it. */
  readNow(): void { this.read = true; this.flash = 1; }
  update(t: number, dt: number): void {
    this.flash = Math.max(0, this.flash - dt * 1.2);
    const glint = this.read ? 0.5 : 0.35 + 0.35 * Math.max(0, Math.sin(t * 2.1 + this.id * 2));   // unread: a slow glint that catches the eye
    this.glyph.material.opacity = Math.min(1, glint + 0.3 + this.flash);
    (this.halo.material as { opacity: number }).opacity = Math.min(0.9, 0.12 + glint * 0.35 + this.flash * 0.5); this.halo.scale.setScalar(2 + this.flash * 1.6);
  }
}

// ---------------------------------------------------------------------------------------------------------------- the world
export class HollowWorld {
  readonly group = new Group();
  grid: ColliderGrid;
  gates: HollowGates = { doorOpen: false, secretOpen: false };
  private readonly shards: ShardView[] = [];
  private readonly echoes: EchoView[] = ECHO_COLORS.map(c => new EchoView(c));
  private readonly caps: GlowcapView[] = GLOWCAP_SPOTS.map((_, i) => new GlowcapView(i));
  private readonly tablets: TabletView[] = TABLET_SPOTS.map((p, i) => new TabletView(i, p));
  private readonly doorLeaves: Mesh[] = []; private readonly doorGems: { m: Mesh<BufferGeometry, MeshLambertMaterial>; s: Sprite }[] = [];
  private doorK = 0; private doorTarget = 0;
  private readonly secret = new Group(); private secretK = 1; private secretTarget = 1;
  private readonly prismRing: Mesh; private readonly prismBits: Mesh[] = []; private readonly prismHalo: Sprite;
  private readonly heartGem: Mesh<BufferGeometry, MeshLambertMaterial>; private readonly heartRings: Mesh[] = []; private readonly heartHalo: Sprite; private readonly heartShaft: Mesh; private heartLit = false; private wardenDown = true; private heartK = 0.25;
  private readonly water: Mesh<BufferGeometry, MeshLambertMaterial>; private readonly ripples: Mesh[] = [];
  private readonly portal: Mesh; private readonly portalHalo: Sprite;
  private readonly pulseSprites: { s: Sprite; base: number; ph: number }[] = [];
  private readonly motes: { points: Points; pos: Float32Array; seed: Float32Array; col: Float32Array };
  private doneEchoes = false; private last = 0;

  constructor(scene: Scene, quality: Quality = 'high') {
    this.grid = hollowGrid(this.gates);
    const low = quality === 'low';
    this.group.name = 'hollow'; this.group.visible = false; scene.add(this.group);
    this.buildFloor(low ? 1.7 : quality === 'medium' ? 1.4 : 1.15); this.buildWalls(low); this.buildStalagmites();
    this.prismRing = new Mesh(new TorusGeometry(2.9, 0.05, 6, 48), glowMat(0x9fe6ff, 0.28)); this.prismHalo = glowSprite(0x7fdcff, 11, 0.55);
    this.buildPrism(); this.buildMural(); this.buildDoor();
    const { gem, halo, shaftMesh } = this.buildHeart(); this.heartGem = gem; this.heartHalo = halo; this.heartShaft = shaftMesh;
    this.water = this.buildPool(); this.portal = new Mesh(new PlaneGeometry(3.6, 4.4), glowMat(0xbfe4ff, 0.35)); this.portalHalo = glowSprite(0xbfe4ff, 7, 0.5); this.buildExit();
    for (let i = 0; i < SHARD_SPOTS.length; i++) { const v = new ShardView(i, SHARD_SPOTS[i].x, SHARD_SPOTS[i].z); this.shards.push(v); this.group.add(v.root); }
    for (const e of this.echoes) this.group.add(e.root);
    for (const c of this.caps) this.group.add(c.root);
    for (const t of this.tablets) this.group.add(t.root);
    this.buildSecretWall();
    this.motes = this.buildMotes(low ? 22 : 40);
  }

  // ------------------------------------------------------------------------------------------------------------ state from the game
  get visible(): boolean { return this.group.visible; }
  set visible(v: boolean) { this.group.visible = v; }
  /** Opens or closes the Heart Door and the secret nook. `animate` is false when loading a save (they simply appear open). */
  setGates(g: HollowGates, animate = true): void {
    this.gates = { ...g }; this.grid = hollowGrid(this.gates);
    this.doorTarget = g.doorOpen ? 1 : 0; this.secretTarget = g.secretOpen ? 0 : 1;
    if (!animate) { this.doorK = this.doorTarget; this.secretK = this.secretTarget; this.applyDoor(); this.applySecret(); }
  }
  setShards(found: readonly number[]): void { for (const s of this.shards) { s.collected = found.includes(s.id); s.root.visible = !s.collected; } }
  setGlowcaps(lit: readonly number[]): void { for (const c of this.caps) c.lit = lit.includes(c.id); }
  strikeEcho(color: EchoColor, lit: boolean): void { const e = this.echoes.find(x => x.color === color); if (!e) return; e.strike(); e.lit = lit; }
  /** Wrong crystal: they all fade back to waiting. */
  resetEchoes(): void { for (const e of this.echoes) e.lit = false; }
  setEchoesDone(done: boolean): void { this.doneEchoes = done; if (done) for (const e of this.echoes) e.lit = true; }
  lightGlowcap(i: number): void { this.caps[i]?.light(); }
  setHeartLit(on: boolean): void { this.heartLit = on; }
  /** v2.28: the Heartstone stays dim while the Warden guards it, and brightens when it is beaten (or was beaten in the save). */
  setWardenDown(down: boolean): void { this.wardenDown = down; }
  setTablets(read: readonly number[]): void { for (const t of this.tablets) t.read = read.includes(t.id); }
  readTablet(i: number): void { this.tablets[i]?.readNow(); }
  shardPosition(i: number): { x: number; z: number } { return SHARD_SPOTS[i]; }

  // ------------------------------------------------------------------------------------------------------------ frame
  update(t: number, hero: { x: number; z: number }): void {
    const dt = Math.min(0.1, Math.max(0, t - this.last)); this.last = t;
    for (const s of this.shards) s.update(t);
    for (const e of this.echoes) e.update(t, dt, this.doneEchoes);
    for (const c of this.caps) c.update(t, dt);
    for (const tb of this.tablets) tb.update(t, dt);
    this.prismRing.rotation.set(Math.PI / 2 + Math.sin(t * 0.4) * 0.25, t * 0.5, 0);
    this.prismBits.forEach((b, i) => { const a = t * 0.6 + (i / this.prismBits.length) * Math.PI * 2; b.position.set(Math.cos(a) * 3.4, 3.0 + Math.sin(t * 1.3 + i) * 0.35, Math.sin(a) * 3.4); b.rotation.y = t * 2 + i; });
    (this.prismHalo.material as { opacity: number }).opacity = 0.5 + 0.1 * Math.sin(t * 1.4);
    for (const p of this.pulseSprites) (p.s.material as { opacity: number }).opacity = p.base * (0.8 + 0.2 * Math.sin(t * 1.5 + p.ph));
    // the Heartstone: dim until the door is open, then it wakes, and blazes once touched
    const wantHeart = this.heartLit ? 1 : this.gates.doorOpen ? (this.wardenDown ? 0.6 : 0.35) : 0.2; this.heartK += (wantHeart - this.heartK) * Math.min(1, dt * 2);
    this.heartGem.position.y = 2.3 + Math.sin(t * 1.6) * 0.2; this.heartGem.rotation.y = t * 0.9; this.heartGem.material.emissiveIntensity = 0.2 + this.heartK * 1.4;
    this.heartRings.forEach((r, i) => r.rotation.set(Math.PI / 2 + Math.sin(t * 0.7 + i * 2) * 0.5, t * (0.6 + i * 0.25), i * 1.1)); this.heartRings.forEach(r => { (r.material as MeshBasicMaterial).opacity = 0.15 + this.heartK * 0.55; });
    (this.heartHalo.material as { opacity: number }).opacity = 0.1 + this.heartK * 0.7; this.heartHalo.scale.setScalar(5 + this.heartK * 3.5);
    (this.heartShaft.material as MeshBasicMaterial).opacity = this.heartK * 0.16;
    // water, portal
    this.water.material.emissiveIntensity = 0.5 + 0.12 * Math.sin(t * 1.3);
    this.ripples.forEach((r, i) => { const k = ((t * 0.35 + i * 0.5) % 1); r.scale.setScalar(0.6 + k * 1.7); (r.material as MeshBasicMaterial).opacity = (1 - k) * 0.35; });
    (this.portal.material as MeshBasicMaterial).opacity = 0.28 + 0.1 * Math.sin(t * 2.4); (this.portalHalo.material as { opacity: number }).opacity = 0.4 + 0.12 * Math.sin(t * 1.9);
    // the door slides open, the secret wall shatters (shrinks away)
    if (this.doorK !== this.doorTarget) { this.doorK += Math.sign(this.doorTarget - this.doorK) * Math.min(Math.abs(this.doorTarget - this.doorK), dt * 0.7); this.applyDoor(); }
    if (this.secretK !== this.secretTarget) { this.secretK += Math.sign(this.secretTarget - this.secretK) * Math.min(Math.abs(this.secretTarget - this.secretK), dt * 2.2); this.applySecret(); }
    this.updateMotes(t, hero);
  }
  private applyDoor(): void {
    const k = this.doorK, e = k * k * (3 - 2 * k);
    this.doorLeaves.forEach((l, i) => { const s = i === 0 ? -1 : 1; l.position.x = DOOR_POS.x + s * (1.3 + e * 2.3); l.visible = e < 0.98; });
    for (const g of this.doorGems) { g.m.material.emissiveIntensity = 0.5 + e * 1.3; (g.s.material as { opacity: number }).opacity = 0.3 + e * 0.6; }
  }
  private applySecret(): void {
    const k = this.secretK; this.secret.visible = k > 0.01; this.secret.scale.set(k, k, k);
    this.secret.children.forEach((c, i) => { c.rotation.y += 0.02 * (1 - k) * (i + 1); });
  }

  // ------------------------------------------------------------------------------------------------------------ building
  private buildFloor(cell: number): void {
    const x0 = -53, x1 = 49, z0 = -43, z1 = 46;
    const sx = Math.round((x1 - x0) / cell), sz = Math.round((z1 - z0) / cell);
    const g = new PlaneGeometry(x1 - x0, z1 - z0, sx, sz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new Color();
    const floorA = new Color(0x8e88a8), floorB = new Color(0x6e6a8c), path = new Color(0xb0a8bc), edge = new Color(0x2c2c52), rockC = new Color(0x161a36), moss = new Color(0x5a9c86), pinkC = new Color(0xb08aa8), blueC = new Color(0x6a8cc0);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), sd = floorDistance(x, z);
      pos.setY(i, sd <= 0 ? 0 : 3.6 * smoothstep(0, 2.6, sd) + 0.8 * smoothstep(2.6, 7, sd));
      const big = fbm2(x * 0.09 + 3, z * 0.09 - 5, 3), fine = noise2(x * 0.8, z * 0.8), slab = noise2(Math.floor(x * 1.4) * 1.9, Math.floor(z * 1.4) * 1.3);
      c.copy(floorB).lerp(floorA, smoothstep(0.3, 0.75, big)).lerp(path, smoothstep(0.55, 0.9, slab) * 0.35).multiplyScalar(0.92 + 0.16 * fine);
      const dHub = Math.hypot(x - HUB.x, z - HUB.z), dGr = Math.hypot(x - GROTTO.x, z - GROTTO.z), dPo = Math.hypot(x - POOL_ROOM.x, z - POOL_ROOM.z), dHe = Math.hypot(x - HEART_CHAMBER.x, z - HEART_CHAMBER.z);
      c.lerp(moss, 0.5 * (1 - smoothstep(3, 9, dGr)) * (0.5 + 0.5 * fine)).lerp(blueC, 0.4 * (1 - smoothstep(2, 9, dPo))).lerp(pinkC, 0.4 * (1 - smoothstep(2, 8.5, dHe)));
      c.lerp(path, 0.28 * (1 - smoothstep(0, 4, dHub)));
      // dark rim where the floor meets the wall, and solid dark rock beyond it
      if (sd > -1.6) c.multiplyScalar(0.62 + 0.38 * smoothstep(0, -1.6, sd)); // sd in (-1.6, 0): fade into the rim shadow
      if (sd > 0) c.lerp(edge, smoothstep(0, 1.2, sd)).lerp(rockC, smoothstep(1.2, 5, sd));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(col, 3)); g.computeVertexNormals();
    // flagstones: a tile pattern drawn in the fragment shader (dark joints, a tint per stone, a little wear), like the woods ground's painted detail
    const fm = new MeshLambertMaterial({ vertexColors: true });
    fm.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position.xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec2 vGround;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 q = vGround / 1.7; q.x += 0.5 * mod(floor(q.y), 2.0);
          vec2 id = floor(q), f = fract(q);
          float edgeD = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
          float joint = 1.0 - smoothstep(0.02, 0.07, edgeD);
          float tone = 0.88 + 0.24 * fh(id);
          float lip = smoothstep(0.07, 0.2, edgeD);
          float near = 1.0 - smoothstep(10.0, 34.0, length(vViewPosition));
          float floorOnly = smoothstep(0.35, 0.6, diffuseColor.b + diffuseColor.g - 0.2 * diffuseColor.r);
          diffuseColor.rgb *= mix(1.0, tone * (0.9 + 0.1 * lip) * (1.0 - 0.45 * joint), 0.85 * near + 0.15) * mix(1.0, 1.0, floorOnly);
        }`);
    };
    const m = new Mesh(g, withPaint(fm)); m.receiveShadow = true; m.name = 'hollow-floor'; this.group.add(m);
  }

  private buildWalls(low: boolean): void {
    const decor = buildHollowDecor();
    const rocks = decor.rocks.filter((_, i) => !low || i % 3 !== 0);
    const rockMesh = new InstancedMesh(new IcosahedronGeometry(1, 0), withPaint(new MeshLambertMaterial({ flatShading: true })), rocks.length), mtx = new Matrix4(), tint = new Color();
    rocks.forEach((r, i) => {
      mtx.compose(new Vector3(r.x, r.sy * 0.45 - 0.25, r.z), quatY(r.rot), new Vector3(r.sx, r.sy, r.sz)); rockMesh.setMatrixAt(i, mtx);
      const near = floorDistance(r.x, r.z) < 1.5; tint.setHex(near ? 0x7c7aa8 : 0x4c4e7c).multiplyScalar(0.8 + r.tone * 0.5); rockMesh.setColorAt(i, tint);
    });
    rockMesh.instanceMatrix.needsUpdate = true; if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true; rockMesh.name = 'hollow-walls'; this.group.add(rockMesh);

    // crystal clusters at the foot of the wall
    const cl = decor.crystals.filter((_, i) => !low || i % 2 === 0);
    const mesh = new InstancedMesh(clusterGeometry(), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a4a70 }), cl.length);
    cl.forEach((s, i) => {
      mtx.compose(new Vector3(s.x, 0, s.z), quatY(s.rot), new Vector3(s.scale, s.scale * (0.9 + (i % 4) * 0.12), s.scale)); mesh.setMatrixAt(i, mtx);
      mesh.setColorAt(i, tint.setHex(HUES[s.hue % HUES.length].c));
      if (s.glow && !low) { const sp = glowSprite(HUES[s.hue % HUES.length].g, 3.4 * s.scale, 0.45); sp.position.set(s.x, 0.8 * s.scale, s.z); this.group.add(sp); this.pulseSprites.push({ s: sp, base: 0.45, ph: i * 1.7 }); }
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.name = 'hollow-crystals'; this.group.add(mesh);
  }

  /** Dark spires with a glowing vein, standing where the layout has solid stalagmites. */
  private buildStalagmites(): void {
    const k = new Kit();
    STALAGMITES.forEach((s, i) => {
      const h = 2.4 + (i % 4) * 0.7, r = s.r * 1.25;
      k.add(new ConeGeometry(r, h, 7), i % 2 ? 0x4a5482 : 0x3a4372, M(s.x, h / 2, s.z, 0, i, 0));
      k.add(new ConeGeometry(r * 0.55, h * 0.62, 6), 0x59689a, M(s.x + r * 0.7, h * 0.31, s.z + r * 0.3, 0, i * 2, 0.25));
      k.add(new ConeGeometry(0.13, 0.9 + (i % 3) * 0.2, 5), HUES[i % HUES.length].c, M(s.x - r * 0.35, h * 0.55, s.z, 0, 0, 0.35));
    });
    const m = new Mesh(k.build(0.35, 1.4), mat()); m.castShadow = m.receiveShadow = true; this.group.add(m);
  }

  private buildPrism(): void {
    const k = new Kit(); const R = 1.9;
    k.cyl(2.5, 2.8, 0.4, 14, 0, 0.2, 0, 0x6a6f98).cyl(2.0, 2.3, 0.3, 14, 0, 0.55, 0, 0x8088b8);
    const spike = (x: number, z: number, h: number, r: number, tilt: number, a: number, c: number): void => {
      const body = new CylinderGeometry(r * 0.8, r, h * 0.75, 6); body.translate(0, h * 0.375, 0); const tip = new CylinderGeometry(0, r * 0.8, h * 0.25, 6); tip.translate(0, h * 0.75 + h * 0.125, 0);
      k.add(body, c, M(x, 0.7, z, Math.sin(a) * tilt, a, Math.cos(a) * tilt)); k.add(tip, 0xffffff, M(x, 0.7, z, Math.sin(a) * tilt, a, Math.cos(a) * tilt));
    };
    spike(0, 0, 5.6, 0.62, 0, 0, 0x9fe6ff);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; spike(Math.sin(a) * R * 0.55, Math.cos(a) * R * 0.55, 2.6 + (i % 3) * 0.8, 0.36, 0.22, a, i % 2 ? 0x7fb8ff : 0xb59cff); }
    const m = new Mesh(k.build(0.15, 1), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x3a7aa8 })); m.position.set(PRISM_POS.x, 0, PRISM_POS.z); m.castShadow = true; this.group.add(m);
    this.prismHalo.position.set(PRISM_POS.x, 3.2, PRISM_POS.z); this.prismRing.position.set(PRISM_POS.x, 3.0, PRISM_POS.z);
    for (let i = 0; i < 6; i++) { const b = new Mesh(new OctahedronGeometry(0.22), new MeshBasicMaterial({ color: i % 2 ? 0xbfe4ff : 0xe2d2ff })); b.scale.y = 1.5; this.prismBits.push(b); this.group.add(b); }
    const s = shaft(2.4, 3.6, 16, 0x8fd8ff, 0.07); s.position.set(PRISM_POS.x, 8, PRISM_POS.z); this.group.add(s, this.prismHalo, this.prismRing);
  }

  /** The Echo mural: three gems in order on a stone board that faces the middle of the cavern. */
  private buildMural(): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d')!;
    g.fillStyle = '#1b2147'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#e6c36a'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 236); g.strokeStyle = '#6f78b0'; g.lineWidth = 3; g.strokeRect(24, 24, 464, 208);
    g.font = '700 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ECHO_ORDER.forEach((c, i) => {
      const cx = 100 + i * 156, cy = 138, hex = '#' + ECHO_HEX[c].toString(16).padStart(6, '0');
      g.fillStyle = '#e6c36a'; g.fillText(String(i + 1), cx, 62);
      g.beginPath(); g.moveTo(cx, cy - 54); g.lineTo(cx + 38, cy - 8); g.lineTo(cx + 24, cy + 52); g.lineTo(cx - 24, cy + 52); g.lineTo(cx - 38, cy - 8); g.closePath();
      g.fillStyle = hex; g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff6d8'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(cx, cy - 54); g.lineTo(cx + 38, cy - 8); g.lineTo(cx, cy - 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 38, cy - 8); g.lineTo(cx, cy - 4); g.lineTo(cx + 24, cy + 52); g.moveTo(cx, cy - 4); g.lineTo(cx - 24, cy + 52); g.stroke();
      if (i < 2) { g.strokeStyle = '#e6c36a'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx + 52, cy); g.lineTo(cx + 96, cy); g.lineTo(cx + 84, cy - 12); g.moveTo(cx + 96, cy); g.lineTo(cx + 84, cy + 12); g.stroke(); }
    });
    const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4;
    const root = new Group(), yaw = Math.atan2(HUB.x - MURAL_POS.x, HUB.z - MURAL_POS.z);
    const board = new Mesh(new PlaneGeometry(4.8, 2.4), new MeshBasicMaterial({ map: tex })); board.position.set(0, 2.1, 0);
    const frame = new Kit().box(5.2, 2.8, 0.3, 0, 2.1, -0.18, 0x59608e).box(0.4, 3.6, 0.5, -2.7, 1.8, -0.1, 0x7078a8).box(0.4, 3.6, 0.5, 2.7, 1.8, -0.1, 0x7078a8).box(5.9, 0.35, 0.55, 0, 3.7, -0.1, 0x8a90bc);
    const fm = new Mesh(frame.build(0.25, 1.2), mat()); fm.castShadow = true; root.add(fm, board);
    ECHO_ORDER.forEach((c, i) => { const s = glowSprite(ECHO_HEX[c], 1.9, 0.5); s.position.set((i - 1) * 1.56, 1.75, 0.12); root.add(s); });
    root.position.set(MURAL_POS.x, 0, MURAL_POS.z); root.rotation.y = yaw; this.group.add(root);
  }

  private buildDoor(): void {
    const fr = new Kit().box(0.9, 5.2, 1.0, -3.25, 2.6, 0, 0x59608e).box(0.9, 5.2, 1.0, 3.25, 2.6, 0, 0x59608e).box(7.6, 0.9, 1.1, 0, 5.4, 0, 0x6a72a2).cyl(0.5, 0.6, 0.4, 8, -3.25, 5.4, 0, 0x8a90bc);
    const fm = new Mesh(fr.build(0.2, 1.2), mat()); fm.position.set(DOOR_POS.x, 0, DOOR_POS.z); fm.castShadow = true; this.group.add(fm);
    for (const s of [-1, 1]) {
      const leaf = new Mesh(new Kit().box(2.5, 4.9, 0.55, 0, 2.45, 0, 0x8fb4e0).box(2.1, 4.5, 0.2, 0, 2.45, 0.28, 0xb6d6ff).box(0.12, 4.3, 0.3, 0, 2.45, 0.34, 0xe6f2ff).build(0.15, 1.2), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x24446a }));
      leaf.position.set(DOOR_POS.x + s * 1.3, 0, DOOR_POS.z); leaf.castShadow = true; this.doorLeaves.push(leaf); this.group.add(leaf);
    }
    ECHO_ORDER.forEach((c, i) => {
      const gem = new Mesh(new OctahedronGeometry(0.34), new MeshLambertMaterial({ color: ECHO_HEX[c], emissive: ECHO_HEX[c], emissiveIntensity: 0.5, flatShading: true })); gem.scale.y = 1.4; gem.position.set(DOOR_POS.x + (i - 1) * 1.7, 5.4, DOOR_POS.z + 0.62);
      const sp = glowSprite(ECHO_HEX[c], 2.0, 0.3); sp.position.copy(gem.position); this.doorGems.push({ m: gem, s: sp }); this.group.add(gem, sp);
    });
  }

  private buildHeart(): { gem: Mesh<BufferGeometry, MeshLambertMaterial>; halo: Sprite; shaftMesh: Mesh } {
    const k = new Kit().cyl(2.2, 2.6, 0.35, 12, 0, 0.18, 0, 0x6a6f98).cyl(1.6, 1.9, 0.35, 12, 0, 0.52, 0, 0x7a82b0).cyl(0.9, 1.2, 0.8, 10, 0, 1.1, 0, 0x8c94c4);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.add(new ConeGeometry(0.18, 1.0, 5), i % 2 ? 0xff9fd8 : 0xffd68a, M(Math.cos(a) * 1.4, 0.95, Math.sin(a) * 1.4, Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3)); }
    const pm = new Mesh(k.build(0.2, 1), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x3a2a4a })); pm.position.set(HEART_POS.x, 0, HEART_POS.z); pm.castShadow = true; this.group.add(pm);
    const gem = new Mesh(new OctahedronGeometry(0.75), new MeshLambertMaterial({ color: 0xff9fd8, emissive: 0xff7ac0, emissiveIntensity: 0.4, flatShading: true })); gem.scale.set(1, 1.5, 1); gem.position.set(HEART_POS.x, 2.3, HEART_POS.z);
    const halo = glowSprite(0xffb4e0, 6, 0.3); halo.position.set(HEART_POS.x, 2.3, HEART_POS.z);
    for (let i = 0; i < 2; i++) { const r = new Mesh(new TorusGeometry(1.25 + i * 0.35, 0.04, 6, 36), glowMat(0xffd0ec, 0.2)); r.position.set(HEART_POS.x, 2.3, HEART_POS.z); this.heartRings.push(r); this.group.add(r); }
    const sh = shaft(1.4, 2.6, 14, 0xffc8ea, 0.03); sh.position.set(HEART_POS.x, 7, HEART_POS.z);
    this.group.add(gem, halo, sh); return { gem, halo, shaftMesh: sh };
  }

  private buildPool(): Mesh<BufferGeometry, MeshLambertMaterial> {
    const water = new Mesh(new CircleGeometry(POOL_WATER.r, 36).rotateX(-Math.PI / 2), new MeshLambertMaterial({ color: 0x2a8fe0, emissive: 0x1c6ac0, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 })) as Mesh<BufferGeometry, MeshLambertMaterial>;
    water.position.set(POOL_WATER.x, 0.1, POOL_WATER.z); water.receiveShadow = true; this.group.add(water);
    const k = new Kit(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.add(new IcosahedronGeometry(0.42 + (i % 3) * 0.1, 0), i % 2 ? 0x5a6492 : 0x4a5482, M(POOL_WATER.x + Math.cos(a) * (POOL_WATER.r + 0.2), 0.12, POOL_WATER.z + Math.sin(a) * (POOL_WATER.r + 0.2), 0, a, 0, 1.2, 0.7, 1)); }
    const rim = new Mesh(k.build(0.3, 0.5), mat()); rim.castShadow = true; this.group.add(rim);
    for (let i = 0; i < 2; i++) { const r = new Mesh(new RingGeometry(POOL_WATER.r * 0.55, POOL_WATER.r * 0.6, 40).rotateX(-Math.PI / 2), glowMat(0xbfe8ff, 0.3)); r.position.set(POOL_WATER.x, 0.13, POOL_WATER.z); this.ripples.push(r); this.group.add(r); }
    const pg = glowSprite(0x5ab4ff, 8, 0.35); pg.position.set(POOL_WATER.x, 0.8, POOL_WATER.z); this.group.add(pg); this.pulseSprites.push({ s: pg, base: 0.35, ph: 0 });
    return water;
  }

  /** The way back: two crystal-capped pillars and a shimmering curtain at the south end of the entry landing. */
  private buildExit(): void {
    const z = HOLLOW_EXIT.z + 1.3, k = new Kit();
    for (const s of [-1, 1]) { k.cyl(0.42, 0.5, 4.2, 8, s * 2.2, 2.1, 0, 0x7a82b0).cyl(0.62, 0.62, 0.3, 8, s * 2.2, 0.15, 0, 0x6a6f98); k.add(new ConeGeometry(0.34, 0.9, 6), 0xbfe4ff, M(s * 2.2, 4.65, 0)); }
    k.box(5.2, 0.4, 0.6, 0, 4.3, 0, 0x8a90bc);
    const m = new Mesh(k.build(0.2, 1), new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a3a5a })); m.position.set(HOLLOW_EXIT.x, 0, z); m.castShadow = true;
    this.portal.position.set(HOLLOW_EXIT.x, 2.2, z); this.portalHalo.position.set(HOLLOW_EXIT.x, 2.4, z - 0.2);
    this.group.add(m, this.portal, this.portalHalo);
  }

  /** The crystal wall over the secret nook: dull, cloudy crystals that shatter when the three glowcaps are lit. */
  private buildSecretWall(): void {
    const geo = clusterGeometry(), m = new MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0x9a90c0, emissive: 0x241a44 });
    // the group scales about the middle of the wall, so it shrinks in place
    const mid = { x: SECRET_COLLIDERS.reduce((a, c) => a + c.x, 0) / 3, z: SECRET_COLLIDERS.reduce((a, c) => a + c.z, 0) / 3 };
    this.secret.position.set(mid.x, 0, mid.z);
    SECRET_COLLIDERS.forEach((c, i) => { const cl = new Mesh(geo, m); cl.position.set(c.x - mid.x, 0, c.z - mid.z); cl.scale.set(1.9, 2.4 + i * 0.3, 1.9); cl.rotation.y = i * 2; cl.castShadow = true; this.secret.add(cl); });
    const hint = glowSprite(0xa890ff, 3.6, 0.35); hint.position.set(0, 1.2, 0); this.secret.add(hint);
    this.group.add(this.secret);
  }

  private buildMotes(n: number): { points: Points; pos: Float32Array; seed: Float32Array; col: Float32Array } {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n * 3), g = new BufferGeometry();
    for (let i = 0; i < n; i++) { seed[i * 3] = Math.random() * 6.28; seed[i * 3 + 1] = 3 + Math.random() * 11; seed[i * 3 + 2] = Math.random() * 60; }
    g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('color', new BufferAttribute(col, 3));
    const points = new Points(g, new PointsMaterial({ size: 0.42, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }));
    points.frustumCulled = false; points.renderOrder = 3; this.group.add(points); return { points, pos, seed, col };
  }
  private updateMotes(t: number, hero: { x: number; z: number }): void {
    const { pos, seed, col, points } = this.motes, n = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const a = seed[i * 3] + t * 0.05 * (1 + (i % 3) * 0.4), d = seed[i * 3 + 1], ph = seed[i * 3 + 2];
      pos[i * 3] = hero.x + Math.cos(a + i) * d + Math.sin(t * 0.4 + ph) * 1.3; pos[i * 3 + 1] = 0.7 + ((i * 0.37 + t * 0.12) % 1) * 3.2; pos[i * 3 + 2] = hero.z + Math.sin(a + i) * d + Math.cos(t * 0.33 + ph) * 1.3;
      const b = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.4 + ph * 3)), tone = HUES[i % HUES.length].g;
      col[i * 3] = ((tone >> 16) & 255) / 255 * b; col[i * 3 + 1] = ((tone >> 8) & 255) / 255 * b; col[i * 3 + 2] = (tone & 255) / 255 * b;
    }
    (points.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true; (points.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
}

const _q = new Quaternion(), _up = new Vector3(0, 1, 0);
function quatY(a: number): Quaternion { return _q.clone().setFromAxisAngle(_up, a); }
