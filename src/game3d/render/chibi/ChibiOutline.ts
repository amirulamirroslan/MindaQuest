/**
 * A cartoon outline for the chibi hero (v2.9): the "inverted hull" trick. Every hero mesh gets a twin drawn back-faces-only, pushed a
 * couple of centimetres out along a SMOOTHED normal, in a dark warm brown. The hero then keeps a clean silhouette against busy grass
 * from the gameplay camera, with no post-processing pass (important on phones). The twin shares the original's skeleton, so it follows
 * every animation, and `sync` keeps it visible exactly when the original is.
 *
 * The kit is flat-shaded (split normals), so the twin's geometry is re-normalled with `toCreasedNormals(PI)`; with the kit's own normals
 * the shell would tear open at every hard edge.
 */
import { BackSide, Mesh, MeshBasicMaterial, SkinnedMesh, type BufferGeometry, type Object3D } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/** Outline thickness in kit units (the hero is drawn at 0.57x, so 0.026 is about 1.5 cm). */
export const OUTLINE_THICKNESS = 0.026;
export const OUTLINE_COLOUR = 0x2a1a10;

let shared: MeshBasicMaterial | null = null;
function outlineMaterial(): MeshBasicMaterial {
  if (shared) return shared;
  const m = new MeshBasicMaterial({ color: OUTLINE_COLOUR, side: BackSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uOutline = { value: OUTLINE_THICKNESS };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        #ifdef USE_SKINNING
          transformed += normalize(objectNormal) * uOutline;
        #else
          transformed += normalize(normal) * uOutline;
        #endif`);
  };
  m.customProgramCacheKey = () => 'chibi-outline';
  shared = m; return m;
}

export interface Outlined { source: Mesh; hull: Mesh }

/** Makes the twin of `mesh` (same parent, same transform, same skeleton). Returns null if the mesh cannot be outlined. */
export function makeOutline(mesh: Mesh): Outlined | null {
  const parent = mesh.parent as Object3D | null; if (!parent) return null;
  let geo: BufferGeometry;
  try { geo = toCreasedNormals(mesh.geometry, Math.PI); } catch { return null; }
  const skinned = (mesh as SkinnedMesh).isSkinnedMesh === true;
  let hull: Mesh;
  if (skinned) {
    const s = mesh as SkinnedMesh; const h = new SkinnedMesh(geo, outlineMaterial());
    h.bind(s.skeleton, s.bindMatrix); h.bindMode = s.bindMode; hull = h;
  } else hull = new Mesh(geo, outlineMaterial());
  hull.name = `${mesh.name}-outline`; hull.frustumCulled = false; hull.castShadow = false; hull.receiveShadow = false; hull.renderOrder = -1;
  hull.position.copy(mesh.position); hull.quaternion.copy(mesh.quaternion); hull.scale.copy(mesh.scale);
  hull.visible = mesh.visible;
  parent.add(hull);
  return { source: mesh, hull };
}

export const syncOutline = (o: Outlined, on: boolean): void => { o.hull.visible = on && o.source.visible; };
