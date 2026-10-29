import {
  AdditiveBlending, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Sprite, SpriteMaterial, SRGBColorSpace,
  type BufferGeometry, type Material,
} from 'three';

/** Flat-shaded low-poly material. Lambert is the cheapest lit material, which matters on phones. */
export const lambert = (color: number, emissive = 0x000000): MeshLambertMaterial =>
  new MeshLambertMaterial({ color, flatShading: true, emissive });

export function mesh<G extends BufferGeometry, M extends Material>(g: G, m: M, x = 0, y = 0, z = 0): Mesh<G, M> {
  const o = new Mesh(g, m); o.position.set(x, y, z); return o;
}

let glowTex: CanvasTexture | null = null;
/** Soft round glow, generated once in code (no image file). */
export function glowTexture(): CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  glowTex = new CanvasTexture(c); glowTex.colorSpace = SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color: number, size: number, opacity = 0.9): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

/** Dark soft disc under a character (a cheap stand-in for real shadows). */
let blobTex: CanvasTexture | null = null;
export function blobShadow(radius: number): Mesh {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.3)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    blobTex = new CanvasTexture(c);
  }
  const m = new Mesh(new PlaneGeometry(radius * 2, radius * 2), new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}

export const tint = (hex: number, k: number): number => {
  const c = new Color(hex); c.multiplyScalar(k); return c.getHex();
};

export function disposeTree(g: Group): void {
  g.traverse(o => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose();
  });
}

/** Lets every mesh under `root` cast a real shadow (not the glow sprites or additive effects). */
export function castShadows(root: Group, skipName = ''): void {
  root.traverse(o => {
    const m = o as Mesh;
    if (!m.isMesh || m.name === skipName + '-fx' || m.name.endsWith('-outline')) return;
    const mat = m.material as Material;
    if (mat && (mat as Material).transparent && (mat as MeshBasicMaterial).blending === AdditiveBlending) return;
    m.castShadow = true;
  });
}
