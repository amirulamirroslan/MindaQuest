/**
 * The wider woods (v2.31): every structure, landmark and interactable the world expansion adds, drawn from the data in systems/expansion.ts.
 * Static pieces are merged Kit meshes (one draw call each, frustum-culled, and whole zones are hidden when the hero is far away); the few
 * things that move or change (chests, lanterns, pickups, windmill sails, mist, the thorn barrier) are small separate objects.
 * All geometry is made in code; nothing is loaded.
 */
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, RepeatWrapping, RingGeometry, SphereGeometry,
  SRGBColorSpace, type BufferGeometry, type Sprite,
} from 'three';
import {
  ACORN_SPOTS, BARN, CHEST_SPOTS, FARM_HOUSES, HEARTWOOD_TREE, LANTERN_SPOTS, MIRROR_OBELISK, MIST_GATE, MOON_CIRCLE, moonGap, PASSES, PEARL_SPOTS, PEOPLE, PUMPKIN_SPOTS, SIGN_SPOTS, TABLET_SPOTS, THORNS,
  WATCHTOWER, WELL2, WINDMILL,
} from '../systems/expansion';
import { MIRROR } from '../systems/expansionShape';
import { heightAt } from '../systems/worldShape';
import type { WildsState, Who } from '../systems/wildsQuest';
import { Kit, M, houseGeometry } from './env/Structures';
import { ancientTree } from './env/treeGen';
import { addWorldOutline } from './env/worldOutline';
import { glowSprite } from './common';
import { withPaint } from './stylize';
import { ShoreNpc } from './ShoreViews';

const STONE = 0xa7a69a, STONE_D = 0x7d7a70, MOSS = 0x6f8f4a, WOOD = 0x7a5230, WOOD_L = 0xa87a48, ROOF = 0xc8573b, HAY = 0xe3c25a, RED = 0xb8443a;
const mat = (): MeshLambertMaterial => withPaint(new MeshLambertMaterial({ vertexColors: true }));
const CULL = 120;

interface Zone { g: Group; x: number; z: number }
interface Pickup { root: Group; glow: Sprite; x: number; z: number; y: number; phase: number }

export class WildsWorld {
  readonly group = new Group();
  readonly npcs: Record<Who, ShoreNpc>;
  private readonly material = mat();
  private readonly zones: Zone[] = [];
  private readonly glows: { sprite: Sprite; day: number; night: number }[] = [];
  private readonly chests: { root: Group; lid: Group; glow: Sprite; open: number; target: number }[] = [];
  private readonly lanterns: { glow: Sprite; flame: Mesh; on: number; target: number }[] = [];
  private readonly acorns: Pickup[] = []; private readonly pumpkins: Pickup[] = []; private readonly pearls: Pickup[] = [];
  private readonly runeMats: MeshBasicMaterial[] = [];
  private readonly mist: { s: Sprite; x: number; z: number; ph: number }[] = [];
  private sails!: Group; private thorns!: Group; private water!: Mesh; private waterTex!: CanvasTexture;
  private night = 0;

  constructor(parent: Group) {
    parent.add(this.group); this.group.name = 'wilds';
    this.npcs = { tani: new ShoreNpc('tani'), lumut: new ShoreNpc('lumut'), din: new ShoreNpc('din') };
    this.buildFarm(); this.buildLookout(); this.buildMirror(); this.buildCave(); this.buildGrove(); this.buildHeartwood(); this.buildOldSteps(); this.buildMoonCircle(); this.buildMistGate(); this.buildThickets();
    this.buildPasses(); this.buildSigns(); this.buildChests();
    for (const id of ['tani', 'lumut', 'din'] as Who[]) {
      const p = PEOPLE.find(q => q.id === id)!, npc = this.npcs[id];
      npc.root.position.set(p.at.x, heightAt(p.at.x, p.at.z) + 0.02, p.at.z); npc.root.rotation.y = p.facing;
      this.zoneOf(p.at.x, p.at.z, 8).g.add(npc.root);
    }
  }

  // ---------------------------------------------------------------------------------------------- helpers
  private zoneOf(x: number, z: number, _r = 10): Zone { const zn: Zone = { g: new Group(), x, z }; this.group.add(zn.g); this.zones.push(zn); return zn; }
  private mesh(g: BufferGeometry, x: number, z: number, ry = 0, outline = false, y?: number): Mesh {
    const m = new Mesh(g, this.material); m.position.set(x, y ?? heightAt(x, z), z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; if (outline) addWorldOutline(m); return m;
  }
  private glow(parent: Group, color: number, size: number, x: number, y: number, z: number, day: number, night: number): Sprite {
    const s = glowSprite(color, size, day); s.position.set(x, y, z); parent.add(s); this.glows.push({ sprite: s, day, night }); return s;
  }
  private rune(parent: Group, w: number, h: number, x: number, y: number, z: number, ry = 0, color = 0x9fe8ff): void {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false }); this.runeMats.push(m);
    const p = new Mesh(new RingGeometry(Math.min(w, h) * 0.22, Math.min(w, h) * 0.34, 6), m); p.position.set(x, y, z); p.rotation.y = ry; parent.add(p);
  }

  // ---------------------------------------------------------------------------------------------- Hearthfield (the lower village)
  private buildFarm(): void {
    const zn = this.zoneOf(0, 76), g = zn.g;
    FARM_HOUSES.forEach((h, i) => { const hm = this.mesh(houseGeometry(i + 1), h.x, h.z, h.rot, true); g.add(hm); this.glow(g, 0xffd98a, 1.5, h.x + Math.sin(h.rot) * 0.4, heightAt(h.x, h.z) + 1.4, h.z + Math.cos(h.rot) * 1.7, 0, 0.5); });
    // the barn: a big red box with a pitched roof and a hay loft door
    { const k = new Kit(); k.box(5.2, 0.4, 4.2, 0, 0.2, 0, STONE_D); k.box(5, 2.6, 4, 0, 1.7, 0, RED); k.box(5.1, 0.12, 4.1, 0, 3.05, 0, WOOD);
      k.add(new CylinderGeometry(0.01, 3.1, 1.9, 3), 0x7a3a2a, M(0, 3.9, 0, 0, Math.PI / 2, Math.PI / 2, 1, 1.35, 1)); k.box(1.8, 1.9, 0.12, 0, 1.35, 2.04, WOOD); k.box(1.1, 0.9, 0.12, 0, 3.0, 2.04, WOOD_L);
      for (const s of [-1, 1]) k.box(0.14, 2.6, 0.14, s * 1.0, 1.35, 2.1, 0xf0e2bc);
      g.add(this.mesh(k.build(0.25, 1.4), BARN.x, BARN.z, BARN.rot, true)); }
    // haystacks, a scarecrow, fences round the fields, the well
    { const k = new Kit(); for (const [x, z, s] of [[-12, 76, 1], [-13.5, 77.5, 0.8], [15, 80, 1.1]] as const) { k.cyl(0.9 * s, 1.1 * s, 1.1 * s, 8, x, 0.55 * s, z, HAY); k.add(new ConeGeometry(1.0 * s, 0.9 * s, 8), HAY, M(x, 1.5 * s, z)); }
      g.add(this.mesh(k.build(0.2, 1.2), 0, 0, 0, false, 0)); void 0; }
    { const sx = -12, sz = 92, y = heightAt(sx, sz), k = new Kit(); k.cyl(0.05, 0.06, 1.6, 5, 0, 0.8, 0, WOOD); k.box(1.4, 0.07, 0.07, 0, 1.25, 0, WOOD); k.ball(0.17, 0, 1.78, 0, 0xe8c070, 1, 1, 1, 1); k.cyl(0.3, 0.3, 0.05, 8, 0, 1.92, 0, 0x7a5230); k.cyl(0.14, 0.18, 0.2, 8, 0, 2.02, 0, 0x7a5230); k.box(0.5, 0.5, 0.2, 0, 1.4, 0, 0x4a7aa8); g.add(this.mesh(k.build(0.1, 1), sx, sz, 0.4, false, y)); }
    { const k = new Kit(); for (const f of [{ x: -9, z: 90, w: 10, d: 7 }, { x: 10, z: 92, w: 9, d: 6 }]) for (const sgn of [-1, 1]) { for (let i = -f.w / 2; i <= f.w / 2; i += 1.6) { k.box(0.1, 0.8, 0.1, f.x + i, 0.4, f.z + sgn * (f.d / 2 + 0.7), WOOD_L); } k.box(f.w + 0.2, 0.07, 0.07, f.x, 0.6, f.z + sgn * (f.d / 2 + 0.7), WOOD_L); }
      g.add(this.mesh(k.build(0.1, 1), 0, 0, 0, false, 0.0)); }
    { const k = new Kit(); k.cyl(1.0, 1.1, 0.7, 10, 0, 0.35, 0, STONE); k.cyl(0.7, 0.7, 0.05, 10, 0, 0.72, 0, 0x4a9ad0); k.box(0.1, 1.7, 0.1, -0.95, 1.2, 0, WOOD); k.box(0.1, 1.7, 0.1, 0.95, 1.2, 0, WOOD); k.add(new ConeGeometry(1.5, 0.7, 4), ROOF, M(0, 2.3, 0, 0, Math.PI / 4, 0)); g.add(this.mesh(k.build(0.2, 1), WELL2.x, WELL2.z, 0, true)); }
    // the windmill: a tapering stone tower, a shingled cap, four sails that turn
    { const k = new Kit(); k.cyl(1.5, 2.1, 6.4, 8, 0, 3.2, 0, 0xe9dcc0); k.cyl(1.6, 1.5, 0.3, 8, 0, 6.5, 0, STONE_D); k.add(new ConeGeometry(1.9, 2.4, 8), ROOF, M(0, 7.9, 0)); k.box(0.9, 1.5, 0.12, 0, 1.0, 2.0, WOOD); k.box(0.7, 0.7, 0.1, 0, 4.4, 1.55, 0x4a7aa8);
      const body = this.mesh(k.build(0.25, 2), WINDMILL.x, WINDMILL.z, 0, true); g.add(body);
      this.sails = new Group(); this.sails.position.set(WINDMILL.x, heightAt(WINDMILL.x, WINDMILL.z) + 6.9, WINDMILL.z + 1.7);
      const sk = new Kit(); sk.cyl(0.18, 0.18, 0.5, 6, 0, 0, 0, WOOD); sk.add(new CylinderGeometry(0.01, 0.01, 0.01, 3), WOOD);
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; sk.box(0.14, 4.6, 0.1, Math.sin(a) * 2.4, Math.cos(a) * 2.4, 0, WOOD, 0, -a); sk.box(0.9, 3.0, 0.05, Math.sin(a) * 2.6 + Math.cos(a) * 0.5, Math.cos(a) * 2.6 - Math.sin(a) * 0.5, 0.03, 0xf4efe0, 0, -a); }
      const sm = new Mesh(sk.build(0, 1), this.material); sm.castShadow = true; this.sails.add(sm); g.add(this.sails);
      this.glow(g, 0xfff0b0, 6, WINDMILL.x, heightAt(WINDMILL.x, WINDMILL.z) + 10.2, WINDMILL.z, 0.12, 0.4); }
    // a signboard-style market stall by the well
    { const k = new Kit(); k.box(2.2, 0.1, 1.2, 0, 0.9, 0, WOOD_L); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.05, 0.05, 0.9, 5, sx * 1.0, 0.45, sz * 0.5, WOOD);
      k.add(new BoxGeometry(2.5, 0.08, 1.5), 0xe3a23a, M(0, 2.0, 0, 0.2, 0, 0)); for (const sx of [-1, 1]) k.cyl(0.05, 0.05, 1.1, 5, sx * 1.1, 1.45, -0.6, WOOD);
      for (const [x, c] of [[-0.6, 0xe0732a], [0, 0xd8483a], [0.6, 0x7fc24a]] as const) k.ball(0.22, x, 1.12, 0, c, 1, 0.9, 1, 1);
      g.add(this.mesh(k.build(0.1, 1), 5, 71, -0.5, false)); }
  }

  // ---------------------------------------------------------------------------------------------- Lookout Hill
  private buildLookout(): void {
    const zn = this.zoneOf(WATCHTOWER.x, WATCHTOWER.z), g = zn.g, k = new Kit();
    k.cyl(2.0, 2.4, 0.5, 8, 0, 0.25, 0, STONE_D); k.cyl(1.5, 1.9, 6.5, 8, 0, 3.7, 0, STONE); for (let y = 1.2; y < 6.5; y += 1.3) k.box(3.4, 0.1, 0.1, 0, y, 1.8, STONE_D);
    k.cyl(2.0, 1.6, 0.4, 8, 0, 7.1, 0, WOOD_L); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.box(0.18, 0.7, 0.18, Math.sin(a) * 1.9, 7.6, Math.cos(a) * 1.9, WOOD); }
    k.add(new ConeGeometry(2.3, 1.6, 8), 0x3f84a0, M(0, 8.9, 0)); k.box(0.9, 1.4, 0.1, 0, 1.2, 1.9, WOOD); k.cyl(0.04, 0.04, 1.6, 4, 0, 10.2, 0, WOOD); k.box(0.9, 0.5, 0.04, 0.45, 10.3, 0, 0xe0573f);
    g.add(this.mesh(k.build(0.25, 2.2), WATCHTOWER.x, WATCHTOWER.z, 0, true));
    this.glow(g, 0xffe9a0, 7, WATCHTOWER.x, heightAt(WATCHTOWER.x, WATCHTOWER.z) + 8.0, WATCHTOWER.z, 0.14, 0.7);
  }

  // ---------------------------------------------------------------------------------------------- Mirror Pond
  private buildMirror(): void {
    const zn = this.zoneOf(MIRROR.x, MIRROR.z), g = zn.g;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
    x.fillStyle = '#4f9fcf'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,255,255,${0.1 + ((i * 37) % 25) / 100})`; x.lineWidth = 1 + (i % 3) * 0.6; x.beginPath(); x.ellipse((i * 53) % 128, (i * 29) % 128, 4 + (i % 9), 2 + (i % 4), 0, 0, Math.PI * 2); x.stroke(); }
    this.waterTex = new CanvasTexture(c); this.waterTex.wrapS = this.waterTex.wrapT = RepeatWrapping; this.waterTex.repeat.set(5, 5); this.waterTex.colorSpace = SRGBColorSpace;
    const geo = new CircleGeometry(MIRROR.r + 0.6, 56); geo.rotateX(-Math.PI / 2);
    this.water = new Mesh(geo, new MeshBasicMaterial({ map: this.waterTex, transparent: true, opacity: 0.88 })); this.water.position.set(MIRROR.x, -0.16, MIRROR.z); this.water.renderOrder = 1; g.add(this.water);
    // the island's obelisk and the stepping stones from the west bank
    { const k = new Kit(); k.cyl(1.3, 1.6, 0.4, 8, 0, 0.2, 0, STONE_D); k.add(new CylinderGeometry(0.25, 0.55, 3.4, 4), STONE, M(0, 2.1, 0, 0, Math.PI / 4, 0)); k.add(new ConeGeometry(0.28, 0.6, 4), 0x9fe8ff, M(0, 4.1, 0, 0, Math.PI / 4, 0));
      g.add(this.mesh(k.build(0.25, 1.6), MIRROR_OBELISK.x, MIRROR_OBELISK.z, 0, true, 0.0)); this.glow(g, 0x9fe8ff, 3.4, MIRROR_OBELISK.x, 4.0, MIRROR_OBELISK.z, 0.3, 0.8); }
    { const k = new Kit(); for (let i = 0; i < 7; i++) { const sx = MIRROR.x - MIRROR.r + 0.5 + i * ((MIRROR.r - 3.4) / 6.2), sz = MIRROR.z + Math.sin(i * 1.7) * 0.5; k.cyl(0.5, 0.55, 0.28, 7, sx, -0.12, sz, STONE); }
      for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 4.5 + (i % 4) * 1.4; k.add(new CircleGeometry(0.4 + (i % 3) * 0.12, 9), 0x5fb04a, M(MIRROR.x + Math.cos(a) * r, -0.14, MIRROR.z + Math.sin(a) * r, -Math.PI / 2)); }
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; if (Math.abs(a - Math.PI) < 0.5) continue; const r = MIRROR.r + 0.1 + (i % 3) * 0.3; k.cyl(0.03, 0.04, 1.1 + (i % 4) * 0.2, 4, MIRROR.x + Math.cos(a) * r, 0.3, MIRROR.z + Math.sin(a) * r, 0x6f8a3a); k.ball(0.09, MIRROR.x + Math.cos(a) * r, 1.0 + (i % 4) * 0.2, MIRROR.z + Math.sin(a) * r, 0x7a4a2a, 1, 2, 1, 0); }
      g.add(this.mesh(k.build(0, 1), 0, 0, 0, false, 0)); }
    { const k = new Kit(); k.box(0.2, 1.6, 0.2, 0, 0.8, 0, WOOD); k.box(1.5, 0.08, 0.12, 0, 1.5, 0, WOOD_L); for (let i = 0; i < 3; i++) k.cyl(0.02, 0.02, 0.6, 3, -0.5 + i * 0.5, 1.15, 0, 0xe8e4dc); g.add(this.mesh(k.build(0.1, 1), PEOPLE[2].at.x + 1.8, PEOPLE[2].at.z - 1.4, 0.4)); }   // Pak Din's drying rack
  }

  // ---------------------------------------------------------------------------------------------- Whisper Cave
  private buildCave(): void {
    const zn = this.zoneOf(-70, -48), g = zn.g, k = new Kit();
    for (const [x, z, s] of [[-78, -48, 5], [-76, -53, 4.2], [-76, -43, 4.2], [-72, -55, 3.6], [-72, -41, 3.6]] as const) k.ball(1, x, 1.6, z, 0x6d6a76, s, s * 0.78, s, 2);
    for (const [x, z, c] of [[-74, -50, 0x7ff0d0], [-74, -46, 0xc59bff], [-71, -52, 0x7ff0d0], [-71, -44, 0x9fe8ff]] as const) { k.add(new ConeGeometry(0.25, 1.2, 5), c, M(x, 0.6, z, 0, 0, 0.12)); k.add(new ConeGeometry(0.16, 0.8, 5), c, M(x + 0.35, 0.4, z + 0.2, 0.2, 0, -0.2)); this.glow(g, c, 2.6, x, 0.9 + heightAt(x, z), z, 0.35, 0.9); }
    g.add(this.mesh(k.build(0.3, 3), 0, 0, 0, false, 0));
    const dark = new Mesh(new CircleGeometry(4.6, 24), new MeshBasicMaterial({ color: 0x1a1830, transparent: true, opacity: 0.32, depthWrite: false })); dark.rotation.x = -Math.PI / 2; dark.position.set(-71, heightAt(-71, -48) + 0.04, -48); g.add(dark);
  }

  // ---------------------------------------------------------------------------------------------- Hidden Grove
  private buildGrove(): void {
    const zn = this.zoneOf(-52, -56), g = zn.g, k = new Kit(), cx = -52, cz = -56;
    // a blossom arch where the fern trail enters, a stone bench and a ring of glowing flowers
    for (const s of [-1, 1]) { k.cyl(0.14, 0.18, 3, 6, cx + 5.2 * 0 + s * 1.5, 1.5, cz + 5.5, WOOD); }
    k.add(new CylinderGeometry(1.5, 1.5, 0.2, 10, 1, true, 0, Math.PI), 0xf6a8cc, M(cx, 3.0, cz + 5.5, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1)); for (let i = 0; i < 14; i++) { const a = (i / 13) * Math.PI; k.ball(0.22, cx + Math.cos(a) * 1.5, 3.0 + Math.sin(a) * 1.5, cz + 5.5, i % 2 ? 0xffc2dc : 0xf6a8cc, 1, 1, 1, 1); }
    k.box(2.4, 0.2, 0.7, cx + 3.5, 0.55, cz - 1, STONE); k.box(0.2, 0.5, 0.6, cx + 2.5, 0.25, cz - 1, STONE_D); k.box(0.2, 0.5, 0.6, cx + 4.5, 0.25, cz - 1, STONE_D);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = 3.6, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; k.cyl(0.03, 0.04, 0.6, 4, x, 0.3, z, 0x4f9a4a); k.ball(0.16, x, 0.66, z, 0xbfa8ff, 1, 0.7, 1, 1); if (i % 3 === 0) this.glow(g, 0xd9c2ff, 1.8, x, heightAt(x, z) + 0.8, z, 0.25, 0.7); }
    g.add(this.mesh(k.build(0.15, 1.2), 0, 0, 0, false, 0));
  }

  // ---------------------------------------------------------------------------------------------- the Heartwood and the thickets
  private buildHeartwood(): void {
    const zn = this.zoneOf(HEARTWOOD_TREE.x, HEARTWOOD_TREE.z), g = zn.g;
    const tree = new Mesh(ancientTree(), withPaint(new MeshLambertMaterial({ vertexColors: true, emissive: 0x153a22 }))); tree.position.set(HEARTWOOD_TREE.x, heightAt(HEARTWOOD_TREE.x, HEARTWOOD_TREE.z), HEARTWOOD_TREE.z); tree.scale.setScalar(1.35); tree.rotation.y = 1.1; tree.castShadow = true; tree.receiveShadow = true; g.add(tree);
    const y = heightAt(HEARTWOOD_TREE.x, HEARTWOOD_TREE.z);
    for (const [dx, dy, dz, c, s] of [[0, 13, 0, 0x7ff0d0, 22], [4.5, 12, 2.5, 0xffe9a0, 14], [-4.5, 11, -2, 0x7ff0d0, 14]] as const) this.glow(g, c, s, HEARTWOOD_TREE.x + dx, y + dy, HEARTWOOD_TREE.z + dz, 0.2, 0.5);
    { const k = new Kit(); k.add(new CylinderGeometry(0.55, 0.55, 2.4, 9), 0x6a4a2c, M(0, 0.5, 0, 0, 0, Math.PI / 2)); k.add(new CircleGeometry(0.5, 9), 0x1d140c, M(1.21, 0.5, 0, 0, Math.PI / 2, 0)); k.ball(0.35, -1.0, 0.95, 0.2, 0x4f9a4a, 1.2, 0.6, 1, 1);
      g.add(this.mesh(k.build(0.2, 1), HEARTWOOD_TREE.x - 2.0, HEARTWOOD_TREE.z + 4.5, 0.9)); }   // the hollow log beside the tree
  }
  private buildThickets(): void {
    // the thorn barrier of the shortcut, and Kak Lumut's camp (a log seat and a little fire)
    const zn = this.zoneOf(THORNS.x, THORNS.z), g = zn.g; this.thorns = new Group(); g.add(this.thorns);
    const k = new Kit();
    for (let i = 0; i < 14; i++) { const z = THORNS.z - 3.2 + i * 0.5, x = THORNS.x + Math.sin(i * 2.1) * 0.5; k.ball(0.55, x, 0.7 + (i % 3) * 0.25, z, i % 2 ? 0x2f5a2c : 0x3d6a32, 1, 1, 1, 1); for (let j = 0; j < 3; j++) k.add(new ConeGeometry(0.06, 0.6, 4), 0x5a3a2a, M(x + Math.sin(i + j) * 0.3, 1.0 + j * 0.2, z + Math.cos(i * j) * 0.3, Math.sin(i + j) * 1.2, 0, Math.cos(i - j) * 1.2)); }
    for (let i = 0; i < 6; i++) k.ball(0.14, THORNS.x + Math.sin(i * 1.9) * 0.6, 1.1 + (i % 3) * 0.2, THORNS.z - 2.6 + i * 1.0, 0xd8483a, 1, 1, 1, 0);
    this.thorns.add(this.mesh(k.build(0.2, 1.5), 0, 0, 0, false, 0));
    const c = this.zoneOf(-58, 9).g, ck = new Kit(); ck.cyl(0.35, 0.35, 1.6, 7, 0, 0.35, 0, 0x6a4a2c); ck.add(new CylinderGeometry(0.35, 0.35, 1.6, 7), 0x6a4a2c, M(2.2, 0.35, 1.6, 0, 0.4, Math.PI / 2));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ck.ball(0.16, Math.cos(a) * 0.5, 0.15, 1.6 + Math.sin(a) * 0.5 - 1.6 + 0.6, 0x7a7870, 1, 0.8, 1, 1); }
    c.add(this.mesh(ck.build(0.1, 1), -60.6, 11, 0)); this.glow(c, 0xffa844, 2.4, -60.6, heightAt(-60.6, 11) + 0.5, 11.6, 0.4, 0.9);
  }

  // ---------------------------------------------------------------------------------------------- the Old Steps
  private buildOldSteps(): void {
    const zn = this.zoneOf(0, -78), g = zn.g, k = new Kit();
    for (let i = 0; i < 4; i++) k.box(11 - i * 0.6, 0.22, 1.6, 0, 0.11 + i * 0.0, -66 - i * 1.5, i % 2 ? STONE : 0x9fa196);   // broad low steps leading in
    for (const sx of [-5.5, 5.5]) for (let i = 0; i < 6; i++) { const z = -68 - i * 4.2, broken = (i * 7 + (sx > 0 ? 3 : 0)) % 5 === 0, h = broken ? 1.2 + (i % 3) * 0.5 : 4.2;
      k.cyl(0.5, 0.62, h, 8, sx, h / 2, z, STONE); k.cyl(0.7, 0.7, 0.2, 8, sx, 0.1, z, STONE_D); if (!broken) k.box(1.5, 0.3, 1.5, sx, h + 0.15, z, STONE_D); else k.ball(0.28, sx + 0.9, 0.25, z + 0.4, STONE, 1, 0.6, 1, 1); }
    // the Moon Dial: a stone disc with a gnomon in the middle of the court
    k.cyl(3.0, 3.2, 0.3, 14, 0, 0.15, -78, STONE_D); k.cyl(2.6, 2.6, 0.06, 14, 0, 0.33, -78, 0xb8b6aa); k.box(0.12, 1.5, 0.5, 0, 1.0, -78, STONE, 0, 0, 0.5);
    // the vault: a low walled alcove in the north-west corner that holds a chest, and the sealed door at the far end
    for (const [x, z, w, d] of [[-9.5, -88, 6, 0.7], [-12.5, -85.5, 0.7, 5], [-3.2, -86.5, 0.7, 3.4]] as const) k.box(w, 1.3, d, x, 0.65, z, STONE);
    k.box(2.0, 4.4, 0.8, -3.5, 2.2, -92.6, STONE_D); k.box(2.0, 4.4, 0.8, 3.5, 2.2, -92.6, STONE_D); k.box(9.4, 0.9, 1.0, 0, 4.8, -92.6, STONE); k.box(5.0, 3.6, 0.5, 0, 1.8, -92.6, 0x575a63);
    for (const sx of [-1, 1]) k.cyl(0.5, 0.6, 5, 8, sx * 4.9, 2.5, -92.6, STONE);
    g.add(this.mesh(k.build(0.25, 3), 0, 0, 0, false, 0));
    this.rune(g, 4, 4, 0, 3.5 + 0 * heightAt(0, -92), -92.3, 0, 0x9fe8ff); this.glow(g, 0x9fe8ff, 4.6, 0, 2.6, -91.6, 0.22, 0.6);
    this.glow(g, 0xbfe4ff, 5.2, 0, 1.2, -78, 0.2, 0.6);
    // tablets: three leaning slabs, each with a glowing mark
    TABLET_SPOTS.forEach((p, i) => { const tk = new Kit(); tk.add(new BoxGeometry(0.9, 1.5, 0.22), 0x8d8f96, M(0, 0.75, 0, -0.08, 0, 0.04 * (i - 1))); tk.box(1.3, 0.2, 0.7, 0, 0.1, 0, STONE_D); g.add(this.mesh(tk.build(0.2, 1), p.x, p.z, (i - 1) * 0.3, true)); this.rune(g, 0.9, 0.9, p.x, heightAt(p.x, p.z) + 0.95, p.z + 0.14, 0, 0xbfeaff); });
  }

  private buildMoonCircle(): void {
    const zn = this.zoneOf(MOON_CIRCLE.x, MOON_CIRCLE.z), g = zn.g, k = new Kit();
    for (let i = 0; i < MOON_CIRCLE.stones; i++) {
      const a = (i / MOON_CIRCLE.stones) * Math.PI * 2 + 0.45, x = MOON_CIRCLE.x + Math.cos(a) * MOON_CIRCLE.r, z = MOON_CIRCLE.z + Math.sin(a) * MOON_CIRCLE.r;
      if (moonGap(x, z)) continue;
      const sk = new Kit(); sk.add(new CylinderGeometry(0.45, 0.8, 3.6 + (i % 3) * 0.5, 5), i % 2 ? 0x9a9aa2 : 0x8d8f96, M(0, 1.9, 0, 0.04, i, 0.05)); sk.add(new ConeGeometry(0.46, 0.5, 5), MOSS, M(0, 3.8 + (i % 3) * 0.5, 0)); g.add(this.mesh(sk.build(0.25, 1.4), x, z, i * 0.7, true));
      this.rune(g, 1, 1, x, heightAt(x, z) + 1.6, z, -a + Math.PI / 2, 0xbfeaff);
    }
    k.cyl(1.1, 1.3, 0.5, 8, 0, 0.25, 0, STONE_D); k.cyl(0.7, 0.8, 0.3, 8, 0, 0.65, 0, STONE);
    g.add(this.mesh(k.build(0.25, 1), MOON_CIRCLE.x, MOON_CIRCLE.z, 0, false)); this.glow(g, 0xbfe4ff, 5.5, MOON_CIRCLE.x, heightAt(MOON_CIRCLE.x, MOON_CIRCLE.z) + 1.3, MOON_CIRCLE.z, 0.25, 0.75);
  }

  private buildMistGate(): void {
    const zn = this.zoneOf(MIST_GATE.x, MIST_GATE.z), g = zn.g, k = new Kit();
    const l = Math.hypot(MIST_GATE.x, MIST_GATE.z), ox = MIST_GATE.x / l, oz = MIST_GATE.z / l, tx = -oz, tz = ox, rot = Math.atan2(tx, tz);
    for (const s of [-1, 1]) { k.cyl(0.8, 1.0, 6.2, 8, s * 2.7, 3.1, 0, STONE); k.cyl(1.0, 1.0, 0.3, 8, s * 2.7, 6.3, 0, STONE_D); }
    k.add(new CylinderGeometry(2.7, 2.7, 0.9, 12, 1, false, 0, Math.PI), STONE, M(0, 6.3, 0, Math.PI / 2, Math.PI, 0, 1, 1, 1)); k.box(7.2, 0.7, 1.1, 0, 7.0, 0, STONE_D);
    k.ball(0.35, 0, 7.8, 0, 0x9fe8ff, 1, 1.4, 1, 1);
    g.add(this.mesh(k.build(0.25, 3), MIST_GATE.x, MIST_GATE.z, rot, true));
    this.glow(g, 0xbfe4ff, 9, MIST_GATE.x, heightAt(MIST_GATE.x, MIST_GATE.z) + 7.8, MIST_GATE.z, 0.3, 0.7);
    // a wall of drifting mist behind the gate
    for (let i = 0; i < 16; i++) { const s = (i - 7.5) * 2.2, x = MIST_GATE.x + ox * 3.8 + tx * s, z = MIST_GATE.z + oz * 3.8 + tz * s; const sp = glowSprite(0xe8f2f6, 7.5, 0.5); sp.position.set(x, heightAt(x, z) + 2.4 + (i % 3) * 0.8, z); g.add(sp); this.mist.push({ s: sp, x, z, ph: i * 0.9 }); }
  }

  // ---------------------------------------------------------------------------------------------- passes and signs
  private buildPasses(): void {
    for (const p of PASSES) {
      const zn = this.zoneOf(p.at.x, p.at.z), g = zn.g, k = new Kit(), s = 2.6;
      for (const sd of [-1, 1]) { k.cyl(0.32, 0.42, 3.4, 6, sd * s, 1.7, 0, STONE); k.cyl(0.42, 0.42, 0.2, 6, sd * s, 0.1, 0, STONE_D); k.ball(0.28, sd * s, 3.55, 0, MOSS, 1, 0.6, 1, 1); }
      k.box(2 * s + 0.9, 0.34, 0.5, 0, 3.55, 0, WOOD); k.cyl(0.02, 0.02, 0.5, 3, 0, 3.2, 0, 0x3a2a1a); k.box(0.34, 0.44, 0.34, 0, 2.85, 0, 0xffd878);
      const m = this.mesh(k.build(0.2, 2), p.at.x, p.at.z, p.facing + Math.PI / 2, true); g.add(m);
      this.glow(g, 0xffd878, 2.2, p.at.x, heightAt(p.at.x, p.at.z) + 2.85, p.at.z, 0.25, 0.85);
    }
  }
  private buildSigns(): void {
    const g = this.zoneOf(0, 0).g; g.userData.always = true;
    for (const s of SIGN_SPOTS) { const k = new Kit(); k.cyl(0.07, 0.09, 1.7, 5, 0, 0.85, 0, WOOD); k.box(1.0, 0.36, 0.08, 0.1, 1.45, 0.06, WOOD_L); k.add(new ConeGeometry(0.2, 0.3, 3), WOOD_L, M(0.7, 1.45, 0.06, 0, 0, -Math.PI / 2)); k.box(0.7, 0.05, 0.02, 0.05, 1.45, 0.11, 0x4a3a2a); g.add(this.mesh(k.build(0.15, 1), s.x, s.z, 0.3 + (s.x * 0.1) % 1)); }
  }

  // ---------------------------------------------------------------------------------------------- chests and pickups
  private buildChests(): void {
    const g = this.group;
    for (const c of CHEST_SPOTS) {
      const root = new Group(); root.position.set(c.x, heightAt(c.x, c.z), c.z); root.rotation.y = Math.atan2(-c.x, -c.z) * 0 + Math.PI;
      const base = new Kit(); base.box(1.1, 0.55, 0.7, 0, 0.28, 0, 0x8a5a2e); base.box(1.14, 0.1, 0.74, 0, 0.55, 0, 0xd9b04a); base.box(0.12, 0.5, 0.76, -0.4, 0.28, 0, 0xd9b04a); base.box(0.12, 0.5, 0.76, 0.4, 0.28, 0, 0xd9b04a);
      const bm = new Mesh(base.build(0.2, 0.6), this.material); bm.castShadow = true; root.add(bm);
      const lid = new Group(); lid.position.set(0, 0.6, -0.35); const lk = new Kit(); lk.add(new CylinderGeometry(0.38, 0.38, 1.1, 10, 1, false, 0, Math.PI), 0x9a6a36, M(0, 0, 0.35, 0, 0, Math.PI / 2, 1, 1, 0.93)); lk.box(0.14, 0.1, 0.06, 0, 0.0, 0.74, 0xd9b04a);
      const lm = new Mesh(lk.build(0, 1), this.material); lm.castShadow = true; lid.add(lm); root.add(lid);
      const glow = glowSprite(0xffe08a, 2.8, 0.5); glow.position.set(0, 0.8, 0); root.add(glow);
      g.add(root); this.chests.push({ root, lid, glow, open: 0, target: 0 });
    }
    LANTERN_SPOTS.forEach(p => {
      const root = new Group(); root.position.set(p.x, heightAt(p.x, p.z), p.z); const k = new Kit(); k.cyl(0.4, 0.5, 0.35, 6, 0, 0.17, 0, STONE_D); k.cyl(0.22, 0.28, 0.9, 6, 0, 0.8, 0, STONE); k.box(0.6, 0.12, 0.6, 0, 1.3, 0, STONE_D); k.box(0.1, 0.5, 0.1, -0.26, 1.6, -0.26, STONE_D); k.box(0.1, 0.5, 0.1, 0.26, 1.6, 0.26, STONE_D); k.box(0.1, 0.5, 0.1, -0.26, 1.6, 0.26, STONE_D); k.box(0.1, 0.5, 0.1, 0.26, 1.6, -0.26, STONE_D); k.add(new ConeGeometry(0.5, 0.4, 4), STONE, M(0, 2.05, 0, 0, Math.PI / 4, 0));
      const bm = new Mesh(k.build(0.2, 1), this.material); bm.castShadow = true; root.add(bm);
      const flame = new Mesh(new SphereGeometry(0.2, 8, 6), new MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0 })); flame.position.y = 1.6; root.add(flame);
      const glow = glowSprite(0x9fe8ff, 3.4, 0); glow.position.y = 1.6; root.add(glow); g.add(root); this.lanterns.push({ glow, flame, on: 0, target: 0 });
    });
    const mk = (spots: readonly { x: number; z: number }[], out: Pickup[], build: () => Group, color: number, size: number): void => {
      spots.forEach(p => { const root = build(), y = heightAt(p.x, p.z); root.position.set(p.x, y + 0.5, p.z); const glow = glowSprite(color, size, 0.55); glow.position.y = 0.1; root.add(glow); g.add(root); out.push({ root, glow, x: p.x, z: p.z, y: y + 0.5, phase: p.x * 0.7 + p.z }); });
    };
    mk(ACORN_SPOTS, this.acorns, () => { const r = new Group(), k = new Kit(); k.ball(0.17, 0, 0, 0, 0xe0a83a, 1, 1.2, 1, 1); k.add(new ConeGeometry(0.19, 0.18, 7), 0x7a4a22, M(0, 0.17, 0)); k.cyl(0.02, 0.02, 0.12, 4, 0, 0.3, 0, 0x5a3a1a); const m = new Mesh(k.build(0, 1), new MeshBasicMaterial({ vertexColors: true })); r.add(m); return r; }, 0xffd860, 1.5);
    mk(PUMPKIN_SPOTS, this.pumpkins, () => { const r = new Group(), k = new Kit(); k.ball(0.38, 0, 0, 0, 0xf0902a, 1.2, 0.95, 1.2, 1); k.cyl(0.05, 0.07, 0.22, 5, 0, 0.4, 0, 0x4a7a2a); const m = new Mesh(k.build(0, 1), new MeshBasicMaterial({ vertexColors: true })); r.add(m); return r; }, 0xffb040, 2.2);
    mk(PEARL_SPOTS, this.pearls, () => { const r = new Group(), k = new Kit(); k.ball(0.22, 0, 0, 0, 0xeef8ff, 1, 1, 1, 2); k.cyl(0.34, 0.3, 0.1, 8, 0, -0.2, 0, 0xc9b8a0); const m = new Mesh(k.build(0, 1), new MeshBasicMaterial({ vertexColors: true })); r.add(m); return r; }, 0x9fe8ff, 1.9);
  }

  // ---------------------------------------------------------------------------------------------- state and per-frame
  /** Shows the saved state: opened chests, collected pickups, lit lanterns, the thorn barrier. */
  setState(s: WildsState, animate = false): void {
    s.chests.forEach(i => this.setChest(i, true, animate));
    this.acorns.forEach((p, i) => { p.root.visible = !s.acorns.includes(i); }); this.pumpkins.forEach((p, i) => { p.root.visible = !s.pumpkins.includes(i); }); this.pearls.forEach((p, i) => { p.root.visible = !s.pearls.includes(i); });
    this.lanterns.forEach((l, i) => { l.target = s.lanterns.includes(i) ? 1 : 0; if (!animate) l.on = l.target; });
    this.thorns.visible = s.lumut < 2;
  }
  setChest(i: number, open: boolean, animate = true): void { const c = this.chests[i]; if (!c) return; c.target = open ? 1 : 0; if (!animate) c.open = c.target; }
  collect(kind: 'acorn' | 'pumpkin' | 'pearl', i: number): void { const p = (kind === 'acorn' ? this.acorns : kind === 'pumpkin' ? this.pumpkins : this.pearls)[i]; if (p) p.root.visible = false; }
  setLantern(i: number, on: boolean): void { const l = this.lanterns[i]; if (l) l.target = on ? 1 : 0; }
  setThorns(open: boolean): void { this.thorns.visible = !open; }
  setNight(k: number): void { this.night = k; for (const gl of this.glows) gl.sprite.material.opacity = gl.day + (gl.night - gl.day) * k; }

  update(t: number, hx: number, hz: number): void {
    for (const z of this.zones) z.g.visible = z.g.userData.always === true || Math.hypot(z.x - hx, z.z - hz) < CULL;
    if (this.sails) this.sails.rotation.z = t * 0.5;
    if (this.waterTex) this.waterTex.offset.set(t * 0.012, t * 0.008);
    for (const r of this.runeMats) r.opacity = 0.45 + 0.2 * Math.sin(t * 2) + 0.2 * this.night;
    for (const m of this.mist) { m.s.position.x = m.x + Math.sin(t * 0.3 + m.ph) * 1.2; m.s.material.opacity = 0.42 + 0.14 * Math.sin(t * 0.7 + m.ph); }
    const near = (x: number, z: number): boolean => Math.abs(x - hx) < 45 && Math.abs(z - hz) < 45;
    for (const list of [this.acorns, this.pumpkins, this.pearls]) for (const p of list) { if (!p.root.visible || !near(p.x, p.z)) continue; p.root.position.y = p.y + Math.sin(t * 2 + p.phase) * 0.1; p.root.rotation.y = t * 1.4 + p.phase; p.glow.material.opacity = 0.4 + 0.2 * Math.sin(t * 3 + p.phase) + 0.2 * this.night; }
    const dt = 1 / 60;
    this.chests.forEach((c, i) => { const cs = CHEST_SPOTS[i]; if (!near(cs.x, cs.z)) return; c.open += (c.target - c.open) * Math.min(1, dt * 9); c.lid.rotation.x = -c.open * 1.9; c.glow.material.opacity = c.target ? 0.15 : 0.35 + 0.2 * Math.sin(t * 2.4 + i); });
    this.lanterns.forEach((l, i) => { const p = LANTERN_SPOTS[i]; if (!near(p.x, p.z)) return; l.on += (l.target - l.on) * Math.min(1, dt * 4); l.glow.material.opacity = l.on * (0.75 + 0.15 * Math.sin(t * 4 + i)) + 0.0; (l.flame.material as MeshBasicMaterial).opacity = l.on; });
    void AdditiveBlending;
  }
}
