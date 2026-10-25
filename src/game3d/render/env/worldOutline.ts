/**
 * v2.13: the same cartoon outline the chibi hero has (an inverted hull: a back-faces-only twin pushed out along a smoothed normal),
 * for the world's landmarks: houses, the well, lamp posts, the gate and the tent. Trees, bushes and grass stay unoutlined on purpose
 * (a dense forest of outlines would be noisy, and it would cost far too much on a phone). The twin is a child of the mesh, so it
 * follows every transform; it casts no shadow and shares one material.
 */
import { BackSide, Mesh, MeshBasicMaterial, type BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/** Thickness in metres (about 4 cm: visible as a clean line from the game camera, thin up close). */
export const WORLD_OUTLINE_THICKNESS = 0.042;
export const WORLD_OUTLINE_COLOUR = 0x2f2218;

const mats = new Map<number, MeshBasicMaterial>();
function worldOutlineMaterial(thickness: number): MeshBasicMaterial {
  const have = mats.get(thickness); if (have) return have;
  const m = new MeshBasicMaterial({ color: WORLD_OUTLINE_COLOUR, side: BackSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uOutline = { value: thickness };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
  };
  m.customProgramCacheKey = () => `world-outline-${thickness}`;
  mats.set(thickness, m); return m;
}

const creased = new WeakMap<BufferGeometry, BufferGeometry>();
/** Adds an outline twin to `mesh` (once per geometry the smoothed copy is shared). Returns the twin, or null if it cannot be made. */
export function addWorldOutline(mesh: Mesh, thickness = WORLD_OUTLINE_THICKNESS): Mesh | null {
  let geo = creased.get(mesh.geometry);
  if (!geo) { try { geo = toCreasedNormals(mesh.geometry, Math.PI); } catch { return null; } creased.set(mesh.geometry, geo); }
  const hull = new Mesh(geo, worldOutlineMaterial(thickness));
  hull.name = `${mesh.name}-outline`; hull.castShadow = false; hull.receiveShadow = false; hull.renderOrder = -1;
  mesh.add(hull); return hull;
}
