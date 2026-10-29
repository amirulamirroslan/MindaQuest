/**
 * Shoe shapes for the chibi hero (v2.10). The kit's boots are painted into the legs mesh, so a new SHAPE cannot be swapped in; instead a
 * style adds small code-made pieces (a cuff, fur, leaf wraps, a toe cap, a curled toe) on top of the kit boot, attached to the ankle
 * (`foot`) and ball-of-foot (`toes`) bones so they follow every animation. Built in kit units, placed from the bones' own rest
 * positions (so nothing here hard-codes the skeleton), and tinted with the wardrobe's boot colour. No image files.
 */
import type { ShoeProp } from '../../cosmetics/catalog';
import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';

export type { ShoeProp };
export const SHOE_PROPS: readonly ShoeProp[] = ['shoe-trail', 'shoe-cuff', 'shoe-fur', 'shoe-leaf', 'shoe-guard', 'shoe-moon'];
export const isShoeProp = (p: string | undefined): p is ShoeProp => !!p && (SHOE_PROPS as readonly string[]).includes(p);

/** Where the foot is, in the kit's own units (the glTF scene space, before the hero's scale). */
export interface FootAnchors { ankle: Vector3; toe: Vector3 }
/** The pieces of one shoe: the ones that ride the ankle bone and the ones that ride the toes bone. Positions are already absolute in kit space. */
export interface ShoeParts { ankle: Group | null; toes: Group | null }

/** The kit boot's own tan, used for pieces that match the boot when no boot colour is picked. */
export const BOOT_TAN = 0xb5703a;
/** The pieces are authored at a small size; the chibi boot is chunkier, so each group is enlarged about its own bone origin. */
export const SHOE_SCALE = 1.35;
export const SHOE_TINT_KEY = 'mqShoeTint';

const mat = (color: number, opts: { tint?: boolean; metal?: number; rough?: number; emissive?: number } = {}): MeshStandardMaterial => {
  const m = new MeshStandardMaterial({ color, roughness: opts.rough ?? 0.78, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissive ? 0.5 : 0 });
  if (opts.tint) m.userData[SHOE_TINT_KEY] = true;
  return m;
};
const mesh = (g: ConstructorParameters<typeof Mesh>[0], m: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh => {
  const o = new Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o;
};
/** A flat ring around the ankle (its axis is the leg's vertical axis). */
const ring = (r: number, tube: number, m: MeshStandardMaterial, y = 0): Mesh => { const t = mesh(new TorusGeometry(r, tube, 6, 18), m, 0, y, 0); t.rotation.x = Math.PI / 2; return t; };

export function buildShoe(kind: ShoeProp, a: FootAnchors): ShoeParts {
  const ankle = new Group(), toes = new Group();
  ankle.position.copy(a.ankle); toes.position.copy(a.toe); ankle.scale.setScalar(SHOE_SCALE); toes.scale.setScalar(SHOE_SCALE);
  switch (kind) {
    case 'shoe-trail': return { ankle: null, toes: null };
    case 'shoe-cuff': { // a turned-down leather cuff with a gold buckle
      const leather = mat(BOOT_TAN, { tint: true }), gold = mat(0xffd24a, { metal: 0.5, rough: 0.4 });
      ankle.add(ring(0.092, 0.03, leather, 0.03));
      const buckle = mesh(new BoxGeometry(0.045, 0.04, 0.02), gold, 0, 0.03, 0.098); ankle.add(buckle);
      return { ankle, toes: null };
    }
    case 'shoe-fur': { // fluffy highland fur around the ankle
      const fur = mat(0xf1e6d2, { rough: 0.95 }), fur2 = mat(0xe3d3b8, { rough: 0.95 });
      for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; ankle.add(mesh(new SphereGeometry(0.036, 7, 6), fur, Math.sin(t) * 0.088, 0.03, Math.cos(t) * 0.088)); }
      for (let i = 0; i < 8; i++) { const t = ((i + 0.5) / 8) * Math.PI * 2; ankle.add(mesh(new SphereGeometry(0.03, 7, 6), fur2, Math.sin(t) * 0.082, 0.062, Math.cos(t) * 0.082)); }
      return { ankle, toes: null };
    }
    case 'shoe-leaf': { // leaf wraps tied with a vine
      const leaf = mat(0x6cb554, { rough: 0.7 }), vine = mat(0x8a6a3a);
      ankle.add(ring(0.086, 0.016, vine, 0.012));
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2; const c = mesh(new ConeGeometry(0.036, 0.11, 5), leaf, Math.sin(t) * 0.09, 0.07, Math.cos(t) * 0.09);
        c.rotation.set(Math.cos(t) * 0.32, 0, -Math.sin(t) * 0.32); ankle.add(c);
      }
      return { ankle, toes: null };
    }
    case 'shoe-guard': { // silver toe cap and an ankle plate
      const steel = mat(0xc9d1d9, { metal: 0.45, rough: 0.35 }), dark = mat(0x8e98a3, { metal: 0.4, rough: 0.45 });
      const cap = mesh(new SphereGeometry(0.075, 10, 8), steel, 0, 0.032, 0.086); cap.scale.set(1.0, 0.7, 1.1); toes.add(cap);
      ankle.add(ring(0.09, 0.018, dark, 0.012));
      ankle.add(mesh(new BoxGeometry(0.085, 0.07, 0.022), steel, 0, 0.035, 0.092));
      return { ankle, toes };
    }
    case 'shoe-moon': { // a curled moon-mage toe with a little golden bell, and a gold ankle band
      const cloth = mat(0x7a63c2, { tint: true }), gold = mat(0xffd24a, { metal: 0.5, rough: 0.4, emissive: 0x8a5a00 });
      const tip = mesh(new ConeGeometry(0.052, 0.17, 7), cloth, 0, 0.075, 0.185); tip.rotation.x = Math.PI / 2 - 0.55; toes.add(tip);
      toes.add(mesh(new SphereGeometry(0.026, 8, 6), gold, 0, 0.145, 0.255));
      ankle.add(ring(0.09, 0.02, gold, 0.02));
      return { ankle, toes };
    }
  }
}

/** Recolours the pieces that follow the boot colour (`hex` null = their own colour). */
export function tintShoe(parts: ShoeParts, hex: number | null, base: number): void {
  for (const g of [parts.ankle, parts.toes]) g?.traverse(o => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (m?.userData?.[SHOE_TINT_KEY]) m.color.setHex(hex ?? base);
  });
}
