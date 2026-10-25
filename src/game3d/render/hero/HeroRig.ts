/**
 * The MindQuest hero: a stylised adventurer modelled in code and skinned to the Universal Animation Library skeleton
 * (Quaternius, CC0), animated with the library's own clips. Loaded asynchronously; `HeroModel` shows a fallback until ready.
 */
import {
  AnimationClip, AnimationMixer, Bone, Group, Material, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, Skeleton, SkinnedMesh, Vector3, DoubleSide, Quaternion,
  type BufferGeometry, type Texture, Color, AdditiveBlending, Sprite,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MESH_GROUPS, type Equipment, type MeshGroup } from '../../systems/outfit3d';
import { ACCESSORY_CATALOG } from '../../systems/outfit3d';
import { glowSprite } from '../common';
import { withRim } from '../stylize';
import { buildBody } from './heroBody';
import { FaceSet, type Expression } from './faceTextures';
import { PartBuilder } from './geom';
import {
  buildCloak, buildHands, buildHead, buildHipGear, buildHoodAndScarf, buildLantern, buildLeafCrown, buildPack, buildScabbard, buildSword, type Cloak, type PropCtx, paint,
} from './heroProps';

/** Native height of the rig (1.78 m) scaled to the game's ~1.25 m hero. Locomotion clips were measured: jog 5.3 m/s, sprint 8.2 m/s -> 3.7 and 5.7 m/s at this scale, matching WALK/RUN speeds. */
export const HERO_SCALE = 0.7;
export const HEAD_SCALE = 1.85;

export const RIG_URL = `${import.meta.env.BASE_URL}assets/hero/hero_rig.glb`;

function cloneBones(src: Object3D, parent: Object3D, list: Bone[]): void {
  const b = new Bone(); b.name = src.name; b.position.copy(src.position); b.quaternion.copy(src.quaternion); b.scale.copy(src.scale);
  parent.add(b); list.push(b);
  for (const c of src.children) cloneBones(c, b, list);
}

const stdMat = (opts: { roughness?: number; metalness?: number; side?: typeof DoubleSide | 0; env?: number; vertexColors?: boolean; emissive?: number; emissiveIntensity?: number } = {}): MeshStandardMaterial =>
  withRim(new MeshStandardMaterial({
    color: 0xffffff, vertexColors: opts.vertexColors ?? true, roughness: opts.roughness ?? 0.72, metalness: opts.metalness ?? 0, envMapIntensity: opts.env ?? 0.6,
    side: opts.side ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
  }));

export type Mats = Record<MeshGroup, MeshStandardMaterial> & {
  trim: MeshStandardMaterial; gem: MeshStandardMaterial; leaf: MeshStandardMaterial; glass: MeshStandardMaterial; cloak: MeshStandardMaterial; face: MeshLambertMaterial;
};

export class HeroRig {
  /** Position and rotate this. Faces +Z at rotation 0; the feet are at y = 0. */
  readonly root = new Group();
  readonly rig = new Group();
  readonly mixer: AnimationMixer;
  readonly clips = new Map<string, AnimationClip>();
  readonly mats: Mats;
  readonly bones = new Map<string, Bone>();
  readonly skeleton: Skeleton;
  private readonly faces = new FaceSet();
  private readonly drawnSword: Group; private readonly sheathedSword: Group;
  private readonly crown: Group; private readonly cloak: Cloak; private readonly lantern: Group; private readonly lanternGlow: Sprite;
  private readonly hairTail: Group; private readonly scarf: Group; private readonly swordGlow: Sprite;
  private expression: Expression = 'open';
  private blinkIn = 2.5; private blinkT = 0; private expressionHold = 0;
  private flashK = 0;
  private swordDrawn = false;
  private swayV = new Vector3(); private lastPos = new Vector3(); private haveLast = false;

  constructor(gltfScene: Object3D, animations: AnimationClip[]) {
    for (const a of animations) this.clips.set(a.name, a);
    const armature = gltfScene.getObjectByName('Armature') ?? gltfScene;
    const srcRoot = gltfScene.getObjectByName('root');
    if (!srcRoot) throw new Error('hero rig: no root bone');
    this.rig.position.copy(armature.position); this.rig.quaternion.copy(armature.quaternion); this.rig.scale.copy(armature.scale);
    const list: Bone[] = [];
    cloneBones(srcRoot, this.rig, list);
    list.forEach(b => this.bones.set(b.name, b));
    this.root.add(this.rig);
    this.rig.updateMatrixWorld(true);
    this.skeleton = new Skeleton(list);
    this.mixer = new AnimationMixer(this.rig);

    // ---- materials
    const m = {} as Mats;
    m.hair = stdMat({ roughness: 0.45, env: 0.9 });
    m.hood = stdMat({ roughness: 0.85, side: DoubleSide });
    m.tunic = stdMat({ roughness: 0.8 });
    m.trousers = stdMat({ roughness: 0.85 });
    m.boots = stdMat({ roughness: 0.6, env: 0.7 });
    m.belt = stdMat({ roughness: 0.55, env: 0.8 });
    m.pack = stdMat({ roughness: 0.75 });
    m.skin = stdMat({ roughness: 0.55, env: 0.5 });
    m.blade = stdMat({ roughness: 0.22, metalness: 0.75, env: 1.4 });
    m.eyes = m.skin; // eye colour lives on the face texture
    m.trim = stdMat({ roughness: 0.32, metalness: 0.85, env: 1.3 }); m.trim.color.setHex(0xe0b64f);
    m.gem = stdMat({ roughness: 0.25, metalness: 0.1, emissive: 0x33d6c0, emissiveIntensity: 1.1 }); m.gem.color.setHex(0xaaf4ea);
    m.leaf = stdMat({ roughness: 0.7 }); m.leaf.color.setHex(0x6cb554);
    m.glass = stdMat({ vertexColors: false, roughness: 0.2, emissive: 0xffc54a, emissiveIntensity: 1.6 }); m.glass.color.setHex(0xffe9a8);
    m.cloak = stdMat({ roughness: 0.9, side: DoubleSide }); m.cloak.color.setHex(0x3c7a48);
    m.face = new MeshLambertMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mats = m;

    // ---- skinned body
    const idx = (name: string): number => { const i = list.findIndex(b => b.name === name); if (i < 0) throw new Error(`hero rig: unknown bone ${name}`); return i; };
    const mkPart = () => new PartBuilder(idx);
    const body = { skin: mkPart(), tunic: mkPart(), trousers: mkPart(), boots: mkPart(), belt: mkPart(), trim: mkPart() };
    buildBody(body);
    const addSkinned = (pb: PartBuilder, mat: Material, name: string) => {
      const g: BufferGeometry = pb.build();
      const sm = new SkinnedMesh(g, mat); sm.name = name; sm.frustumCulled = false; sm.castShadow = true; sm.receiveShadow = false;
      this.rig.add(sm); sm.bind(this.skeleton, new Matrix4());
    };
    addSkinned(body.skin, m.skin, 'skin'); addSkinned(body.tunic, m.tunic, 'tunic'); addSkinned(body.trousers, m.trousers, 'trousers');
    addSkinned(body.boots, m.boots, 'boots'); addSkinned(body.belt, m.belt, 'belt'); addSkinned(body.trim, m.trim, 'trim');

    // ---- rigid parts
    const bone = (n: string): Bone => { const b = this.bones.get(n); if (!b) throw new Error(`hero rig: no bone ${n}`); return b; };
    const toBone = (g: BufferGeometry, b: Bone): BufferGeometry => { g.applyMatrix4(new Matrix4().copy(b.matrixWorld).invert()); return g; };
    const ctx: PropCtx = { bone, toBone, mats: m };
    const plain = () => new PartBuilder(() => 0);
    const head = buildHead(ctx, plain);
    bone('Head').add(head.group);
    this.hairTail = head.hairTail;
    const hood = buildHoodAndScarf(ctx, plain); bone('spine_03').add(hood.group); this.scarf = hood.scarf;
    bone('spine_03').add(buildPack(ctx, plain));
    bone('pelvis').add(buildHipGear(ctx, plain));
    buildHands(ctx, plain); // each hand piece parents itself to its own bone
    // sword in hand and sheathed
    const sword = buildSword(ctx);
    const handR = bone('hand_r');
    this.drawnSword = new Group(); this.drawnSword.add(sword.clone());
    this.attachSwordToHand(handR);
    handR.add(this.drawnSword);
    const scab = buildScabbard(ctx, plain);
    bone('pelvis').add(scab.group);
    this.sheathedSword = new Group(); this.sheathedSword.add(sword.clone());
    const pel = bone('pelvis'); const inv = new Matrix4().copy(pel.matrixWorld).invert();
    this.sheathedSword.position.copy(scab.swordPos.clone().applyMatrix4(inv));
    this.sheathedSword.quaternion.copy(pel.getWorldQuaternion(new Quaternion()).invert().multiply(scab.swordQuat));
    pel.add(this.sheathedSword);
    this.swordGlow = glowSprite(0xbff7ee, 0.7, 0); this.swordGlow.position.set(0, 0.55, 0); this.drawnSword.add(this.swordGlow);
    this.setSwordDrawn(false);

    // ---- wardrobe extras
    this.crown = buildLeafCrown(ctx); this.crown.visible = false; bone('Head').add(this.crown);
    this.cloak = buildCloak(ctx); this.cloak.group.visible = false; bone('spine_03').add(this.cloak.group);
    const lan = buildLantern(ctx); this.lantern = lan.group; this.lantern.visible = false; bone('hand_l').add(this.lantern);
    this.lanternGlow = glowSprite(0xffd27a, 1.1, 0.8);
    this.lanternGlow.position.copy(new Vector3(0.79, 1.25, -0.06).applyMatrix4(new Matrix4().copy(bone('hand_l').matrixWorld).invert())); this.lantern.add(this.lanternGlow);

    // ---- stylise: a bigger head, then scale the whole rig. Done after binding so the rest pose stays the bind pose.
    bone('Head').scale.setScalar(HEAD_SCALE);
    this.rig.scale.multiplyScalar(HERO_SCALE);
    this.root.traverse(o => { if ((o as Mesh).isMesh) { o.castShadow = true; } });
    this.faces.paint({ iris: 0x3b8f5a, brow: 0x6a4a2e, skin: 0xe0b08a });
    this.mats.face.map = this.faces.textures.open;
  }

  /** Where the grip sits in the right hand (bone-local), found by looking at the Sword_Idle clip. */
  private attachSwordToHand(hand: Bone): void {
    const fist = new Vector3(-0.775, 1.436, -0.066).applyMatrix4(new Matrix4().copy(hand.matrixWorld).invert());
    this.drawnSword.position.copy(fist);
    // grip axis (+Y of the sword) runs across the fist; rotation refined empirically
    this.drawnSword.quaternion.set(0.4189, 0, 0.0224, 0.9077); // blade forward and a little down in the idle pose (computed from the rest orientation of hand_r)
    this.gripNeedsTuning = true;
  }
  gripNeedsTuning = false;

  get swordHand(): Group { return this.drawnSword; }

  setSwordDrawn(drawn: boolean): void {
    this.swordDrawn = drawn; this.drawnSword.visible = drawn; this.sheathedSword.visible = !drawn;
  }
  get isSwordDrawn(): boolean { return this.swordDrawn; }
  setSwordGlow(k: number): void { this.swordGlow.material.opacity = k; }

  setOutfit(colors: Record<MeshGroup, number>): void {
    for (const g of MESH_GROUPS) if (g !== 'eyes') this.mats[g].color.setHex(colors[g]);
    this.faces.paint({ iris: colors.eyes, brow: colors.hair, skin: colors.skin });
    this.mats.face.map = this.faces.textures[this.expression]; this.mats.face.needsUpdate = true;
  }

  setAccessories(eq: Equipment): void {
    const id = (slot: 'head' | 'back' | 'hand') => (eq[slot] && ACCESSORY_CATALOG.some(a => a.id === eq[slot]) ? eq[slot] : undefined);
    this.crown.visible = id('head') === 'leaf-crown';
    this.cloak.group.visible = id('back') === 'mossy-cloak';
    this.lantern.visible = id('hand') === 'glow-lantern';
  }

  setFlash(k: number): void {
    if (k === this.flashK) return;
    this.flashK = k;
    for (const g of MESH_GROUPS) this.mats[g].emissive.setRGB(k * 0.8, k * 0.05, k * 0.05);
    this.mats.trim.emissive.setRGB(k * 0.6, k * 0.04, k * 0.04);
  }

  setExpression(e: Expression, holdSeconds = 0): void {
    this.expression = e; this.expressionHold = holdSeconds;
    this.mats.face.map = this.faces.textures[e]; this.mats.face.needsUpdate = true;
  }

  /** Blink, secondary motion (hair tail, scarf, cloak, lantern glow). `speed` is ground speed in m/s, `heading` the world yaw. */
  updateSecondary(dt: number, t: number, worldPos: Vector3, speed: number): void {
    // expression timers
    if (this.expressionHold > 0) { this.expressionHold -= dt; if (this.expressionHold <= 0) this.setExpression('open'); }
    else if (this.expression === 'open' || this.expression === 'blink') {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0 && this.expression === 'open') { this.expression = 'blink'; this.mats.face.map = this.faces.textures.blink; this.blinkT = 0.11; this.blinkIn = 2.2 + Math.random() * 3; }
      if (this.expression === 'blink') { this.blinkT -= dt; if (this.blinkT <= 0) { this.expression = 'open'; this.mats.face.map = this.faces.textures.open; } }
    }
    // velocity from position change (world), smoothed
    if (!this.haveLast) { this.lastPos.copy(worldPos); this.haveLast = true; }
    const vx = (worldPos.x - this.lastPos.x) / Math.max(dt, 1e-4), vz = (worldPos.z - this.lastPos.z) / Math.max(dt, 1e-4);
    this.lastPos.copy(worldPos);
    const k = 1 - Math.exp(-8 * dt);
    this.swayV.x += (vx - this.swayV.x) * k; this.swayV.z += (vz - this.swayV.z) * k;
    // express in hero space: forward component (+Z local) and sideways
    const yaw = this.root.rotation.y; const fwd = this.swayV.x * Math.sin(yaw) + this.swayV.z * Math.cos(yaw); const side = this.swayV.x * Math.cos(yaw) - this.swayV.z * Math.sin(yaw);
    const f = Math.max(-6, Math.min(6, fwd)), sd = Math.max(-6, Math.min(6, side));
    this.hairTail.rotation.x = 0.0 - f * 0.05 + Math.sin(t * 2.1) * 0.03; this.hairTail.rotation.z = -sd * 0.04 + Math.sin(t * 1.7 + 1) * 0.03;
    this.scarf.rotation.x = -0.08 - f * 0.07 + Math.sin(t * 3.1) * 0.05 * (0.4 + Math.min(1, speed / 3));
    this.scarf.rotation.z = -sd * 0.05 + Math.sin(t * 2.3) * 0.06;
    if (this.cloak.group.visible) {
      const pos = this.cloak.geo.getAttribute('position'); const rest = this.cloak.rest;
      const lift = Math.min(1, Math.max(0, f / 5.5));
      for (let i = 0; i < pos.count; i++) {
        const y0 = rest[i * 3 + 1]; const tt = Math.min(1, Math.max(0, -y0 / 0.78));
        const wave = Math.sin(t * 5 + rest[i * 3] * 14 + tt * 5) * 0.018 * tt * (0.4 + lift);
        pos.setXYZ(i, rest[i * 3] + Math.sin(t * 2.4 + tt * 3) * 0.006 * tt, y0 + tt * lift * 0.05, rest[i * 3 + 2] - tt * (lift * 0.2 + 0.015) + wave);
      }
      pos.needsUpdate = true; this.cloak.geo.computeVertexNormals();
    }
    if (this.lantern.visible) { const fl = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 5.3) * 0.05; this.lanternGlow.material.opacity = 0.7 * fl; }
  }

  /** Re-skins hands etc. are static; nothing else to dispose here beyond geometry/material GPU buffers. */
  dispose(): void {
    this.faces.dispose();
    this.root.traverse(o => {
      const me = o as Mesh; if (me.geometry) me.geometry.dispose();
      const mat = me.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose();
    });
  }
}

let cache: Promise<{ scene: Object3D; animations: AnimationClip[] }> | null = null;
export function loadRigAsset(): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  if (!cache) {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    cache = loader.loadAsync(RIG_URL).then(g => ({ scene: g.scene, animations: g.animations }));
    cache.catch(() => { cache = null; });
  }
  return cache;
}

export async function loadHeroRig(): Promise<HeroRig> {
  const { scene, animations } = await loadRigAsset();
  return new HeroRig(scene, animations);
}

// keep the unused imports referenced for tree-shaking clarity
void Color; void AdditiveBlending; void MeshBasicMaterial; void paint; void ({} as Texture);
