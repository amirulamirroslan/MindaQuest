/**
 * Rigid hero parts that ride on one bone each: head, face, hair, hood, pack, hands, sword, scabbard, and the wardrobe extras
 * (leaf crown, mossy cloak, glow lantern). Geometry is authored in the skeleton's rest-pose world space and then moved into
 * the bone's local space, so every piece sits exactly where it is drawn.
 */
import {
  BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Group, IcosahedronGeometry, Material, Matrix4, Mesh, OctahedronGeometry,
  PlaneGeometry, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector3, type Bone,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACE_PHI, FACE_THETA0, FACE_THETA_LEN } from './faceTextures';
import { PartBuilder, curvePath, lerp, smooth, sweep } from './geom';

/** `toNonIndexed` that tolerates geometry that is already non-indexed. */
const ni = (g: BufferGeometry): BufferGeometry => (g.index ? g.toNonIndexed() : g);

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const QI = new Quaternion();
const qAxis = (axis: Vector3, angle: number): Quaternion => new Quaternion().setFromAxisAngle(axis, angle);
const qEuler = (x: number, y: number, z: number): Quaternion => new Quaternion().setFromEuler(new Euler(x, y, z));

export interface PropCtx {
  bone(name: string): Bone;
  /** Moves rest-pose world geometry into the local space of `bone`. */
  toBone(g: BufferGeometry, bone: Bone): BufferGeometry;
  mats: {
    hair: Material; hood: Material; skin: Material; pack: Material; belt: Material; trim: Material; blade: Material; gem: Material; leaf: Material;
    glass: Material; cloak: Material; face: Material;
  };
}

/** A colour attribute so a geometry can share the vertex-coloured group materials. */
export function paint(g: BufferGeometry, hex: number): BufferGeometry {
  const n = g.getAttribute('position').count; const c = new Color(hex); const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new BufferAttribute(a, 3));
  return g;
}
const mk = (g: BufferGeometry, m: Material): Mesh => { const o = new Mesh(g, m); o.frustumCulled = false; return o; };

// ---------------------------------------------------------------- head

/** Head ellipsoid in rest-pose world space (the Head bone sits at the base of the skull). */
export const HEAD = { c: V(0, 1.667, 0.012), r: V(0.098, 0.112, 0.105) };
/** Point on the head surface in a direction: azimuth 0 = front, + toward the character's left; elevation 0 = eye level. */
export function headPoint(az: number, el: number, k = 1): Vector3 {
  const dx = Math.sin(az) * Math.cos(el), dy = Math.sin(el), dz = Math.cos(az) * Math.cos(el);
  const jaw = headJaw(dy);
  return V(HEAD.c.x + HEAD.r.x * k * dx * jaw, HEAD.c.y + HEAD.r.y * k * dy, HEAD.c.z + HEAD.r.z * k * dz * jaw);
}
/** The chin tapers and the cheeks stay full: a gentle rounded jaw. */
function headJaw(ny: number): number { return ny < 0 ? lerp(1, 0.8, smooth(-ny * 1.15)) : 1; }

function headGeometry(): BufferGeometry {
  const g = new SphereGeometry(1, 32, 22);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i); const jaw = headJaw(dy);
    // slightly flatter back of the head and a soft brow
    const back = dz < 0 ? 1 - 0.05 * smooth(-dz) : 1;
    p.setXYZ(i, HEAD.c.x + HEAD.r.x * dx * jaw, HEAD.c.y + HEAD.r.y * dy, HEAD.c.z + HEAD.r.z * dz * jaw * back);
  }
  g.computeVertexNormals();
  return g;
}

function faceDecalGeometry(): BufferGeometry {
  const g = new SphereGeometry(1, 24, 20, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_THETA0, FACE_THETA_LEN);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i); const jaw = headJaw(dy);
    p.setXYZ(i, HEAD.c.x + HEAD.r.x * 1.006 * dx * jaw, HEAD.c.y + HEAD.r.y * 1.004 * dy, HEAD.c.z + HEAD.r.z * 1.006 * dz * jaw);
  }
  g.computeVertexNormals();
  return g;
}

export interface HeadParts { group: Group; facePlane: Mesh; hairTail: Group; hairTailPivot: Vector3; scarfPivot: Group | null }

export function buildHead(ctx: PropCtx, part: (hex?: number) => PartBuilder): HeadParts {
  const head = ctx.bone('Head');
  const group = new Group(); group.name = 'head-parts';
  // skull
  group.add(mk(ctx.toBone(paint(headGeometry(), 0xffffff), head), ctx.mats.skin));
  // face decal
  const decal = mk(ctx.toBone(faceDecalGeometry(), head), ctx.mats.face); decal.renderOrder = 3; group.add(decal);
  // nose and ears (skin)
  const bits = part();
  bits.addGeometry(new SphereGeometry(1, 10, 8), new Matrix4().compose(headPoint(0, -0.16, 1.02).add(V(0, 0, 0.004)), QI, V(0.013, 0.012, 0.014)), 0xffffff);
  for (const s of [1, -1]) {
    const ear = new Matrix4().compose(V(s * 0.099, 1.655, 0.006), qAxis(V(0, 0, 1), -s * 0.35), V(0.012, 0.034, 0.02));
    bits.addGeometry(new SphereGeometry(1, 10, 8), ear, 0xffffff);
    const tip = new Matrix4().compose(V(s * 0.108, 1.682, 0.004), qAxis(V(0, 0, 1), -s * 1.0), V(0.007, 0.03, 0.012));
    bits.addGeometry(new SphereGeometry(1, 8, 6), tip, 0xffffff);
  }
  group.add(mk(ctx.toBone(bits.build(), head), ctx.mats.skin));

  // ---- hair ----
  const hair = part(); // static
  const noise = (a: number, b: number) => Math.sin(a * 5.1 + b * 3.7) * 0.5 + Math.sin(a * 11.3 - b * 6.1) * 0.3 + Math.sin(a * 2.3 + b * 9.1) * 0.2;
  // cap: a grid from the crown down to an irregular hairline (low at the back, high at the brow, above the ears at the sides)
  const nPhi = 36, nPol = 12; const idx: number[] = [];
  const base = hair.vertexCount; const col = new Color();
  for (let i = 0; i < nPhi; i++) {
    const az = (i / nPhi) * Math.PI * 2;
    const f = Math.pow(Math.max(0, Math.cos(az)), 1.2), back = Math.pow(Math.max(0, -Math.cos(az)), 1.2);
    const polMax = lerp(lerp(1.52, 1.0, f), 1.98, back);
    for (let j = 0; j <= nPol; j++) {
      const pol = (j / nPol) * polMax; const el = Math.PI / 2 - pol;
      const clump = noise(az, pol) * 0.028 * smooth(pol / 0.5);
      const rim = j === nPol ? 0.012 : 0;
      const k = 1.075 + clump + (pol < 0.35 ? 0.012 : 0) + rim;
      const shade = lerp(1.18, 0.78, smooth(pol / 2.0)) * (1 + noise(az * 1.7, pol * 2) * 0.07);
      col.setRGB(shade, shade, shade);
      hair.addVertex(headPoint(az, el, k), col, undefined);
    }
  }
  for (let i = 0; i < nPhi; i++) for (let j = 0; j < nPol; j++) {
    const i2 = (i + 1) % nPhi; const a = base + i * (nPol + 1) + j, b = base + i2 * (nPol + 1) + j;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  for (let t = 0; t < idx.length; t += 3) hair.addTri(idx[t], idx[t + 1], idx[t + 2]);

  const lock = (a: Vector3, b: Vector3, c: Vector3, r0: number, tintA = 0xffffff, tintB = 0xbfbfbf, flat = 0.4, n = 9) => {
    sweep(hair, curvePath(a, b, c, n, r0, 0.003, flat, tintA, tintB), 0xffffff, { radial: 6, ref: V(0, 1, 0), capStart: 'round', capEnd: 'round' });
  };
  // swept fringe over the brow
  for (let i = 0; i < 7; i++) {
    const u = (i / 6) * 2 - 1;
    lock(headPoint(u * 0.35, 1.28, 1.1), headPoint(u * 0.65 + 0.1, 0.92, 1.24), headPoint(u * 0.82 + 0.34, 0.36 - Math.abs(u) * 0.1, 1.07), 0.034 - Math.abs(u) * 0.005, 0xf0f0f0, 0xc8c8c8);
  }
  // side locks in front of the ears
  for (const s of [1, -1]) {
    lock(headPoint(s * 1.2, 0.95, 1.1), headPoint(s * 1.45, 0.35, 1.2), headPoint(s * 1.55, -0.42, 1.1), 0.034, 0xe8e8e8, 0xb0b0b0, 0.5);
    lock(headPoint(s * 0.98, 0.9, 1.1), headPoint(s * 1.12, 0.4, 1.17), headPoint(s * 1.2, -0.05, 1.08), 0.026, 0xf0f0f0, 0xc0c0c0, 0.45, 7);
  }
  // ahoge: one cheeky tuft at the crown
  lock(headPoint(0.1, 1.42, 1.06), headPoint(0.15, 1.5, 1.42), headPoint(0.55, 1.2, 1.5), 0.016, 0xffffff, 0xffffff, 0.8, 8);
  group.add(mk(ctx.toBone(hair.build(), head), ctx.mats.hair));

  // short tail at the back that swings when the hero moves (pivot at the nape)
  const tailPivot = headPoint(Math.PI, 0.35, 1.0);
  const tailPart = part();
  for (const [dz, dx] of [[0, 0], [0, 0.55], [0, -0.55]] as const) {
    const a = headPoint(Math.PI + dx * 0.4, 0.3, 1.04), b = headPoint(Math.PI + dx * 0.75, -0.1, 1.62), c = headPoint(Math.PI + dx * 1.3 + dz, -0.85, 1.5);
    sweep(tailPart, curvePath(a.clone().sub(tailPivot), b.clone().sub(tailPivot), c.clone().sub(tailPivot), 10, dx === 0 ? 0.05 : 0.036, 0.004, 0.55, 0xf4f4f4, 0xb4b4b4), 0xffffff, { radial: 7, ref: V(1, 0, 0), capStart: 'round', capEnd: 'round' });
  }
  const tailGeo = tailPart.build();
  const hairTail = new Group(); hairTail.add(mk(tailGeo, ctx.mats.hair));
  // the pivot group lives on the Head bone; its own position is the pivot in head-local space
  const tailLocal = tailPivot.clone().applyMatrix4(new Matrix4().copy(head.matrixWorld).invert());
  hairTail.position.copy(tailLocal);
  hairTail.quaternion.copy(head.getWorldQuaternion(new Quaternion()).invert());
  group.add(hairTail);

  return { group, facePlane: decal, hairTail, hairTailPivot: tailPivot, scarfPivot: null };
}


// ---------------------------------------------------------------- hood, pack, belt gear

export function buildHoodAndScarf(ctx: PropCtx, part: () => PartBuilder): { group: Group; scarf: Group; scarfPivotWorld: Vector3 } {
  const spine = ctx.bone('spine_03'); const group = new Group();
  const hood = part();
  // collar: a thick rolled cowl around the base of the neck
  hood.addGeometry(new TorusGeometry(0.083, 0.032, 10, 28), new Matrix4().compose(V(0, 1.455, -0.012), qAxis(V(1, 0, 0), Math.PI / 2 - 0.12), V(1, 1.05, 0.9)), 0xf0f0f0);
  // hood shell resting on the back of the shoulders: a open bowl (back half of a sphere)
  const shell = new SphereGeometry(1, 24, 14, Math.PI * 1.03, Math.PI * 0.94, 0.55, 1.5);
  hood.addGeometry(shell, new Matrix4().compose(V(0, 1.488, -0.078), qAxis(V(1, 0, 0), 0.32), V(0.118, 0.11, 0.125)), 0xe8e8e8);
  // pointed tip hanging down the back
  hood.addGeometry(new ConeGeometry(0.052, 0.2, 10, 1), new Matrix4().compose(V(0, 1.385, -0.19), qAxis(V(1, 0, 0), -2.7), V(1, 1, 0.8)), 0xd8d8d8);
  group.add(mk(ctx.toBone(hood.build(), spine), ctx.mats.hood));
  // scarf tail: a long ribbon (gold-trimmed) that trails behind
  const scarfPivotWorld = V(0.06, 1.44, -0.07);
  const scarfPart = part();
  const a = V(0, 0, 0), b = V(0.03, -0.06, -0.16), c = V(0.07, -0.3, -0.24);
  sweep(scarfPart, curvePath(a, b, c, 12, 0.05, 0.034, 0.16, 0xf0f0f0, 0xc8c8c8), 0xffffff, { radial: 6, ref: V(1, 0, 0), capEnd: 'flat' });
  const scarf = new Group(); scarf.add(mk(scarfPart.build(), ctx.mats.hood));
  const local = scarfPivotWorld.clone().applyMatrix4(new Matrix4().copy(spine.matrixWorld).invert());
  scarf.position.copy(local); scarf.quaternion.copy(spine.getWorldQuaternion(new Quaternion()).invert());
  group.add(scarf);
  return { group, scarf, scarfPivotWorld };
}

export function buildPack(ctx: PropCtx, part: () => PartBuilder): Group {
  const spine = ctx.bone('spine_03'); const group = new Group();
  const pack = part();
  const rb = (w: number, h: number, d: number, r: number, x: number, y: number, z: number, tint: number, rx = 0) =>
    pack.addGeometry(new RoundedBoxGeometry(w, h, d, 3, r), new Matrix4().compose(V(x, y, z), qAxis(V(1, 0, 0), rx), V(1, 1, 1)), tint);
  rb(0.27, 0.3, 0.13, 0.04, 0, 1.22, -0.19, 0xffffff);
  rb(0.285, 0.13, 0.145, 0.045, 0, 1.335, -0.193, 0xf2f2f2, -0.12); // flap
  rb(0.1, 0.1, 0.05, 0.02, 0, 1.17, -0.268, 0xdcdcdc); // front pocket
  // bedroll on top
  pack.addGeometry(new CylinderGeometry(0.052, 0.052, 0.34, 14), new Matrix4().compose(V(0, 1.425, -0.2), qAxis(V(0, 0, 1), Math.PI / 2), V(1, 1, 1)), 0xd8d8d8);
  group.add(mk(ctx.toBone(pack.build(), spine), ctx.mats.pack));
  // gold buckles
  const trim = part();
  for (const x of [-0.07, 0.07]) trim.addGeometry(new RoundedBoxGeometry(0.03, 0.036, 0.012, 2, 0.006), new Matrix4().makeTranslation(x, 1.325, -0.272), 0xffffff);
  trim.addGeometry(new TorusGeometry(0.053, 0.007, 6, 16), new Matrix4().compose(V(-0.09, 1.425, -0.2), qAxis(V(0, 1, 0), Math.PI / 2), V(1, 1, 1)), 0xffffff);
  trim.addGeometry(new TorusGeometry(0.053, 0.007, 6, 16), new Matrix4().compose(V(0.09, 1.425, -0.2), qAxis(V(0, 1, 0), Math.PI / 2), V(1, 1, 1)), 0xffffff);
  group.add(mk(ctx.toBone(trim.build(), spine), ctx.mats.trim));
  return group;
}

export function buildHipGear(ctx: PropCtx, part: () => PartBuilder): Group {
  const pelvis = ctx.bone('pelvis'); const group = new Group();
  const leather = part(), gold = part();
  // pouch on the right hip, buckle at the front
  leather.addGeometry(new RoundedBoxGeometry(0.085, 0.095, 0.06, 3, 0.02), new Matrix4().makeTranslation(-0.135, 0.985, 0.0), 0xffffff);
  leather.addGeometry(new RoundedBoxGeometry(0.092, 0.04, 0.066, 3, 0.016), new Matrix4().compose(V(-0.135, 1.03, 0.0), qAxis(V(0, 0, 1), 0.1), V(1, 1, 1)), 0xe6e6e6);
  gold.addGeometry(new RoundedBoxGeometry(0.05, 0.048, 0.014, 2, 0.008), new Matrix4().makeTranslation(0, 1.06, 0.117), 0xffffff);
  gold.addGeometry(new SphereGeometry(0.009, 8, 6), new Matrix4().makeTranslation(-0.135, 1.0, 0.032), 0xffffff);
  group.add(mk(ctx.toBone(leather.build(), pelvis), ctx.mats.belt));
  group.add(mk(ctx.toBone(gold.build(), pelvis), ctx.mats.trim));
  return group;
}

/** Hands: a rounded fist with a thumb, and a leather pauldron on the left shoulder. */
export function buildHands(ctx: PropCtx, part: () => PartBuilder): Group {
  const group = new Group();
  for (const side of ['l', 'r'] as const) {
    const s = side === 'l' ? 1 : -1; const bone = ctx.bone(`hand_${side}`);
    const fist = part();
    fist.addGeometry(new SphereGeometry(1, 14, 10), new Matrix4().compose(V(s * 0.775, 1.436, -0.066), QI, V(0.052, 0.04, 0.043)), 0xffffff);
    fist.addGeometry(new SphereGeometry(1, 10, 8), new Matrix4().compose(V(s * 0.768, 1.41, -0.036), qAxis(V(0, 0, 1), -s * 0.5), V(0.026, 0.017, 0.017)), 0xf2f2f2);
    bone.add(mk(ctx.toBone(fist.build(), bone), ctx.mats.skin));
  }
  const ua = ctx.bone('upperarm_l');
  const pad = part(), rim = part();
  pad.addGeometry(new SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new Matrix4().compose(V(0.2, 1.462, -0.065), qAxis(V(0, 0, 1), -0.35), V(0.088, 0.062, 0.092)), 0xffffff);
  rim.addGeometry(new TorusGeometry(1, 0.075, 6, 28), new Matrix4().compose(V(0.2 + 0.0, 1.462 - 0.012, -0.065), qEuler(Math.PI / 2, 0, -0.35), V(0.088, 0.092, 0.2 * 0 + 0.25)), 0xffffff);
  ua.add(mk(ctx.toBone(pad.build(), ua), ctx.mats.belt));
  ua.add(mk(ctx.toBone(rim.build(), ua), ctx.mats.trim));
  return group;
}

// ---------------------------------------------------------------- sword

/** A one-handed arming sword with a leaf blade, winged guard, wrapped grip and a glowing gem. Authored with the grip at the origin and the blade along +Y. */
export function buildSword(ctx: PropCtx): Group {
  const g = new Group();
  const blade = new Shape();
  blade.moveTo(-0.023, 0.062); blade.lineTo(0.023, 0.062); blade.lineTo(0.026, 0.28); blade.quadraticCurveTo(0.024, 0.5, 0.0, 0.66); blade.quadraticCurveTo(-0.024, 0.5, -0.026, 0.28); blade.closePath();
  const bg = new ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
  bg.translate(0, 0, -0.003);
  const fuller = new Shape(); fuller.moveTo(-0.006, 0.09); fuller.lineTo(0.006, 0.09); fuller.lineTo(0.005, 0.5); fuller.lineTo(0, 0.55); fuller.lineTo(-0.005, 0.5); fuller.closePath();
  const fg = new ExtrudeGeometry(fuller, { depth: 0.004, bevelEnabled: false }); fg.translate(0, 0, -0.002 - 0.0065);
  const fg2 = fg.clone(); fg2.translate(0, 0, 0.013);
  const bladeGeo = mergeGeometries([paint(bg, 0xffffff), paint(fg, 0x9aa4ac), paint(fg2, 0x9aa4ac)].map(x => ni(x)), false)!;
  g.add(mk(bladeGeo, ctx.mats.blade));
  // guard: a swept crossguard with upturned wings
  const gs = new Shape();
  gs.moveTo(-0.07, 0.085); gs.quadraticCurveTo(-0.055, 0.055, -0.02, 0.058); gs.lineTo(0.02, 0.058); gs.quadraticCurveTo(0.055, 0.055, 0.07, 0.085);
  gs.quadraticCurveTo(0.052, 0.07, 0.02, 0.07); gs.lineTo(-0.02, 0.07); gs.quadraticCurveTo(-0.052, 0.07, -0.07, 0.085);
  const gg = new ExtrudeGeometry(gs, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2 }); gg.translate(0, 0, -0.011);
  const parts: BufferGeometry[] = [ni(paint(gg, 0xffffff))];
  const pommel = new SphereGeometry(0.02, 12, 10); pommel.translate(0, -0.082, 0); parts.push(ni(paint(pommel, 0xffffff)));
  for (const y of [0.0, 0.034, -0.034]) { const ring = new TorusGeometry(0.0155, 0.003, 5, 12); ring.rotateX(Math.PI / 2); ring.translate(0, y, 0); parts.push(ni(paint(ring, 0xffffff))); }
  g.add(mk(mergeGeometries(parts, false)!, ctx.mats.trim));
  const grip = new CylinderGeometry(0.0135, 0.0135, 0.12, 10); grip.translate(0, -0.005, 0);
  g.add(mk(paint(grip, 0xffffff), ctx.mats.belt));
  const gem = new OctahedronGeometry(0.012, 0); gem.scale(1, 1.4, 1); gem.translate(0, 0.0, 0.0);
  const gemMesh = mk(gem, ctx.mats.gem); gemMesh.position.set(0, -0.082, 0.0155); gemMesh.name = 'sword-gem'; g.add(gemMesh);
  return g;
}

/** Leather scabbard on the left hip: a gold-capped sheath hanging diagonally behind the leg. Returns the group and the transform for a sheathed sword. */
export function buildScabbard(ctx: PropCtx, part: () => PartBuilder): { group: Group; swordPos: Vector3; swordQuat: Quaternion } {
  const pelvis = ctx.bone('pelvis'); const group = new Group();
  const leather = part(), gold = part();
  const top = V(0.14, 1.0, -0.045), bottom = V(0.185, 0.46, -0.215);
  const dir = bottom.clone().sub(top).normalize();
  const rings = [0, 0.15, 0.5, 0.88, 1].map((t, i) => ({ p: top.clone().lerp(bottom, lerp(0.12, 1, t)), rA: [0.03, 0.03, 0.03, 0.028, 0.02][i], rB: [0.012, 0.0125, 0.0125, 0.012, 0.01][i], tint: 0xffffff }));
  sweep(leather, rings, 0xffffff, { radial: 8, ref: V(1, 0, 0), capEnd: 'round' });
  const mouth = top.clone().lerp(bottom, 0.12);
  sweep(gold, [{ p: mouth.clone(), rA: 0.034, rB: 0.016, tint: 0xffffff }, { p: mouth.clone().addScaledVector(dir, 0.035), rA: 0.033, rB: 0.015, tint: 0xffffff }], 0xffffff, { radial: 8, ref: V(1, 0, 0) });
  sweep(gold, [{ p: bottom.clone().addScaledVector(dir, -0.05), rA: 0.025, rB: 0.013, tint: 0xffffff }, { p: bottom.clone(), rA: 0.02, rB: 0.011, tint: 0xffffff }], 0xffffff, { radial: 8, ref: V(1, 0, 0), capEnd: 'round' });
  group.add(mk(ctx.toBone(leather.build(), pelvis), ctx.mats.belt));
  group.add(mk(ctx.toBone(gold.build(), pelvis), ctx.mats.trim));
  // the guard (sword y = 0.07) sits at the scabbard mouth and the blade runs down inside it
  const q = new Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  const swordPos = mouth.clone().addScaledVector(dir, -0.075);
  return { group, swordPos, swordQuat: q };
}

// ---------------------------------------------------------------- wardrobe extras

export function buildLeafCrown(ctx: PropCtx): Group {
  const head = ctx.bone('Head'); const g = new Group();
  const leaves: BufferGeometry[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2;
    const el = 0.62 + (i % 2) * 0.06;
    const p = headPoint(az, el, 1.1);
    const leaf = new SphereGeometry(1, 8, 6); leaf.scale(0.014, 0.012, 0.045);
    const out = headPoint(az, el, 1).sub(HEAD.c).normalize();
    const rot = new Matrix4().lookAt(V(0, 0, 0), out, V(0, 1, 0));
    leaf.applyMatrix4(new Matrix4().makeTranslation(p.x, p.y, p.z).multiply(rot).multiply(new Matrix4().makeRotationX(-0.5 + (i % 3) * 0.15)));
    leaves.push(ni(paint(leaf, i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xcfe6a8 : 0xa8d078)));
  }
  const flowers: BufferGeometry[] = [];
  for (const [az, c] of [[0.3, 0xffd6ea], [2.3, 0xfff1a8], [4.2, 0xffffff]] as const) {
    const p = headPoint(az, 0.7, 1.12);
    const f = new IcosahedronGeometry(0.015, 0); f.translate(p.x, p.y, p.z); flowers.push(ni(paint(f, c)));
  }
  const twig = new TorusGeometry(1, 0.012, 5, 28); twig.rotateX(Math.PI / 2);
  const tp = headPoint(0, 0.6, 1.07); twig.scale(HEAD.r.x * 1.07, HEAD.r.z * 1.07, 1); // (x,y→ ring in XZ after rotate)
  // Torus lies in XY before rotation; after rotateX it lies in XZ with scale applied on x,y (y becomes z).
  twig.translate(HEAD.c.x, tp.y, HEAD.c.z);
  const wood = paint(ni(twig), 0x6b4a2e);
  const leafMesh = mk(ctx.toBone(mergeGeometries(leaves, false)!, head), ctx.mats.leaf);
  g.add(leafMesh, mk(ctx.toBone(wood, head), ctx.mats.trim));
  g.add(mk(ctx.toBone(mergeGeometries(flowers, false)!, head), ctx.mats.gem));
  return g;
}

/** A mossy cloak hanging from the shoulders; its vertices are animated by `updateCloak`. */
export interface Cloak { group: Group; geo: BufferGeometry; rest: Float32Array; pivot: Group }
export function buildCloak(ctx: PropCtx): Cloak {
  const spine = ctx.bone('spine_03');
  const w = 0.42, h = 0.78; const sx = 8, sy = 10;
  const geo = new PlaneGeometry(w, h, sx, sy);
  const p = geo.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i); const t = (0.5 - y / h); // 0 at the neck, 1 at the hem
    const wrap = Math.cos((x / (w / 2)) * 0.9) * 0.05 - 0.05; // curves round the shoulders
    const z = -0.1 - t * 0.12 + wrap + Math.sin(x * 26 + t * 2) * 0.012 * t;
    const flare = 1 + t * 0.35;
    p.setXYZ(i, x * flare, 1.46 - t * h, z);
    const edge = Math.min(1, Math.max(0, (t - 0.82) / 0.18)); const moss = edge * (0.6 + 0.4 * Math.sin(x * 40));
    const c = new Color(0xffffff).lerp(new Color(0xb9e08a), Math.max(0, Math.min(1, moss))); const shade = 1 - t * 0.12;
    col[i * 3] = c.r * shade; col[i * 3 + 1] = c.g * shade; col[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const rest = new Float32Array(p.array as Float32Array);
  const pivot = new Group();
  const local = V(0, 1.46, -0.1).applyMatrix4(new Matrix4().copy(spine.matrixWorld).invert());
  pivot.position.copy(local); pivot.quaternion.copy(spine.getWorldQuaternion(new Quaternion()).invert());
  // rest positions are in rest-world space; shift them into the pivot's frame
  const shift = V(0, 1.46, -0.1);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, rest[i * 3] - shift.x, rest[i * 3 + 1] - shift.y, rest[i * 3 + 2] - shift.z);
  const restLocal = new Float32Array(p.array as Float32Array);
  const mesh = mk(geo, ctx.mats.cloak); (mesh.material as Material).side = 2;
  pivot.add(mesh);
  // clasp: a gold ring with a leaf
  const clasp = new Group();
  const gold = new TorusGeometry(0.02, 0.006, 6, 14); gold.translate(0, 1.455, 0.085);
  const leaf = new SphereGeometry(1, 8, 6); leaf.scale(0.012, 0.03, 0.01); leaf.translate(0.02, 1.43, 0.095);
  clasp.add(mk(ctx.toBone(paint(gold, 0xffffff), spine), ctx.mats.trim), mk(ctx.toBone(paint(leaf, 0xffffff), spine), ctx.mats.leaf));
  const group = new Group(); group.add(pivot, clasp);
  return { group, geo, rest: restLocal, pivot };
}

export function buildLantern(ctx: PropCtx): { group: Group; glass: Mesh } {
  const hand = ctx.bone('hand_l'); const group = new Group();
  const metal = []; const c = V(0.79, 1.31, -0.06);
  const body = new CylinderGeometry(0.036, 0.036, 0.1, 8, 1, true); body.translate(c.x, c.y - 0.06, c.z);
  const cap = new ConeGeometry(0.05, 0.05, 8); cap.translate(c.x, c.y + 0.012, c.z);
  const base = new CylinderGeometry(0.04, 0.034, 0.016, 8); base.translate(c.x, c.y - 0.118, c.z);
  const ring = new TorusGeometry(0.02, 0.004, 5, 12); ring.translate(c.x, c.y + 0.052, c.z);
  metal.push(ni(paint(cap, 0xffffff)), ni(paint(base, 0xffffff)), ni(paint(ring, 0xffffff)));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const bar = new CylinderGeometry(0.0035, 0.0035, 0.1, 4); bar.translate(c.x + Math.cos(a) * 0.037, c.y - 0.06, c.z + Math.sin(a) * 0.037); metal.push(ni(paint(bar, 0xffffff))); }
  group.add(mk(ctx.toBone(mergeGeometries(metal, false)!, hand), ctx.mats.trim));
  const core = new SphereGeometry(0.03, 10, 8); core.translate(c.x, c.y - 0.062, c.z);
  const glass = mk(ctx.toBone(core, hand), ctx.mats.glass); group.add(glass);
  return { group, glass };
}
