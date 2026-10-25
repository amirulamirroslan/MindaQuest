/**
 * Procedural small scenery: rocks (with moss), flowers, mushrooms, ferns, stumps, logs and grass blades. All geometry is merged and
 * vertex-coloured (shaded darker at the base) so it instances cheaply and reads as one stylised family with the trees.
 */
import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, SphereGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PartBuilder, curvePath, lerp, smooth, sweep, type Ring } from '../hero/geom';
import { noise2, noise3 } from './noise';

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const part = () => new PartBuilder(() => 0);

function weld(g: BufferGeometry): BufferGeometry { g.deleteAttribute('normal'); g.deleteAttribute('uv'); return mergeVertices(g, 1e-4); }

/**
 * A chunky rock: displaced, flattened icosahedron with flat (chiselled) facets, banded strata, dark cracks, lichen speckles and
 * moss on the upper faces and in crevices; dark at the foot where it meets the ground.
 */
export function rockGeometry(seed: number, detail = 2): BufferGeometry {
  const g = weld(new IcosahedronGeometry(1, detail));
  const pos = g.getAttribute('position'); const col = new Float32Array(pos.count * 3);
  const stone = new Color(0xa9aca2), stoneWarm = new Color(0xb4a994), stoneDark = new Color(0x666e6a), moss = new Color(0x62a448), mossLight = new Color(0x9fd36a), lichenA = new Color(0xd8cc62), lichenB = new Color(0xd08a56), tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const n = noise3(ux * 1.6 + seed, uy * 1.6, uz * 1.6 - seed), n2 = noise3(ux * 4.2, uy * 4.2 + seed, uz * 4.2), n3 = noise3(ux * 9 + seed, uy * 9, uz * 9 - seed);
    const k = 0.78 + 0.5 * n + 0.07 * n2 + (detail >= 2 ? 0.035 * n3 : 0);
    const x = ux * k * 1.05, y = Math.max(-0.35, uy * k * 0.78), z = uz * k;
    pos.setXYZ(i, x, y, z);
    const up = smooth((uy - 0.1) / 0.7);
    // banded strata (tilted a little, wobbled by noise) and warm/cool patches
    const band = 0.5 + 0.5 * Math.sin((y * 5.5 + x * 1.3 + n * 2.4 + seed) * 2.2);
    tmp.copy(stoneDark).lerp(stone, smooth((y + 0.35) / 0.8)).lerp(stoneWarm, smooth((n2 - 0.35) * 2.2) * 0.5).multiplyScalar((0.84 + 0.2 * band) * (0.9 + 0.2 * n2));
    // cracks: thin dark lines where a noise field crosses 0.5
    const crack = Math.max(0, 1 - Math.abs(noise3(ux * 2.6 + seed * 0.5, uy * 2.6, uz * 2.6) - 0.5) * 22);
    tmp.multiplyScalar(1 - 0.42 * crack);
    // lichen speckles on the sides
    const lich = n3 > 0.78 && up < 0.8 ? 1 : 0; if (lich) tmp.lerp(n2 > 0.5 ? lichenA : lichenB, 0.65);
    const mossAmt = smooth((up - 0.2) * 1.5) * (0.5 + 0.7 * noise3(ux * 2.6 - seed, uz * 2.6, 1.7)) + crack * 0.25 * (1 - up);
    tmp.lerp(moss, Math.min(1, mossAmt)); tmp.lerp(mossLight, Math.max(0, mossAmt - 0.75) * 0.8);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  const flat = g.toNonIndexed(); flat.computeVertexNormals(); // flat facets
  return flat;
}

/** A blossom head only (instance-coloured); five rounded petals around a golden centre, facing up. */
export function blossomGeometry(): BufferGeometry {
  const pb = part();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const rings: Ring[] = [{ p: V(Math.cos(a) * 0.015, 0, Math.sin(a) * 0.015), rA: 0.012, rB: 0.02, tint: 0xd8d8d8 }, { p: V(Math.cos(a) * 0.06, 0.012, Math.sin(a) * 0.06), rA: 0.016, rB: 0.04, tint: 0xffffff }, { p: V(Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1), rA: 0.012, rB: 0.03, tint: 0xffffff }];
    sweep(pb, rings, 0xffffff, { radial: 4, ref: V(0, 1, 0), capEnd: 'flat' });
  }
  const centre = new SphereGeometry(0.03, 5, 3); centre.translate(0, 0.02, 0);
  pb.addGeometry(weld(centre), null, 0xffd23a);
  return pb.build();
}
export function stemGeometry(): BufferGeometry {
  const pb = part();
  sweep(pb, curvePath(V(0, 0, 0), V(0.02, 0.14, 0.01), V(0.0, 0.3, 0.0), 4, 0.01, 0.007, 1, 0x2f6a32, 0x6bb04a), 0xffffff, { radial: 4, ref: V(1, 0, 0) });
  for (const s of [1, -1]) sweep(pb, curvePath(V(0, 0.08, 0), V(s * 0.05, 0.1, 0), V(s * 0.1, 0.07, 0.02), 3, 0.01, 0.002, 0.3, 0x4a9a3e, 0x7cc454), 0xffffff, { radial: 4, ref: V(0, 0, 1) });
  return pb.build();
}

/** A toadstool: pale stem and a domed cap (dots are baked as vertex colours). `glow` makes the cap bright for an emissive material. */
export function mushroomGeometry(glow: boolean, seed = 0): BufferGeometry {
  const pb = part();
  sweep(pb, [
    { p: V(0, 0, 0), rA: 0.07, rB: 0.07, tint: 0xd2c8b4 }, { p: V(0, 0.07, 0), rA: 0.045, rB: 0.045, tint: 0xefe6d2 }, { p: V(0, 0.16, 0), rA: 0.04, rB: 0.04, tint: 0xf6efe0 }, { p: V(0, 0.22, 0), rA: 0.05, rB: 0.05, tint: 0xe6dcc8 },
  ], 0xffffff, { radial: 8, ref: V(1, 0, 0) });
  const cap = weld(new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const pos = cap.getAttribute('position'); const col = new Float32Array(pos.count * 3);
  const base = new Color(glow ? 0x57d6e8 : 0xe0453a), spot = new Color(glow ? 0xd8fff8 : 0xfff4e0), under = new Color(0xe9dcc2), tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    pos.setXYZ(i, ux * 0.15, 0.2 + uy * 0.1 - 0.0, uz * 0.15);
    const dots = noise3(ux * 6 + seed, uy * 6, uz * 6) > 0.74 && uy > 0.35 ? 1 : 0;
    tmp.copy(base).lerp(spot, dots).lerp(under, smooth((0.3 - uy) * 3));
    tmp.multiplyScalar(lerp(0.78, 1.1, smooth(uy)));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  cap.setAttribute('color', new BufferAttribute(col, 3));
  pb.addGeometry(cap, null, 0xffffff);
  return pb.build();
}

/** A fern: arching fronds fanned from the centre, each with pairs of leaflets that shrink to the tip; dark at the base, bright at the tips. */
export function fernGeometry(): BufferGeometry {
  const pb = part();
  const n = 11; const col = new Color(), dk = new Color(0x2a6a30), lt = new Color(0x92d460);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2; const len = 0.72 + (i % 3) * 0.14; const lift = 0.35 + (i % 2) * 0.25;
    const c = V(Math.cos(a), 0, Math.sin(a)); const side = V(-c.z, 0, c.x);
    const p0 = V(c.x * 0.03, 0.02, c.z * 0.03), p1 = V(c.x * len * 0.5, lift * len, c.z * len * 0.5), p2 = V(c.x * len, lift * len * 0.45, c.z * len);
    const at = (t: number): Vector3 => { const u = 1 - t; return V(p0.x * u * u + p1.x * 2 * u * t + p2.x * t * t, p0.y * u * u + p1.y * 2 * u * t + p2.y * t * t, p0.z * u * u + p1.z * 2 * u * t + p2.z * t * t); };
    sweep(pb, curvePath(p0, p1, p2, 5, 0.035, 0.008, 0.6, 0x2f6a30, 0x70b04a), 0xffffff, { radial: 4, ref: V(0, 1, 0) });
    const pairs = 8;
    for (let k = 0; k < pairs; k++) {
      const t = 0.16 + (k / (pairs - 1)) * 0.8; const q = at(t), q2 = at(Math.min(1, t + 0.06));
      const ll = (0.2 - t * 0.12) * len * 1.15;
      col.copy(dk).lerp(lt, smooth(t * 1.15)).multiplyScalar(0.92 + 0.16 * ((i * 7 + k * 3) % 5) / 5);
      const tint = col.clone();
      for (const sd of [1, -1]) {
        const tip = q.clone().addScaledVector(side, sd * ll).addScaledVector(q2.clone().sub(q), 1.1); tip.y -= 0.05 + 0.03 * t;
        const i0 = pb.addVertex(q, tint.clone().multiplyScalar(0.8)), i1 = pb.addVertex(q2, tint.clone().multiplyScalar(0.8)), i2 = pb.addVertex(tip, tint.clone().multiplyScalar(1.12));
        pb.addTri(i0, i1, i2);
      }
    }
  }
  return pb.build();
}

/** A cluster of cattail reeds: tall curved leaf blades and a few brown seed heads on slim stems (for the pond bank). */
export function reedGeometry(): BufferGeometry {
  const pb = part();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4; const h = 1.0 + (i % 4) * 0.2; const lean = 0.18 + (i % 3) * 0.08;
    const c = V(Math.cos(a), 0, Math.sin(a));
    sweep(pb, curvePath(V(c.x * 0.05, 0, c.z * 0.05), V(c.x * lean * 0.4, h * 0.6, c.z * lean * 0.4), V(c.x * lean, h, c.z * lean), 5, 0.035, 0.004, 0.35, 0x3a7a34, 0x9acd5c), 0xffffff, { radial: 4, ref: V(0, 1, 0) });
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.9; const h = 1.25 + i * 0.15; const c = V(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    sweep(pb, curvePath(c, V(c.x + 0.02, h * 0.55, c.z), V(c.x + 0.04 * (i - 1), h, c.z + 0.02), 4, 0.014, 0.01, 1, 0x4a8a3a, 0x7ab050), 0xffffff, { radial: 5, ref: V(1, 0, 0) });
    const head = weld(new SphereGeometry(1, 7, 5)); head.scale(0.045, 0.17, 0.045); head.translate(c.x + 0.04 * (i - 1), h + 0.05, c.z + 0.02);
    pb.addGeometry(head, null, 0x6b4328);
    sweep(pb, [{ p: V(c.x + 0.04 * (i - 1), h + 0.2, c.z + 0.02), rA: 0.006, rB: 0.006, tint: 0xc8a050 }, { p: V(c.x + 0.04 * (i - 1), h + 0.34, c.z + 0.02), rA: 0.002, rB: 0.002, tint: 0xe0c070 }], 0xffffff, { radial: 3, ref: V(1, 0, 0) });
  }
  return pb.build();
}

/** A single fallen leaf lying flat (instance-coloured: yellow, orange, russet). */
export function fallenLeafGeometry(): BufferGeometry {
  const pb = part();
  const a = pb.addVertex(V(0, 0.012, -0.09), new Color(0.78, 0.78, 0.78)), l = pb.addVertex(V(-0.05, 0.016, 0), new Color(1, 1, 1)), r = pb.addVertex(V(0.05, 0.016, 0), new Color(1, 1, 1)), t = pb.addVertex(V(0, 0.02, 0.1), new Color(0.9, 0.9, 0.9));
  pb.addTri(a, t, l); pb.addTri(a, r, t);
  return pb.build();
}

export function stumpGeometry(): BufferGeometry {
  const pb = part();
  sweep(pb, [
    { p: V(0, 0, 0), rA: 0.55, rB: 0.55, tint: 0xa88a64 }, { p: V(0, 0.15, 0), rA: 0.42, rB: 0.42, tint: 0xbc9b70 }, { p: V(0, 0.4, 0), rA: 0.38, rB: 0.38, tint: 0xc9a77a }, { p: V(0, 0.52, 0), rA: 0.36, rB: 0.36, tint: 0xd8b98a },
  ], 0xffffff, { radial: 10, ref: V(1, 0, 0), bump: (ri, ang) => 0.08 * Math.sin(ang * 3 + ri) + 0.04 * Math.sin(ang * 8 - ri * 1.7) + (ri === 0 ? 0.12 * Math.abs(Math.sin(ang * 2.5)) : 0) });
  // top: pale wood with a darker ring
  const top = weld(new SphereGeometry(1, 10, 3, 0, Math.PI * 2, 0, Math.PI * 0.12)); top.scale(0.36, 0.2, 0.36); top.translate(0, 0.46, 0);
  pb.addGeometry(top, null, 0xe8cf9e);
  // moss cap on one side
  const moss = weld(new IcosahedronGeometry(0.2, 1)); moss.scale(1, 0.5, 1); moss.translate(0.22, 0.05, 0.1);
  pb.addGeometry(moss, null, 0x72b14e);
  return pb.build();
}

export function logGeometry(): BufferGeometry {
  const pb = part();
  const rings: Ring[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; rings.push({ p: V(-1.2 + t * 2.4, 0.3 + Math.sin(t * 3) * 0.02, 0), rA: 0.3 - t * 0.04, rB: 0.3 - t * 0.04, tint: i % 2 ? 0xe0e0e0 : 0xffffff }); }
  sweep(pb, rings, 0x8c694a, { radial: 9, ref: V(0, 1, 0), capStart: 'flat', capEnd: 'flat', bump: (ri, ang) => 0.05 * Math.sin(ang * 3 + ri * 2) + 0.035 * Math.sin(ang * 9 - ri) });
  const moss = weld(new IcosahedronGeometry(0.28, 1)); moss.scale(1.7, 0.4, 0.9); moss.translate(0.1, 0.58, 0.04);
  pb.addGeometry(moss, null, 0x72b14e);
  for (let i = 0; i < 3; i++) { const sh = mushroomGeometry(false, i); sh.scale(0.8, 0.8, 0.8); sh.translate(-0.7 + i * 0.7, 0.5, 0.18); pb.addGeometry(sh, null, 0xffffff); }
  return pb.build();
}

/**
 * One cell of meadow. Each "tuft" is one of five kinds, picked at random: a short lawn tuft, a tall tuft, a tall tuft with golden
 * seed heads, a patch of clover trefoils, or a dandelion (yellow flower or white puffball). Blades are four-row curved ribbons with
 * a `aBend` attribute (0 at the root, 1 at the tip) so the wind shader can sway them. Colour follows large dry/lush patches, with
 * dark roots and bright tips. `userData.ends` lists the cumulative index count after each tuft, so a lower quality tier can draw a
 * clean prefix (whole tufts only).
 */
export function grassCellGeometry(tufts: number, cell: { x: number; z: number; size: number }, heightAt: (x: number, z: number) => number, accept: (x: number, z: number) => boolean, rnd: () => number): BufferGeometry | null {
  const pos: number[] = [], col: number[] = [], bend: number[] = [], rise: number[] = [], idx: number[] = [], ends: number[] = [];
  const root = new Color(0x246a2c), body = new Color(0x46a038), tip = new Color(0x9ede58), tipB = new Color(0xcfee6c), dry = new Color(0xc2b850), lush = new Color(0x2a8a50), tmp = new Color(), tmp2 = new Color();
  // `rise` = height above the ground: the shader uses it to shorten the grass around the hero (v2.9)
  const vert = (x: number, y: number, z: number, c: Color, bd: number): number => { pos.push(x, y, z); col.push(c.r, c.g, c.b); bend.push(bd); rise.push(Math.max(0, y - heightAt(x, z))); return pos.length / 3 - 1; };
  let count = 0;

  /** A ribbon blade: rows at t = 0, 0.33, 0.68 (two vertices each) and a tip vertex. */
  const blade = (x: number, y: number, z: number, h: number, w: number, a: number, lean: number, la: number, cRoot: Color, cTip: Color, three = false): void => {
    const cx = Math.cos(a), cz = Math.sin(a), lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
    const rows: [number, number, number][] = three ? [[0, w, 0], [0.5, w * 0.8, 0.4], [1, 0.001, 1]] : [[0, w, 0], [0.33, w * 0.92, 0.25], [0.68, w * 0.62, 0.6], [1, 0.001, 1]];
    const vi: number[] = [];
    for (const [t, ww, bd] of rows) {
      const px = x + lx * h * t * t * 1.15, pz = z + lz * h * t * t * 1.15, py = y + h * t - lean * 0.3 * t * t * h;
      tmp.copy(cRoot).lerp(cTip, smooth(t * 1.1)); tmp.multiplyScalar(0.9 + 0.2 * (0.4 + t) * rnd());
      if (t === 1) vi.push(vert(px, py, pz, tmp, bd));
      else { vi.push(vert(px + cx * ww, py, pz + cz * ww, tmp, bd), vert(px - cx * ww, py, pz - cz * ww, tmp, bd)); }
    }
    if (three) idx.push(vi[0], vi[1], vi[2], vi[1], vi[3], vi[2], vi[2], vi[3], vi[4]);
    else idx.push(vi[0], vi[1], vi[2], vi[1], vi[3], vi[2], vi[2], vi[3], vi[4], vi[3], vi[5], vi[4], vi[4], vi[5], vi[6]);
  };
  /** A flat-ish tri-fan or diamond used for clover leaflets, seed heads, puffballs: given in absolute positions. */
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number], ca: Color, cb: Color, cc: Color, bd: number): void => {
    const i0 = vert(a[0], a[1], a[2], ca, bd), i1 = vert(b[0], b[1], b[2], cb, bd), i2 = vert(c[0], c[1], c[2], cc, bd);
    idx.push(i0, i1, i2); // the grass material is double sided and lights every blade as facing the sky
  };

  for (let b = 0; b < tufts; b++) {
    const tx = cell.x + rnd() * cell.size, tz = cell.z + rnd() * cell.size;
    if (!accept(tx, tz)) continue;
    const ty = heightAt(tx, tz) - 0.02;
    const dryK = smooth((noise2(tx * 0.11 + 3, tz * 0.11 - 1) - 0.6) * 4), lushK = smooth((0.42 - noise2(tx * 0.08, tz * 0.08 + 7)) * 4);
    const cRoot = root.clone().lerp(lush, lushK * 0.5).lerp(dry, dryK * 0.35).multiplyScalar(0.92 + 0.16 * rnd());
    const cBody = body.clone().lerp(lush, lushK * 0.5).lerp(dry, dryK * 0.55);
    const k = rnd(); const kindR = rnd();
    const cTip = cBody.clone().lerp(tip, 0.75).lerp(tipB, k * 0.45).lerp(dry, dryK * 0.5);
    if (kindR < 0.62 || kindR >= 0.985) {
      // lawn tuft (and the dandelion's leaves)
      const nb = 5 + Math.floor(rnd() * 4);
      for (let j = 0; j < nb; j++) {
        const x = tx + (rnd() - 0.5) * 0.2, z = tz + (rnd() - 0.5) * 0.2; const a = rnd() * 6.283;
        blade(x, heightAt(x, z) - 0.02, z, 0.16 + rnd() * 0.24, 0.026 + rnd() * 0.02, a, 0.1 + rnd() * 0.2, a + (rnd() - 0.5) * 2.4, cRoot, cTip, true);
      }
      if (kindR >= 0.985) { // dandelion: slim stem, yellow flower or white puffball
        const sh = 0.32 + rnd() * 0.16; const hx = tx + 0.03, hz = tz + 0.02, hy = ty + sh; const puff = rnd() < 0.5;
        blade(tx, ty, tz, sh, 0.009, 0.5, 0.07, 1.2, cRoot, new Color(0x6aa845));
        const hc = puff ? new Color(0xf4f2e4) : new Color(0xffd22e), hd = puff ? new Color(0xc9c8b6) : new Color(0xf0a41e), r = puff ? 0.055 : 0.045;
        const top: [number, number, number] = [hx, hy + r, hz], bot: [number, number, number] = [hx, hy - r * 0.4, hz];
        for (let q = 0; q < 6; q++) { const a1 = (q / 6) * 6.283, a2 = ((q + 1) / 6) * 6.283; tri(top, [hx + Math.cos(a1) * r, hy, hz + Math.sin(a1) * r], [hx + Math.cos(a2) * r, hy, hz + Math.sin(a2) * r], hc, hc.clone().multiplyScalar(0.92), hc.clone().multiplyScalar(0.92), 1); tri(bot, [hx + Math.cos(a2) * r, hy, hz + Math.sin(a2) * r], [hx + Math.cos(a1) * r, hy, hz + Math.sin(a1) * r], hd, hd, hd, 1); }
      }
    } else if (kindR < 0.82) {
      // tall tuft
      const nb = 6 + Math.floor(rnd() * 4); const tall = 0.85 + rnd() * 0.5;
      for (let j = 0; j < nb; j++) {
        const x = tx + (rnd() - 0.5) * 0.24, z = tz + (rnd() - 0.5) * 0.24; const a = rnd() * 6.283;
        blade(x, heightAt(x, z) - 0.02, z, (0.32 + rnd() * 0.36) * tall, 0.03 + rnd() * 0.022, a, 0.1 + rnd() * 0.24, a + (rnd() - 0.5) * 2.4, cRoot, cTip);
      }
    } else if (kindR < 0.89) {
      // tall tuft with seed heads
      for (let j = 0; j < 4; j++) {
        const x = tx + (rnd() - 0.5) * 0.18, z = tz + (rnd() - 0.5) * 0.18; const a = rnd() * 6.283;
        blade(x, heightAt(x, z) - 0.02, z, 0.42 + rnd() * 0.3, 0.032 + rnd() * 0.02, a, 0.1 + rnd() * 0.18, a + (rnd() - 0.5) * 2.4, cRoot, cTip);
      }
      for (let j = 0; j < 3; j++) {
        const sh = 0.7 + rnd() * 0.4; const a = rnd() * 6.283; const lean = 0.1 + rnd() * 0.14; const x = tx + (rnd() - 0.5) * 0.14, z = tz + (rnd() - 0.5) * 0.14;
        const gy = heightAt(x, z) - 0.02; const ex = x + Math.cos(a) * lean * sh, ez = z + Math.sin(a) * lean * sh;
        blade(x, gy, z, sh, 0.012, a + 1.57, lean, a, cRoot, new Color(0xa8b050));
        const gold = new Color(0xd8b858).lerp(new Color(0xf0dc80), rnd() * 0.5), goldD = gold.clone().multiplyScalar(0.78); const hy = gy + sh * 0.97, hh = 0.12;
        const bx = Math.cos(a + 1.57) * 0.017, bz = Math.sin(a + 1.57) * 0.017;
        tri([ex - bx, hy, ez - bz], [ex + bx, hy, ez + bz], [ex, hy + hh, ez], goldD, goldD, gold, 1);
        tri([ex - bz, hy + 0.02, ez + bx], [ex + bz, hy + 0.02, ez - bx], [ex, hy + hh * 0.92, ez], goldD, goldD, gold, 1);
      }
    } else {
      // clover patch: trefoils with the odd white blossom
      const cl = new Color(0x4fa645).lerp(lush, lushK * 0.4), clL = new Color(0x8fd860), clD = new Color(0x2f7a38);
      const np = 4 + Math.floor(rnd() * 3);
      for (let j = 0; j < np; j++) {
        const x = tx + (rnd() - 0.5) * 0.5, z = tz + (rnd() - 0.5) * 0.5; const gy = heightAt(x, z) + 0.025 + rnd() * 0.02; const a0 = rnd() * 6.283; const sc = 0.8 + rnd() * 0.5;
        for (let l = 0; l < 3; l++) {
          const a = a0 + (l / 3) * 6.283; const c1 = Math.cos(a), s1 = Math.sin(a), px = -s1, pz = c1;
          tri([x, gy, z], [x + c1 * 0.05 * sc + px * 0.034 * sc, gy + 0.012, z + s1 * 0.05 * sc + pz * 0.034 * sc], [x + c1 * 0.1 * sc, gy + 0.018, z + s1 * 0.1 * sc], clD, cl, clL, 0.1);
          tri([x, gy, z], [x + c1 * 0.1 * sc, gy + 0.018, z + s1 * 0.1 * sc], [x + c1 * 0.05 * sc - px * 0.034 * sc, gy + 0.012, z + s1 * 0.05 * sc - pz * 0.034 * sc], clD, clL, cl, 0.1);
        }
        if (rnd() < 0.35) { // a blossom on a short stem
          const bx = x + (rnd() - 0.5) * 0.08, bz = z + (rnd() - 0.5) * 0.08, by = gy + 0.12 + rnd() * 0.05; const bc = rnd() < 0.7 ? new Color(0xffffff) : new Color(0xf4b4d8);
          tmp2.copy(bc).multiplyScalar(0.85);
          blade(bx, gy, bz, by - gy, 0.007, 0.3, 0.02, 1, clD, new Color(0x6aa845));
          for (let q = 0; q < 5; q++) { const a1 = (q / 5) * 6.283, a2 = ((q + 1) / 5) * 6.283; tri([bx, by + 0.03, bz], [bx + Math.cos(a1) * 0.032, by, bz + Math.sin(a1) * 0.032], [bx + Math.cos(a2) * 0.032, by, bz + Math.sin(a2) * 0.032], bc, tmp2.clone(), tmp2.clone(), 0.9); }
        }
      }
    }
    count++; ends.push(idx.length);
  }
  if (!count) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('aBend', new BufferAttribute(new Float32Array(bend), 1)); g.setAttribute('aRise', new BufferAttribute(new Float32Array(rise), 1)); g.setIndex(idx);
  const normals = new Float32Array(pos.length); for (let i = 0; i < normals.length; i += 3) { normals[i + 1] = 1; } // all up: grass is lit like the ground
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.userData.ends = ends;
  g.computeBoundingSphere();
  return g;
}

/** A tall flower spike's stem (foxglove / lavender): slim, leaning, with two leaves at the foot. Buds are a separate, instance-coloured set. */
export function spikeStemGeometry(): BufferGeometry {
  const pb = part();
  sweep(pb, curvePath(V(0, 0, 0), V(0.03, 0.4, 0.01), V(0.02, 0.8, 0.0), 5, 0.014, 0.006, 1, 0x2f6a32, 0x6bb04a), 0xffffff, { radial: 4, ref: V(1, 0, 0) });
  for (const sd of [1, -1]) sweep(pb, curvePath(V(0, 0.02, 0), V(sd * 0.1, 0.12, 0.02), V(sd * 0.22, 0.08, 0.04), 4, 0.03, 0.004, 0.3, 0x3f8a3a, 0x7cc454), 0xffffff, { radial: 4, ref: V(0, 0, 1) });
  return pb.build();
}
/** The bells of a flower spike: a spiral of small buds shrinking towards the tip (white, tinted per instance). */
export function spikeBudsGeometry(): BufferGeometry {
  const pb = part();
  for (let i = 0; i < 9; i++) {
    const t = i / 8, y = 0.34 + t * 0.46, a = i * 2.4, r = 0.05 * (1 - t * 0.6);
    const bud = weld(new SphereGeometry(1, 5, 3)); bud.scale(r, r * 1.3, r); bud.translate(0.03 * t + Math.cos(a) * r * 0.9, y, Math.sin(a) * r * 0.9);
    pb.addGeometry(bud, null, i % 3 === 0 ? 0xffffff : 0xe2e2e2);
  }
  return pb.build();
}
