/**
 * The chibi hero: the KayKit "Adventurers" kit (CC0) merged onto ONE shared skeleton (see tools/chibi-kit). Every head, outfit, legs,
 * hat, cape, weapon and shield is its own named mesh, so equipping is just showing the right meshes; colours come from recolouring
 * the small atlases per mesh kind (`palette.ts`). Weapons and shields are children of the hand bones, so every clip carries them.
 */
import {
  AnimationClip, AnimationMixer, Bone, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  SRGBColorSpace, SphereGeometry, BoxGeometry, TorusGeometry, Vector3, type Material, type Texture, type SkinnedMesh,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PARTS, type Outfit, defaultOutfit } from '../../../game/art/parts';
import { visibleKitNodes, type Loadout } from '../../cosmetics/loadout';
import { glowSprite } from '../common';
import { withRim } from '../stylize';
import { CHIBI_SCALE } from './chibiClips';
import { recolourAtlas, type MeshKind, type Slot } from './palette';
import { blinkAt, buildFace, type FaceRig } from './ChibiFace';
import { makeOutline, syncOutline, type Outlined } from './ChibiOutline';
import { cleanNodeName } from './nodeNames';
import { fitTransform, isHandSlot, weaponFit } from './weaponFit';
import { BOOT_TAN, buildShoe, isShoeProp, tintShoe, type ShoeParts, type ShoeProp } from './footwear';

/** The head is drawn a touch bigger than the kit's (v2.9): a chunkier chibi head reads better from the gameplay camera. */
export const HEAD_SCALE = 1.1;

/** v2.11: the build id in the URL means a phone that cached an older kit under the same file name always fetches the new one. */
export const KIT_URL = `${import.meta.env.BASE_URL}assets/chibi/chibi_kit.glb?v=${typeof __MQ_BUILD__ === 'undefined' ? 'dev' : __MQ_BUILD__}`;
const ATLAS_SIZE = 512;

export const kindOfNode = (name: string): MeshKind => {
  if (/_Head/.test(name)) return 'head';
  if (/_(Body|ArmLeft|ArmRight)$/.test(name)) return 'body';
  if (/_(LegLeft|LegRight)$/.test(name)) return 'legs';
  if (/_(Helmet|Hat)$/.test(name)) return 'headgear';
  if (/_Cape$/.test(name)) return 'cape';
  return 'weapon';
};
const isSkinned = (o: Object3D): o is SkinnedMesh => (o as SkinnedMesh).isSkinnedMesh === true;

export class ChibiRig {
  /** Position and rotate this. Faces +Z at rotation 0; the feet are at y = 0. */
  readonly root = new Group();
  readonly mixer: AnimationMixer;
  readonly clips = new Map<string, AnimationClip>();
  private readonly model: Object3D;
  private readonly parts = new Map<string, Mesh>();
  private readonly atlas = new Map<string, Texture>();
  private readonly mats = new Map<string, MeshStandardMaterial>();
  private readonly baseMat = new Map<string, Material>();
  private readonly props = new Map<string, Group>();
  private outfit: Outfit = defaultOutfit();
  private loadout: Loadout | null = null;
  private flashK = 0; private glowK = 0;
  private readonly outlines: Outlined[] = [];
  private readonly faces = new Map<string, FaceRig>();
  private outlineOn = true;
  /** Shoe pieces already built and attached (one pair per style), and which style is showing. */
  private readonly shoes = new Map<ShoeProp, ShoeParts[]>(); private shoeShown: ShoeProp = 'shoe-trail';

  constructor(scene: Object3D, animations: AnimationClip[]) {
    for (const a of animations) this.clips.set(a.name, a);
    this.model = scene;
    this.root.add(scene);
    scene.scale.setScalar(CHIBI_SCALE);
    scene.traverse(o => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      this.parts.set(m.name, m); m.visible = false; m.castShadow = true; m.receiveShadow = false;
      if (isSkinned(m)) m.frustumCulled = false;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      this.baseMat.set(m.name, mat);
    });
    this.mixer = new AnimationMixer(scene);
    scene.updateMatrixWorld(true);
    // v2.9 polish: face decals (bigger glossy eyes, blush), a cartoon outline on every part, a slightly bigger head
    const head = this.bone('head');
    if (head) {
      for (const [name, m] of this.parts) {
        if (/_Head/.test(name) && isSkinned(m)) { try { const f = buildFace(m, head); if (f) { f.group.visible = false; this.faces.set(name, f); } } catch (e) { console.warn('MindQuest: face decals skipped', e); } }
      }
      head.scale.setScalar(HEAD_SCALE);
    }
    this.fitWeapons();
    for (const m of [...this.parts.values()]) { const o = makeOutline(m); if (o) this.outlines.push(o); }
  }

  /** v2.10: hand-held items are shrunk about the grip so a sword is no longer as tall as the hero (`weaponFit.ts`). Runs before the outlines are made so each twin copies the final transform. */
  private fitWeapons(): void {
    for (const [name, m] of this.parts) {
      if (!m.parent || !isHandSlot(m.parent.name)) continue;
      const k = weaponFit(name); if (k === 1) continue;
      const t = fitTransform([m.position.x, m.position.y, m.position.z], [m.scale.x, m.scale.y, m.scale.z], k);
      m.position.set(...t.position); m.scale.set(...t.scale);
    }
  }

  /** Blinks the visible face (call every frame with game time). */
  blink(t: number): void { const k = blinkAt(t); for (const f of this.faces.values()) if (f.group.visible) f.blink(k); }

  /** The outline can be switched off (for a very slow device). */
  setOutline(on: boolean): void { this.outlineOn = on; for (const o of this.outlines) syncOutline(o, on); }

  has(name: string): boolean { return this.parts.has(name); }
  partNames(): string[] { return [...this.parts.keys()]; }
  /** Looks a bone up by its authored name. three.js strips `. [ ] : /` from node names when it loads a glTF ("foot.l" becomes "footl"), so the same cleaning is applied here (before v2.10 the dotted names never matched, which is why the Glow Lantern never appeared). */
  bone(name: string): Bone | undefined { return this.model.getObjectByName(cleanNodeName(name)) as Bone | undefined; }

  /** v2.12: the main-hand weapon's tip and grip-end in the rig's local space of its hand slot (null when empty-handed). Cached until the loadout changes. */
  private trailLocal: { tip: Vector3; base: Vector3 } | null | undefined;
  private computeTrailLocal(slot: Object3D): { tip: Vector3; base: Vector3 } | null {
    let best = 0; const tip = new Vector3(), c = new Vector3();
    for (const ch of slot.children) {
      const m = ch as Mesh; if (!m.isMesh || !m.visible) continue;
      m.updateMatrix(); m.geometry.boundingBox ?? m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox!;
      for (let i = 0; i < 8; i++) { c.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrix); const d = c.length(); if (d > best) { best = d; tip.copy(c); } }
    }
    return best < 0.08 ? null : { tip, base: tip.clone() };
  }
  /** Writes the weapon's tip and grip-end in world space (call after `updateMatrixWorld`). False when there is no main-hand weapon. */
  weaponTrailPoints(tip: Vector3, base: Vector3, reach = 1.9, inner = 0.5): boolean {
    const slot = this.bone('handslot.r'); if (!slot) return false;
    if (this.trailLocal === undefined) this.trailLocal = this.computeTrailLocal(slot);
    if (!this.trailLocal) return false;
    // the ribbon is drawn longer than the (small) chibi blade, from `inner` to `reach` times its length, so a swing reads from the game camera
    slot.localToWorld(tip.copy(this.trailLocal.tip).multiplyScalar(reach)); slot.localToWorld(base.copy(this.trailLocal.base).multiplyScalar(inner)); return true;
  }

  setOutfit(o: Outfit): void { this.outfit = { ...o }; this.refresh(); }
  setLoadout(l: Loadout): void { this.loadout = l; this.refresh(); }

  /** Hurt flash / glow: a warm emissive pulse on every material. */
  setFlash(k: number): void { this.flashK = k; this.applyEmissive(); }
  setGlow(k: number): void { this.glowK = k; this.applyEmissive(); }
  /** v2.12: a pale spirit-blue glow over the whole body while a dodge makes the hero untouchable. */
  setPhase(k: number): void { if (Math.abs(k - this.phaseK) < 0.01 && (k === 0) === (this.phaseK === 0)) return; this.phaseK = k; this.applyEmissive(); }
  private phaseK = 0;
  /** The hurt flash tints everything a little; the attack glow only lights the weapons (a glow on the body would wash the colours out). */
  private applyEmissive(): void {
    for (const [key, m] of this.mats) {
      const weapon = key.includes('|weapon|') || key.startsWith('base|') && this.weaponBase.has(key);
      if (this.flashK > 0) { m.emissive.setHex(0xff4a2a); m.emissiveIntensity = this.flashK * 0.45; }
      else if (this.phaseK > 0) { m.emissive.setHex(0x7fe3ff); m.emissiveIntensity = this.phaseK * 0.3; }
      else if (weapon && this.glowK > 0) { m.emissive.setHex(0xffe29a); m.emissiveIntensity = this.glowK * 0.55; }
      else { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
    }
  }
  /** Keys of unrecoloured materials used by weapon meshes. */
  private readonly weaponBase = new Set<string>();

  /** The recolour targets for one kind of mesh (empty = the pack's own colours). */
  private targetsFor(kind: MeshKind, tintHex: number | null): Partial<Record<Slot, number>> {
    const hex = (k: keyof Outfit) => (this.outfit[k] > 0 ? PARTS[k].swatches[this.outfit[k]].hex : undefined);
    const t: Partial<Record<Slot, number>> = {};
    const put = (s: Slot, v: number | undefined) => { if (v !== undefined) t[s] = v; };
    if (kind === 'head') { put('hood', hex('hood')); put('skin', hex('skin')); put('eyes', hex('eyes')); }
    // v2.30: an outfit or trousers item may carry its own colour (`variantTint`, the Sailor set); the wardrobe's colour pick still wins when the child chose one
    else if (kind === 'body') { put('tunic', hex('tunic') ?? tintHex ?? undefined); put('gear', hex('gear')); put('skin', hex('skin')); }
    else if (kind === 'legs') { put('trousers', hex('trousers') ?? tintHex ?? undefined); put('boots', hex('boots')); put('skin', hex('skin')); }
    else if (kind === 'weapon') put('steel', hex('steel'));
    else if (kind === 'cape' && tintHex !== null) t.cape = tintHex;
    else if (kind === 'headgear' && tintHex !== null) t.hat = tintHex;
    return t;
  }

  private atlasFor(matName: string, base: Material): Texture | null {
    const cached = this.atlas.get(matName); if (cached) return cached;
    const map = (base as MeshStandardMaterial).map; if (!map) return null;
    this.atlas.set(matName, map); return map;
  }

  /** A material for (atlas, kind, targets): recoloured atlases are cached, so changing back and forth is free. */
  private materialFor(nodeName: string, kind: MeshKind, tintHex: number | null): Material {
    const base = this.baseMat.get(nodeName)!;
    const targets = this.targetsFor(kind, tintHex);
    if (!Object.keys(targets).length) { const m = this.styled(`${base.name}|${kind}`, base); if (kind === 'weapon') this.weaponBase.add(`base|${base.name}|${kind}`); return m; }
    const key = `${base.name}|${kind}|${JSON.stringify(targets)}`;
    const hit = this.mats.get(key); if (hit) return hit;
    const src = this.atlasFor(base.name, base); const img = src?.image as CanvasImageSource | undefined;
    if (!src || !img) return base;
    const c = document.createElement('canvas'); c.width = c.height = ATLAS_SIZE;
    const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0, ATLAS_SIZE, ATLAS_SIZE);
    const data = x.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE); recolourAtlas(data.data, kind, targets); x.putImageData(data, 0, 0);
    const tex = new CanvasTexture(c); tex.flipY = src.flipY; tex.colorSpace = SRGBColorSpace; tex.wrapS = src.wrapS; tex.wrapT = src.wrapT; tex.anisotropy = 2;
    const mat = this.makeMat(tex); this.mats.set(key, mat); return mat;
  }
  private styled(key: string, base: Material): MeshStandardMaterial {
    const k = `base|${key}`; const hit = this.mats.get(k); if (hit) return hit;
    const mat = this.makeMat((base as MeshStandardMaterial).map ?? null); this.mats.set(k, mat); return mat;
  }
  private makeMat(map: Texture | null): MeshStandardMaterial {
    return withRim(new MeshStandardMaterial({ map, roughness: 0.78, metalness: 0, envMapIntensity: 0.6, emissive: 0x000000 }), 0.9);
  }

  private refresh(): void {
    const l = this.loadout; if (!l) return;
    this.trailLocal = undefined;
    const show = visibleKitNodes(l);
    const tintOf = (name: string): number | null => {
      for (const [slot, swatch] of [['cape', l.capeSwatch], ['headgear', l.hatSwatch], ['outfit', 0], ['legs', 0]] as const) {
        const it = l.items[slot]; if (!it?.kit.includes(name)) continue;
        if (swatch > 0) return PARTS.tunic.swatches[swatch].hex;
        return it.variantTint ?? null;
      }
      return null;
    };
    for (const [name, mesh] of this.parts) {
      const on = show.has(name); mesh.visible = on;
      if (on) mesh.material = this.materialFor(name, kindOfNode(name), tintOf(name));
      const face = this.faces.get(name); if (face) { face.group.visible = on; if (on) face.setSkin(mesh.material as Material); }
    }
    for (const o of this.outlines) syncOutline(o, this.outlineOn);
    this.applyEmissive();
    // code-made props
    const wantCrown = l.items.headgear?.proc === 'leaf-crown', wantLantern = l.items.offhand?.proc === 'lantern';
    const wantSailor = l.items.headgear?.proc === 'sailor-cap';
    const wantSea = l.items.headgear?.proc === 'sea-crown', wantBeacon = l.items.offhand?.proc === 'lighthouse-lantern';
    this.prop('leaf-crown', 'head', wantCrown, buildLeafCrown); this.prop('lantern', 'handslot.l', wantLantern, buildLantern);
    this.prop('sea-crown', 'head', wantSea, buildSeaCrown); this.prop('sailor-cap', 'head', wantSailor, buildSailorCap); this.prop('lighthouse-lantern', 'handslot.l', wantBeacon, buildLighthouseLantern);
    this.applyShoes(l.items.shoes?.proc);
  }

  /** v2.10: shows the chosen shoe style on both feet (built on first use) and tints it with the boot colour. */
  private applyShoes(proc: string | undefined): void {
    const want: ShoeProp = isShoeProp(proc) ? proc : 'shoe-trail';
    if (want !== this.shoeShown) this.setShoeVisible(this.shoeShown, false);
    this.shoeShown = want;
    if (!this.shoes.has(want)) this.shoes.set(want, this.buildShoePair(want));
    this.setShoeVisible(want, true);
    const boots = this.outfit.boots > 0 ? PARTS.boots.swatches[this.outfit.boots].hex : null;
    for (const p of this.shoes.get(want) ?? []) tintShoe(p, boots, BOOT_TAN);
  }
  private setShoeVisible(k: ShoeProp, on: boolean): void { for (const p of this.shoes.get(k) ?? []) { if (p.ankle) p.ankle.visible = on; if (p.toes) p.toes.visible = on; } }
  private buildShoePair(kind: ShoeProp): ShoeParts[] {
    const out: ShoeParts[] = [];
    this.model.updateMatrixWorld(true);
    for (const side of ['l', 'r']) {
      const foot = this.bone(`foot.${side}`), toes = this.bone(`toes.${side}`); if (!foot || !toes) continue;
      const at = (b: Bone) => this.model.worldToLocal(b.getWorldPosition(new Vector3()));
      const parts = buildShoe(kind, { ankle: at(foot), toe: at(toes) });
      // placed in kit space first, then handed to the bone with its world transform kept, so it sits exactly where it was built
      for (const [g, bone] of [[parts.ankle, foot], [parts.toes, toes]] as const) if (g) { this.model.add(g); g.updateMatrixWorld(true); bone.attach(g); }
      out.push(parts);
    }
    return out;
  }
  private prop(id: string, bone: string, on: boolean, make: () => Group): void {
    let g = this.props.get(id);
    if (on && !g) { g = make(); const b = this.bone(bone); if (b) { b.add(g); this.props.set(id, g); } }
    if (g) g.visible = on;
  }
}

/**
 * Where a crown sits, in the head bone's own units (the bone is scaled about 0.63 in the world, and the chibi skull measures about 0.54
 * in these units across, centred 0.45 up from the bone). v2.30: the crowns used to be built at y 0.5 / radius 0.34, which is INSIDE the
 * skull, so the Leaf Crown and the Sea-glass Crown were never visible. A ring at y 0.84 with radius 0.52 rests on the hair.
 */
export const CROWN = { y: 0.84, r: 0.52 } as const;
function buildLeafCrown(): Group {
  const g = new Group(); const leaf = new MeshStandardMaterial({ color: 0x6cb554, roughness: 0.7, side: DoubleSide });
  const ring = new Mesh(new TorusGeometry(CROWN.r, 0.05, 6, 24), new MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(0, CROWN.y, 0); g.add(ring);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2; const c = new Mesh(new ConeGeometry(0.1, 0.3, 5), leaf);
    c.position.set(Math.sin(a) * CROWN.r, CROWN.y + 0.14, Math.cos(a) * CROWN.r); c.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); g.add(c);
  }
  const gem = new Mesh(new SphereGeometry(0.07, 8, 6), new MeshBasicMaterial({ color: 0xaaf4ea })); gem.position.set(0, CROWN.y + 0.05, CROWN.r + 0.02); g.add(gem);
  g.traverse(o => { (o as Mesh).castShadow = true; });
  return g;
}
/** The Sea-glass Crown: a ring of driftwood set with seven tumbled glass shards in sea colours, and a pearl at the front. */
function buildSeaCrown(): Group {
  const g = new Group(), hues = [0x7fe8d0, 0x8fd0ff, 0xb8f0a8, 0xffd0e8, 0xa8c8ff, 0x7fe8d0, 0x8fd0ff];
  const ring = new Mesh(new TorusGeometry(CROWN.r, 0.055, 6, 24), new MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.8 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, CROWN.y, 0); g.add(ring);
  hues.forEach((h, i) => {
    const a = (i / hues.length) * Math.PI * 2, tall = 0.34 + (i % 3) * 0.07, shard = new Mesh(new ConeGeometry(0.1, tall, 4), new MeshStandardMaterial({ color: h, emissive: h, emissiveIntensity: 0.45, roughness: 0.2, transparent: true, opacity: 0.9 }));
    shard.position.set(Math.sin(a) * CROWN.r, CROWN.y + tall / 2, Math.cos(a) * CROWN.r); shard.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); g.add(shard);
  });
  const pearl = new Mesh(new SphereGeometry(0.085, 10, 8), new MeshBasicMaterial({ color: 0xfff6e8 })); pearl.position.set(0, CROWN.y, CROWN.r + 0.03); g.add(pearl);
  g.traverse(o => { (o as Mesh).castShadow = true; });
  return g;
}
/** v2.30 Sailor Cap: a round white sailor\u2019s cap with a navy band, a little brim, a gold button and two ribbon tails at the back. (It used to be the Knight Helmet, spikes and all.) */
function buildSailorCap(): Group {
  const g = new Group(), white = new MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.85 }), navy = new MeshStandardMaterial({ color: 0x24407a, roughness: 0.8 });
  const crown = new Mesh(new CylinderGeometry(0.42, 0.5, 0.3, 18), white); crown.position.set(0, 0.88, 0);
  const top = new Mesh(new CylinderGeometry(0.44, 0.42, 0.05, 18), white); top.position.set(0, 1.04, 0);
  const band = new Mesh(new CylinderGeometry(0.505, 0.52, 0.1, 18), navy); band.position.set(0, 0.76, 0);
  const brim = new Mesh(new TorusGeometry(0.52, 0.035, 6, 24), white); brim.rotation.x = Math.PI / 2; brim.position.set(0, 0.71, 0);
  const button = new Mesh(new SphereGeometry(0.06, 8, 6), new MeshStandardMaterial({ color: 0xf0d27a, roughness: 0.4, metalness: 0.3 })); button.position.set(0, 1.08, 0);
  g.add(crown, top, band, brim, button);
  for (const s of [-1, 1]) { const tail = new Mesh(new BoxGeometry(0.08, 0.36, 0.02), navy); tail.position.set(s * 0.09, 0.58, -0.52); tail.rotation.set(0.2, 0, s * 0.18); g.add(tail); }
  g.traverse(o => { (o as Mesh).castShadow = true; });
  return g;
}
/** The Lighthouse Lantern: a taller, round beacon with a red cap and a cool white-gold light. */
function buildLighthouseLantern(): Group {
  const g = new Group(), metal = new MeshStandardMaterial({ color: 0xd8483a, roughness: 0.5, metalness: 0.3 });
  const body = new Mesh(new CylinderGeometry(0.1, 0.12, 0.3, 10), new MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a0, emissiveIntensity: 1.8, roughness: 0.3 })); body.position.set(0, -0.14, 0);
  const cap = new Mesh(new ConeGeometry(0.17, 0.14, 10), metal); cap.position.set(0, 0.08, 0); const base = new Mesh(new CylinderGeometry(0.14, 0.14, 0.04, 10), new MeshStandardMaterial({ color: 0x3a3a48 })); base.position.set(0, -0.3, 0);
  const handle = new Mesh(new TorusGeometry(0.08, 0.015, 5, 10, Math.PI), new MeshStandardMaterial({ color: 0x3a3a48 })); handle.position.set(0, 0.16, 0);
  const glow = glowSprite(0xfff0c0, 1.5, 0.85); glow.position.set(0, -0.14, 0);
  g.add(body, cap, base, handle, glow); g.position.set(0, 0.05, 0.1); g.scale.setScalar(1.4); // v2.30: bigger, so the lit lamp body reads in the hand
  return g;
}
function buildLantern(): Group {
  const g = new Group(); const metal = new MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.6, metalness: 0.5 });
  const body = new Mesh(new BoxGeometry(0.2, 0.26, 0.2), new MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc54a, emissiveIntensity: 1.6, roughness: 0.3 }));
  body.position.set(0, -0.12, 0); const cap = new Mesh(new BoxGeometry(0.26, 0.05, 0.26), metal); cap.position.set(0, 0.03, 0);
  const handle = new Mesh(new TorusGeometry(0.08, 0.015, 5, 10, Math.PI), metal); handle.position.set(0, 0.06, 0);
  const glow = glowSprite(0xffc54a, 1.1, 0.8); glow.position.set(0, -0.12, 0);
  g.add(body, cap, handle, glow); g.position.set(0, 0.05, 0.1);
  return g;
}

let kitPromise: Promise<{ scene: Object3D; animations: AnimationClip[] }> | null = null;
export function loadKit(): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  kitPromise ??= new Promise((res, rej) => {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.load(KIT_URL, g => res({ scene: g.scene, animations: g.animations }), undefined, rej);
  });
  return kitPromise;
}
export async function loadChibiRig(): Promise<ChibiRig> { const { scene, animations } = await loadKit(); return new ChibiRig(scene, animations); }
