/**
 * Hand-built landmarks of the woods: the village (timber-framed houses with shingled roofs, shutters and flower boxes; a stone well; the
 * gate; fence; lamp posts), the ruins (fluted columns, broken shafts, a keystone arch, mossy tiles) and the Moon Gate. Every piece is
 * merged into a few vertex-coloured meshes with a little baked ambient occlusion near the ground, so the whole village costs a handful
 * of draw calls.
 */
import { withPaint } from '../stylize';
import { addWorldOutline } from './worldOutline';
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Euler, ExtrudeGeometry, Shape, Group, IcosahedronGeometry, Matrix4, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, OctahedronGeometry, PlaneGeometry, Quaternion, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, type Sprite,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOUSES, MOONLIT_GATE_POS, VILLAGE_GATE_POS, WELL_POS, type WorldLayout } from '../../systems/layout3d';
import { RUINS, heightAt } from '../../systems/worldShape';
import { PartBuilder, sweep, type Ring } from '../hero/geom';
import { glowSprite } from '../common';
import { noise3 } from './noise';

export interface NightGlow { sprite: Sprite; size: number; day: number; night: number }

export const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): Matrix4 =>
  new Matrix4().compose(V(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), V(sx, sy, sz));

/** A tiny modelling kit over PartBuilder: primitives with a flat colour, merged into one vertex-coloured geometry. */
export class Kit {
  readonly pb = new PartBuilder(() => 0);
  add(g: BufferGeometry, color: number, m: Matrix4 | null = null): this { g.deleteAttribute('uv'); this.pb.addGeometry(g, m, color); return this; }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0, rz = 0, rx = 0): this { return this.add(new BoxGeometry(w, h, d), color, M(x, y, z, rx, ry, rz)); }
  cyl(rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, color: number, ry = 0): this { return this.add(new CylinderGeometry(rt, rb, h, seg), color, M(x, y, z, 0, ry, 0)); }
  ball(r: number, x: number, y: number, z: number, color: number, sx = 1, sy = 1, sz = 1, detail = 1): this {
    const g = mergeVertices(new IcosahedronGeometry(r, detail).deleteAttribute('uv') as unknown as BufferGeometry, 1e-4); return this.add(g, color, M(x, y, z, 0, 0, 0, sx, sy, sz));
  }
  /** `dark` darkens vertices near the ground (baked AO), up to `height` metres. */
  build(ao = 0.28, height = 1.1): BufferGeometry {
    const g = this.pb.build(); const p = g.getAttribute('position'); const c = g.getAttribute('color');
    for (let i = 0; i < p.count; i++) { const k = 1 - ao * Math.max(0, 1 - p.getY(i) / height) ** 2; c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
    return g;
  }
}
const shade = (c: number, k: number): number => (Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k));
export const mat = () => withPaint(new MeshLambertMaterial({ vertexColors: true }));
const place = (g: BufferGeometry, x: number, y: number, z: number, ry = 0, material: MeshLambertMaterial = mat(), outline = false): Mesh => {
  const m = new Mesh(g, material); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
  if (outline) addWorldOutline(m); // v2.13: landmarks get the hero's cartoon outline
  return m;
};

// ---------------------------------------------------------------------------------------------------------------- village
const WALL = [0xf0e2bc, 0xe6d3a4, 0xf2dcc4], ROOF = [0xc8573b, 0x3f84a0, 0x9c5a3c], TIMBER = 0x6e4a30, STONE = 0xa7a69a;

export function houseGeometry(i: number): BufferGeometry {
  const k = new Kit(); const wall = WALL[i % 3], roof = ROOF[i % 3];
  const W = 3, H = 2, D = 2.6;
  k.box(W + 0.25, 0.4, D + 0.25, 0, 0.2, 0, STONE);                                    // stone foundation
  k.box(W, H - 0.2, D, 0, 0.4 + (H - 0.2) / 2, 0, wall);                                // walls
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.16, H - 0.1, 0.16, sx * W / 2, 0.4 + (H - 0.1) / 2, sz * D / 2, TIMBER); // corner posts
  for (const sz of [-1, 1]) { k.box(W + 0.12, 0.13, 0.1, 0, 1.45, sz * (D / 2 + 0.02), TIMBER); k.box(W + 0.12, 0.13, 0.1, 0, 2.18, sz * (D / 2 + 0.02), TIMBER); }
  for (const sx of [-1, 1]) { k.box(0.1, 0.13, D + 0.12, sx * (W / 2 + 0.02), 1.45, 0, TIMBER); k.box(0.1, 0.13, D + 0.12, sx * (W / 2 + 0.02), 2.18, 0, TIMBER); }
  for (const x of [-0.6, 0.6]) { k.box(0.09, 0.75, 0.08, x, 1.82, D / 2 + 0.03, TIMBER, 0, 0.6 * Math.sign(x)); }
  // gabled roof: two slabs with an overhang, shingle courses, a ridge beam and triangular gable ends
  const eaveZ = D / 2 + 0.45, eaveY = 2.15, ridgeY = 3.05, pitch = Math.atan2(ridgeY - eaveY, eaveZ), slabLen = Math.hypot(eaveZ, ridgeY - eaveY) + 0.1;
  for (const s of [-1, 1]) {
    k.add(new BoxGeometry(W + 0.7, 0.13, slabLen), roof, M(0, (eaveY + ridgeY) / 2 + 0.07, s * eaveZ / 2, s * pitch, 0, 0));
    for (let j = 0; j < 4; j++) { const t = (j + 0.5) / 4; k.add(new BoxGeometry(W + 0.74, 0.05, 0.14), j % 2 ? shade(roof, 0.82) : shade(roof, 1.12), M(0, eaveY + (ridgeY - eaveY) * t + 0.15, s * eaveZ * (1 - t), s * pitch, 0, 0)); }
  }
  k.box(W + 0.75, 0.16, 0.22, 0, ridgeY + 0.1, 0, TIMBER);
  const tri = new Shape(); tri.moveTo(-D / 2 - 0.02, 0); tri.lineTo(D / 2 + 0.02, 0); tri.lineTo(0, ridgeY - 2.2); tri.closePath();
  for (const sx of [-1, 1]) k.add(new ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }), wall, M(sx * (W / 2 - 0.05), 2.2, 0, 0, Math.PI / 2, 0));
  // door
  k.box(0.72, 1.2, 0.1, 0, 0.62 + 0.1, D / 2 + 0.03, 0x7a4a2c); k.add(new CylinderGeometry(0.36, 0.36, 0.1, 10, 1, false, 0, Math.PI), 0x7a4a2c, M(0, 1.32 + 0.1, D / 2 + 0.03, Math.PI / 2, 0, Math.PI));
  k.box(0.85, 0.08, 0.28, 0, 0.44, D / 2 + 0.18, STONE); k.ball(0.04, 0.24, 0.82, D / 2 + 0.1, 0xd8b25a, 1, 1, 1, 0);
  // windows (glass is added as a separate glowing mesh by the caller), shutters and a flower box
  for (const x of [-0.95, 0.95]) {
    k.box(0.62, 0.62, 0.07, x, 1.3, D / 2 + 0.03, 0x2c3a4a);
    for (const s of [-1, 1]) k.box(0.2, 0.62, 0.05, x + s * 0.4, 1.3, D / 2 + 0.06, i % 2 ? 0x3f7f9a : 0x4a7a4a);
    k.box(0.78, 0.16, 0.2, x, 0.9, D / 2 + 0.14, TIMBER);
    for (let f = 0; f < 5; f++) k.ball(0.07, x - 0.3 + f * 0.15, 1.03, D / 2 + 0.14, [0xff8fc8, 0xffd84a, 0xffffff, 0xb79cff, 0xff9a6a][(f + i) % 5], 1, 1, 1, 0);
    k.box(0.7, 0.07, 0.15, x, 1.0, D / 2 + 0.14, 0x4a8a3a);
  }
  // chimney
  k.box(0.46, 1.1, 0.46, 1.0, 3.1, -0.5, STONE); k.box(0.56, 0.12, 0.56, 1.0, 3.7, -0.5, 0x8c8c82);
  // a few climbing leaves on the corner
  for (let j = 0; j < 7; j++) k.ball(0.11 + (j % 3) * 0.03, -W / 2 - 0.03, 0.5 + j * 0.24, D / 2 + 0.01 - (j % 2) * 0.1, j % 2 ? 0x4f9a46 : 0x6ab755, 1, 1, 1, 0);
  return k.build(0.3, 1.2);
}

function wellGeometry(): BufferGeometry {
  const k = new Kit();
  const rows = 4;
  for (let r = 0; r < rows; r++) for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2 + (r % 2) * 0.26; const tone = [0xa2a398, 0xb4b3a6, 0x93948a, 0xaeada0][(j + r * 3) % 4];
    k.box(0.5, 0.2, 0.34, Math.cos(a) * 0.82, 0.12 + r * 0.19, Math.sin(a) * 0.82, tone, -a + Math.PI / 2);
  }
  k.cyl(0.64, 0.64, 0.06, 12, 0, 0.62, 0, 0x3a3a34);
  for (const s of [-1, 1]) k.box(0.13, 1.7, 0.13, s * 0.85, 1.3, 0, TIMBER);
  k.box(0.18, 0.18, 2.0, 0, 2.15, 0, TIMBER);
  k.cyl(0.05, 0.05, 1.5, 6, 0, 1.35, 0, 0x8a6a48); k.cyl(0.2, 0.17, 0.26, 8, 0, 0.78, 0, 0x7a4a2c);
  for (const s of [-1, 1]) k.add(new BoxGeometry(1.5, 0.1, 1.5), ROOF[0], M(0, 2.55, s * 0.5, -s * 0.62, 0, 0));
  k.box(1.5, 0.1, 0.12, 0, 2.95, 0, TIMBER);
  return k.build(0.25, 0.9);
}

function gateGeometry(): BufferGeometry {
  const k = new Kit();
  for (const s of [-1, 1]) {
    k.cyl(0.24, 0.3, 3.2, 8, s * 2.2, 1.6, 0, TIMBER); k.ball(0.3, s * 2.2, 3.28, 0, 0x8a6240, 1, 0.8, 1, 1); k.box(0.7, 0.3, 0.7, s * 2.2, 0.15, 0, STONE);
    k.box(0.12, 1.0, 0.1, s * 1.9, 2.7, 0, TIMBER, 0, -s * 0.7); // brace
  }
  k.box(5.4, 0.36, 0.4, 0, 3.0, 0, TIMBER);
  k.box(2.4, 0.7, 0.14, 0, 2.45, 0, 0xd8b25a); k.box(2.5, 0.08, 0.2, 0, 2.82, 0, 0x8a6240); k.box(2.5, 0.08, 0.2, 0, 2.08, 0, 0x8a6240);
  for (let j = 0; j < 5; j++) k.ball(0.09, -0.9 + j * 0.45, 2.45, 0.1, 0x6a4a30, 1, 1, 0.5, 0); // carved rivets
  for (let j = 0; j < 9; j++) k.ball(0.12, -2.2 + j * 0.55, 3.18, 0.1, j % 2 ? 0x4f9a46 : 0x6ab755, 1, 0.8, 1, 0); // leaf garland
  return k.build(0.25, 1);
}

function fenceGeometry(): BufferGeometry {
  const k = new Kit();
  for (let x = -12; x <= 12; x += 1.5) {
    if (Math.abs(x) < 2.4) continue;
    k.cyl(0.07, 0.08, 1.0 + 0.1 * Math.sin(x * 3), 6, x, 0.5, 0, 0x8a6240);
    if (Math.abs(x + 1.5) >= 2.4 || x > 2.4) for (const y of [0.35, 0.72]) k.box(1.5, 0.08, 0.06, x + 0.75, y, 0, 0x7a5236);
  }
  return k.build(0.3, 0.6);
}

function lampGeometry(): BufferGeometry {
  const k = new Kit();
  k.cyl(0.06, 0.1, 2.0, 6, 0, 1.0, 0, 0x3a3a40); k.cyl(0.16, 0.18, 0.12, 8, 0, 0.06, 0, 0x55555c);
  k.box(0.38, 0.04, 0.38, 0, 2.02, 0, 0x2f2f36); k.add(new ConeGeometry(0.3, 0.26, 4), 0x2f2f36, M(0, 2.4, 0, 0, Math.PI / 4, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.025, 0.3, 0.025, sx * 0.14, 2.2, sz * 0.14, 0x2f2f36);
  return k.build(0.1, 0.4);
}

function lampPost(x: number, z: number, root: Group, glows: NightGlow[], geo: BufferGeometry, material: MeshLambertMaterial): void {
  const y = heightAt(x, z);
  root.add(place(geo, x, y, z, 0, material, true));
  root.add(new Mesh(new SphereGeometry(0.15, 10, 8), new MeshBasicMaterial({ color: 0xfff0b0 })).translateX(x).translateY(y + 2.2).translateZ(z));
  const s = glowSprite(0xffd27a, 1.7, 0.55); s.position.set(x, y + 2.2, z); root.add(s);
  glows.push({ sprite: s, size: 1.7, day: 0.55, night: 1 });
}

export function buildVillage(root: Group, glows: NightGlow[]): void {
  const material = mat();
  const windowGlass = new MeshBasicMaterial({ color: 0xffe9a0 });
  HOUSES.forEach((h, i) => {
    const g = new Group(); g.position.set(h.x, heightAt(h.x, h.z), h.z); g.rotation.y = h.rot;
    g.add(place(houseGeometry(i), 0, 0, 0, 0, material, true));
    for (const x of [-0.95, 0.95]) {
      const w = new Mesh(new PlaneGeometry(0.5, 0.5), windowGlass); w.position.set(x, 1.3, 1.3 + 0.075); g.add(w);
      const halo = glowSprite(0xffd98a, 1.5, 0); halo.position.set(x, 1.3, 1.6); g.add(halo); glows.push({ sprite: halo, size: 1.5, day: 0, night: 0.55 });
    }
    root.add(g);
  });
  const wy = heightAt(WELL_POS.x, WELL_POS.z);
  root.add(place(wellGeometry(), WELL_POS.x, wy, WELL_POS.z, 0.4, material, true));
  const water = new Mesh(new CircleGeometry(0.62, 14), new MeshBasicMaterial({ color: 0x4a9ad0 })); water.rotation.x = -Math.PI / 2; water.position.set(WELL_POS.x, wy + 0.56, WELL_POS.z); root.add(water);
  const gy = heightAt(VILLAGE_GATE_POS.x, VILLAGE_GATE_POS.z);
  root.add(place(gateGeometry(), VILLAGE_GATE_POS.x, gy, VILLAGE_GATE_POS.z, 0, material, true));
  for (const s of [-2.2, 2.2]) { const l = glowSprite(0xffd27a, 1.5, 0.6); l.position.set(VILLAGE_GATE_POS.x + s, gy + 3.7, VILLAGE_GATE_POS.z); root.add(l); glows.push({ sprite: l, size: 1.5, day: 0.6, night: 1 }); }
  // the south fence follows the ground, so it is built in short runs
  const fence = fenceGeometry();
  root.add(place(fence, 0, heightAt(0, 36), 36, 0, material));
  const lamp = lampGeometry();
  for (const [x, z] of [[-2.6, 28], [3.5, 25.5], [-6, 24], [1.5, 19]] as const) lampPost(x, z, root, glows, lamp, material);
}

// ---------------------------------------------------------------------------------------------------------------- ruins
const STONE_A = [0xaab0a6, 0x9aa095, 0xb6bab0, 0x8f968c];

function columnGeometry(height: number, broken: boolean, seed: number): BufferGeometry {
  const k = new Kit();
  k.box(1.45, 0.3, 1.45, 0, 0.15, 0, 0x8f968c); k.cyl(0.66, 0.74, 0.22, 12, 0, 0.41, 0, 0xa4aa9f);
  const pb = k.pb; const rings: Ring[] = []; const top = broken ? height * (0.82 + 0.0) : height; const n = 8;
  for (let i = 0; i <= n; i++) { const t = i / n; const r = 0.5 - 0.06 * t + (i === 0 || i === n ? 0.05 : 0); rings.push({ p: V(0, 0.52 + t * (top - 0.52), 0), rA: r, rB: r, tint: i % 3 === 1 ? 0xd8dad2 : 0xffffff }); }
  sweep(pb, rings, STONE_A[seed % 4], { radial: 16, ref: V(1, 0, 0), capEnd: 'flat', bump: (ri, a) => 0.045 * Math.sin(a * 8) + (broken && ri === n ? 0.35 * noise3(Math.cos(a) * 2 + seed, Math.sin(a) * 2, seed) - 0.12 : 0) });
  if (!broken) { k.cyl(0.62, 0.52, 0.22, 12, 0, height + 0.1, 0, 0xa4aa9f); k.box(1.3, 0.28, 1.3, 0, height + 0.34, 0, 0x8f968c); }
  else { k.ball(0.3, 0.2, top + 0.08, 0.1, 0x6fae4e, 1.2, 0.5, 1, 1); k.box(0.9, 0.5, 0.7, 1.0, 0.25, 0.5, 0xa4aa9f, 0.6); k.cyl(0.4, 0.42, 0.8, 10, -1.1, 0.4, 0.8, 0x9aa095, 0); }
  k.ball(0.3, 0.25, 0.5, 0.35, 0x6fae4e, 1.3, 0.5, 1, 1);
  for (let j = 0; j < 6; j++) k.ball(0.07, 0.4 * Math.cos(j * 1.2), 0.9 + j * 0.35, 0.4 * Math.sin(j * 1.2), 0x5fb04a, 1, 1, 0.6, 0); // ivy
  return k.build(0.22, 1.4);
}

function blockGeometry(w: number, h: number, d: number): BufferGeometry {
  const k = new Kit(); k.box(w, h, d, 0, h / 2, 0, 0xa4aa9f); k.box(w * 0.98, 0.12, d * 0.98, 0, h + 0.02, 0, 0x6fae4e);
  k.ball(0.28, w * 0.3, h + 0.08, d * 0.1, 0x7cc454, 1.6, 0.4, 1.2, 1); k.box(w * 1.01, 0.05, d * 1.01, 0, h * 0.5, 0, 0x7e857b);
  return k.build(0.3, 0.8);
}

function archGeometry(): BufferGeometry {
  const k = new Kit();
  // a keystone arch spanning the north entrance, with the right half collapsed
  const R = 2.7;
  for (let j = 0; j <= 8; j++) {
    const a = Math.PI * (j / 8); if (j > 6 && j < 8) continue; // gap: collapsed voussoirs
    const x = Math.cos(a) * R, y = 2.4 + Math.sin(a) * R * 1.05;
    k.box(0.85, 0.7, 1.3, x, y, 0, STONE_A[j % 4], 0, a - Math.PI / 2);
  }
  for (const s of [-1, 1]) k.box(1.0, 2.6, 1.3, s * R, 1.3, 0, STONE_A[(s + 3) % 4]);
  k.box(1.3, 0.25, 1.6, -R, 0.12, 0, 0x8f968c); k.box(1.3, 0.25, 1.6, R, 0.12, 0, 0x8f968c);
  k.box(2.4, 0.8, 1.2, R + 1.6, 0.4, 1.6, 0x9aa095, 0.5); k.box(1.2, 0.6, 1.0, R + 0.2, 0.3, 2.4, 0xa4aa9f, -0.3);
  for (let j = 0; j < 10; j++) k.ball(0.12, -R + 0.1 + (j % 2) * 0.2, 0.6 + j * 0.27, 0.62, 0x5fb04a, 1, 1, 0.5, 0);
  k.ball(0.5, -R + 0.1, 5.05, 0.1, 0x6fae4e, 1.4, 0.5, 1, 1);
  return k.build(0.22, 1.5);
}

export function buildRuins(layout: WorldLayout, root: Group): { runes: MeshBasicMaterial; glows: ReturnType<typeof glowSprite>[]; coreMat: MeshLambertMaterial } {
  const material = mat();
  const cx = RUINS.x, cz = RUINS.z;
  // floor: tiles of slightly different stone around the arena, built as a ring of wedge-ish boxes
  const floor = new Kit();
  for (let r = 0; r < 4; r++) {
    const rad = 2.2 + r * 2.15, count = 10 + r * 8;
    for (let j = 0; j < count; j++) {
      const a = (j / count) * Math.PI * 2 + r * 0.2;
      if (r === 3 && Math.cos(a - Math.PI / 2) > 0.85 && false) continue;
      const tone = [0x9aa095, 0xa6ab9f, 0x8f968c, 0xb1b5a8][(j * 3 + r) % 4];
      floor.box(2.1, 0.12, (2 * Math.PI * rad) / count + 0.04, Math.cos(a) * rad, 0.04 + 0.018 * ((j + r) % 3), Math.sin(a) * rad, tone, -a);
    }
  }
  floor.ball(0.7, 3, 0.1, -2, 0x6fae4e, 2, 0.15, 1.4, 1); floor.ball(0.6, -4.5, 0.1, 3, 0x6fae4e, 1.6, 0.15, 2, 1);
  root.add(place(floor.build(0, 1), cx, 0, cz, 0, material));
  const runes = new MeshBasicMaterial({ color: 0x66e8d4, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false });
  for (const [r, w] of [[7.1, 0.07], [3.4, 0.05], [9.2, 0.04]] as const) {
    const ring = new Mesh(new TorusGeometry(r, w, 4, 72), runes); ring.position.set(cx, 0.15, cz); ring.rotation.x = Math.PI / 2; root.add(ring);
  }
  // glyph marks around the inner ring (small glowing diamonds)
  const glyph = new OctahedronGeometry(0.16, 0); glyph.scale(1, 0.12, 1.5);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const m = new Mesh(glyph, runes); m.position.set(cx + Math.sin(a) * 5.2, 0.16, cz + Math.cos(a) * 5.2); m.rotation.y = a; root.add(m); }
  const glows: ReturnType<typeof glowSprite>[] = [];
  const dais = new Kit();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const s = glowSprite(0x66e8d4, 1.1, 0.4); s.position.set(cx + Math.sin(a) * 7.1, 0.3, cz + Math.cos(a) * 7.1); root.add(s); glows.push(s);
    dais.box(0.55, 0.1, 0.55, Math.sin(a) * 7.1, 0.12, Math.cos(a) * 7.1, 0x6f766f, a);
  }
  root.add(place(dais.build(0, 1), cx, 0, cz, 0, material));
  // the glowing core stone
  const coreMat = new MeshLambertMaterial({ color: 0x9be8ff, emissive: 0x33c8b8, emissiveIntensity: 0.4, flatShading: true });
  const core = new Mesh(new OctahedronGeometry(0.5, 1), coreMat); core.position.set(cx, 0.9, cz - 6.5); core.scale.y = 1.6; core.castShadow = true; root.add(core);
  const base = new Kit(); base.cyl(0.55, 0.7, 0.4, 8, 0, 0.2, 0, 0x8f968c); base.cyl(0.35, 0.5, 0.2, 8, 0, 0.5, 0, 0xa4aa9f);
  root.add(place(base.build(0, 1), cx, 0, cz - 6.5, 0, material));
  // columns, one geometry per height class (broken ones differ)
  const cache = new Map<string, BufferGeometry>();
  layout.pillars.forEach((p, i) => {
    const key = `${p.broken ? 'b' : 'f'}${Math.round(p.height * 2)}${i % 4}`;
    let g = cache.get(key); if (!g) { g = columnGeometry(p.height, p.broken, i); cache.set(key, g); }
    root.add(place(g, p.x, heightAt(p.x, p.z), p.z, p.rot, material));
  });
  for (const b of layout.blocks) root.add(place(blockGeometry(b.w, b.h, b.d), b.x, heightAt(b.x, b.z), b.z, b.rot, material));
  // north arch with a dark cave behind it
  const az = cz - 11.5;
  root.add(place(archGeometry(), cx, 0, az, 0, material));
  const cave = new Mesh(new PlaneGeometry(5.2, 5.0), new MeshBasicMaterial({ color: 0x07110f })); cave.position.set(cx, 2.6, az - 0.5); root.add(cave);
  const cg = glowSprite(0x66e8d4, 3.4, 0.25); cg.position.set(cx, 1.8, az - 0.3); root.add(cg); glows.push(cg);
  return { runes, glows, coreMat };
}

// ---------------------------------------------------------------------------------------------------------------- moon gate
export function buildMoonGate(root: Group): { open(o: boolean): void; update(t: number): void } {
  const gx = MOONLIT_GATE_POS.x, gz = MOONLIT_GATE_POS.z, gy = heightAt(gx, gz);
  const g = new Group(); g.position.set(gx, gy, gz); root.add(g);
  const k = new Kit();
  for (const s of [-2, 2]) {
    k.cyl(0.55, 0.68, 0.5, 12, 0, 0.25, s, 0xa9b4c4);
    k.cyl(0.46, 0.52, 3.4, 14, 0, 2.2, s, 0xd2dae6); k.cyl(0.52, 0.46, 0.3, 14, 0, 3.95, s, 0xa9b4c4);
    for (let j = 0; j < 3; j++) k.add(new TorusGeometry(0.5, 0.04, 5, 14), 0x8f9bb5, M(0, 1.2 + j * 0.9, s, Math.PI / 2, 0, 0));
    k.ball(0.22, 0, 4.3, s, 0xbfd4ff, 1, 1.3, 1, 1);
  }
  // the arch: a ring of stones over the gap, with a crescent keystone
  for (let j = 0; j <= 10; j++) { const a = (j / 10) * Math.PI; const z = Math.cos(a) * 2.0, y = 4.0 + Math.sin(a) * 1.15; k.add(new BoxGeometry(0.9, 0.62, 0.8), 0xc8cfd8, M(0, y, z, -(a - Math.PI / 2) * 0 + 0, 0, 0)); void y; }
  k.box(1.1, 0.5, 4.8, 0, 4.0, 0, 0xb5bfcd);
  k.add(new TorusGeometry(0.42, 0.11, 6, 18, Math.PI * 1.5), 0xeaf2ff, M(0, 5.25, 0, 0, Math.PI / 2, 0.5));
  const geo = k.build(0.25, 1.6);
  g.add(place(geo, 0, 0, 0, 0, mat()));
  const vines = new Group();
  const vk = new Kit();
  for (let i = 0; i < 7; i++) { const z = -1.8 + i * 0.6; vk.box(0.07, 3.6, 0.1, 0, 1.8, z, 0x2f6b3a, 0, 0, i % 2 ? 0.08 : -0.08); for (let j = 0; j < 5; j++) vk.ball(0.12, 0.05, 0.5 + j * 0.7, z + (j % 2) * 0.05, 0x4f9a46, 1, 1, 0.6, 0); }
  for (let i = 0; i < 4; i++) vk.box(0.08, 0.1, 3.9, 0, 0.6 + i * 0.9, 0, 0x3f8a3a);
  vines.add(place(vk.build(0, 1), 0, 0, 0, 0, mat())); g.add(vines);
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(170,210,255,0.8)'); gr.addColorStop(1, 'rgba(120,170,255,0.1)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
  const portalMat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const portal = new Mesh(new PlaneGeometry(4, 3.8), portalMat); portal.position.set(0, 1.9, 0); portal.rotation.y = Math.PI / 2; g.add(portal);
  const halo = glowSprite(0xb7d4ff, 6, 0); halo.position.set(0, 2.2, 0); g.add(halo);
  let isOpen = false;
  return {
    open(o) { isOpen = o; vines.visible = !o; },
    update(t) {
      const kk = isOpen ? 1 : 0;
      portalMat.opacity = kk * (0.7 + Math.sin(t * 2) * 0.12); halo.material.opacity = kk * (0.55 + Math.sin(t * 1.7) * 0.12);
      portal.rotation.z = t * 0.2;
    },
  };
}
