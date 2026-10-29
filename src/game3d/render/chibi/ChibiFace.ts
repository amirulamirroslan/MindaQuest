/**
 * Face polish for the chibi hero (v2.9). The kit's faces are tiny flat dark discs, which read as a blank stare from the gameplay
 * camera. This adds, per head, a bigger glossy eye (dark ellipse, tinted iris, two sparkle highlights) and a soft blush on each cheek.
 * They are plain unlit decals parented to the head bone, so they follow every animation, and they hide with the head they belong to.
 *
 * All five kit heads share one face template (measured: both eyes sit at the same model-space spot on every head), so the eye
 * positions below are constants. The surface depth at each spot is read from the real head mesh, so decals never float or sink.
 */
import {
  Bone, CircleGeometry, Group, Material, Mesh, MeshBasicMaterial, Vector3, type SkinnedMesh,
} from 'three';

/** Model-space (kit units, before CHIBI_SCALE) eye centres, measured from the kit's heads. */
export const EYE_L = { x: -0.19, y: 1.58 };
export const EYE_R = { x: 0.21, y: 1.58 };

const circle = new CircleGeometry(1, 20);
/** A disc whose UVs all point at the palette's skin swatch (top-left cell), so drawn with the head's own material it is exactly skin-coloured and lit. */
const skinDisc = (): CircleGeometry => { const g = new CircleGeometry(1, 20); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.06, 0.06); return g; };
const skinGeo = skinDisc();
const mat = (color: number, opacity = 1): MeshBasicMaterial => new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

/** The highest z among head vertices near (x, y): the face surface depth there. */
export function surfaceZ(mesh: SkinnedMesh, x: number, y: number, radius: number): number {
  const v = new Vector3(); const n = mesh.geometry.attributes.position.count; let best = -Infinity;
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); if (Math.abs(v.x - x) < radius && Math.abs(v.y - y) < radius && v.z > best) best = v.z; }
  return best;
}

/** What `buildFace` hands back: the decal group plus the bits that change over time. */
export interface FaceRig {
  group: Group;
  /** Eyelids and lash lines (shown while blinking) and brow cover patches: they use the head's own material, so call `setSkin` whenever it changes. */
  skinParts: Mesh[];
  /** 0 = eyes open, 1 = closed. */
  blink(k: number): void;
  setSkin(m: Material): void;
}

/** A blink every few seconds (pure, tested): 0..1 closed-ness at game time `t`. */
export function blinkAt(t: number, period = 3.6, length = 0.16): number {
  const ph = ((t % period) + period) % period; if (ph > length) return 0;
  const x = ph / length; return Math.sin(x * Math.PI);
}

export interface FaceStyle { iris: number; blush: number }
export const DEFAULT_FACE: FaceStyle = { iris: 0x7a4a2a, blush: 0xff7f8e };

/** Builds the decals for one head mesh. Call once, with the model at its bind pose and world matrices up to date. */
export function buildFace(mesh: SkinnedMesh, headBone: Bone, style: FaceStyle = DEFAULT_FACE): FaceRig | null {
  const zEye = surfaceZ(mesh, 0.0, EYE_L.y, 0.5); if (!Number.isFinite(zEye)) return null;
  const g = new Group(); g.name = `${mesh.name}-face`;
  // the decals live in the head mesh's own coordinates, rigidly attached to the head bone
  g.matrixAutoUpdate = false;
  g.matrix.copy(headBone.matrixWorld).invert().multiply(mesh.matrixWorld);
  const lids: Mesh[] = [], lashes: Mesh[] = [], skinParts: Mesh[] = [];
  const add = (m: Mesh, order: number) => { m.renderOrder = order; m.castShadow = false; m.receiveShadow = false; g.add(m); return m; };
  for (const [side, eye] of [[-1, EYE_L], [1, EYE_R]] as const) {
    const z = surfaceZ(mesh, eye.x, eye.y, 0.07); if (!Number.isFinite(z)) continue;
    const zz = z + 0.012; const yaw = side * 0.22; // the face curves away from the middle
    const place = (m: Mesh, x: number, y: number, sx: number, sy: number, dz: number) => { m.position.set(x, y, zz + dz); m.scale.set(sx, sy, 1); m.rotation.y = yaw; return m; };
    add(place(new Mesh(circle, mat(0x16182e)), eye.x, eye.y, 0.082, 0.108, 0), 2);
    add(place(new Mesh(circle, mat(style.iris, 0.9)), eye.x, eye.y - 0.03, 0.062, 0.062, 0.003), 3);
    add(place(new Mesh(circle, mat(0x16182e)), eye.x, eye.y - 0.012, 0.034, 0.034, 0.005), 4);
    add(place(new Mesh(circle, mat(0xffffff)), eye.x - side * 0.026, eye.y + 0.04, 0.03, 0.034, 0.007), 5);
    add(place(new Mesh(circle, mat(0xffffff, 0.95)), eye.x + side * 0.03, eye.y - 0.04, 0.014, 0.014, 0.007), 5);
    const bx = eye.x + side * 0.08, by = eye.y - 0.17; const zb = surfaceZ(mesh, bx, by, 0.07);
    // v2.9b: the kit's brows are heavy and angled (stern). A skin-coloured patch covers them and a thin, gently arched brow replaces them.
    const brx = eye.x + side * -0.025, bry = 1.705; const zbr = surfaceZ(mesh, brx, bry, 0.06);
    if (Number.isFinite(zbr)) {
      const patch = new Mesh(skinGeo, mesh.material as Material); patch.position.set(brx, bry, zbr + 0.006); patch.scale.set(0.115, 0.058, 1); patch.rotation.y = yaw; skinParts.push(patch); add(patch, 6);
      const brow = new Mesh(circle, mat(0x4a2a1c, 0.92)); brow.position.set(brx, bry - 0.004, zbr + 0.012); brow.scale.set(0.075, 0.013, 1); brow.rotation.set(0, yaw, side * 0.07); add(brow, 7);
    }
    // blink: a skin-coloured lid over the eye plus a dark lash line
    const lid = new Mesh(skinGeo, mesh.material as Material); lid.position.set(eye.x, eye.y - 0.005, zz + 0.03); lid.scale.set(0.098, 0.124, 1); lid.rotation.y = yaw; lid.visible = false; skinParts.push(lid); lids.push(lid); add(lid, 8);
    const lash = new Mesh(circle, mat(0x2a1a14)); lash.position.set(eye.x, eye.y - 0.03, zz + 0.034); lash.scale.set(0.07, 0.01, 1); lash.rotation.set(0, yaw, side * 0.1); lash.visible = false; lashes.push(lash); add(lash, 9);
    if (Number.isFinite(zb)) { const b = new Mesh(circle, mat(style.blush, 0.38)); b.position.set(bx, by, zb + 0.01); b.scale.set(0.085, 0.05, 1); b.rotation.y = side * 0.5; add(b, 1); }
  }
  headBone.add(g);
  return {
    group: g, skinParts,
    blink(k: number) { const on = k > 0.45; for (const l of lids) l.visible = on; for (const l of lashes) l.visible = on; },
    setSkin(m: Material) { for (const p of skinParts) p.material = m; },
  };
}
