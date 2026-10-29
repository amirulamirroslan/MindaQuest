import {
  AdditiveBlending, BoxGeometry, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, RingGeometry, SphereGeometry, TorusGeometry,
} from 'three';
import { ACCESSORY_CATALOG, MESH_GROUPS, type Equipment, type MeshGroup } from '../systems/outfit3d';
import { COMBAT } from '../systems/combat';
import { blobShadow, glowSprite, lambert, mesh } from './common';

/** What the hero is doing this frame. Times are 0..1 through the action; null when not in it. */
export interface ProceduralPose {
  /** Ground speed in m/s. */
  speed: number;
  /** Seconds, free-running, for idle and walk cycles. */
  time: number;
  attack: number | null;
  dodge: number | null;
  special: number | null;
  /** 0 = standing, 1 = lying down. */
  faint: number;
}

const ease = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The original procedural low-poly hero (now only a fallback if the rigged hero fails to load), about 1.2 m tall, facing +Z at rotation 0. Every part belongs to a mesh group
 * (see `outfit3d.ts`), so the saved wardrobe colours apply directly. No model files: everything is built from boxes and spheres.
 */
export class ProceduralHero {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly mats = {} as Record<MeshGroup, MeshLambertMaterial>;
  private readonly legL = new Group(); private readonly legR = new Group();
  private readonly armL = new Group(); private readonly armR = new Group();
  private readonly head = new Group();
  private readonly torso = new Group();
  private readonly cloak = new Group();
  private readonly crown = new Group();
  private readonly lantern = new Group();
  private readonly slash: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly spinRing: Mesh<RingGeometry, MeshBasicMaterial>;
  private flashK = 0;

  constructor() {
    for (const g of MESH_GROUPS) this.mats[g] = lambert(0xffffff);
    const m = this.mats;
    this.root.add(blobShadow(0.55));
    this.body.position.y = 0.42;
    this.root.add(this.body);

    // legs: pivot at the hip
    for (const [leg, x] of [[this.legL, 0.09], [this.legR, -0.09]] as const) {
      leg.position.set(x, 0, 0);
      leg.add(mesh(new BoxGeometry(0.13, 0.3, 0.14), m.trousers, 0, -0.15, 0));
      leg.add(mesh(new BoxGeometry(0.15, 0.14, 0.22), m.boots, 0, -0.35, 0.03));
      this.body.add(leg);
    }
    // torso, belt, pack
    this.torso.add(mesh(new BoxGeometry(0.34, 0.34, 0.2), m.tunic, 0, 0.19, 0));
    this.torso.add(mesh(new BoxGeometry(0.36, 0.06, 0.22), m.belt, 0, 0.05, 0));
    this.torso.add(mesh(new BoxGeometry(0.06, 0.07, 0.235), m.belt, 0, 0.05, 0));
    this.torso.add(mesh(new BoxGeometry(0.26, 0.28, 0.12), m.pack, 0, 0.2, -0.16));
    this.body.add(this.torso);

    // arms: pivot at the shoulder
    for (const [arm, x] of [[this.armL, 0.22], [this.armR, -0.22]] as const) {
      arm.position.set(x, 0.32, 0);
      arm.add(mesh(new BoxGeometry(0.09, 0.28, 0.09), m.tunic, 0, -0.13, 0));
      arm.add(mesh(new SphereGeometry(0.055, 8, 6), m.skin, 0, -0.29, 0));
      this.torso.add(arm);
    }

    // head: skin, eyes, hair cap, hood collar and tail
    this.head.position.set(0, 0.37, 0);
    this.head.add(mesh(new SphereGeometry(0.17, 12, 9), m.skin, 0, 0.17, 0));
    for (const x of [0.06, -0.06]) this.head.add(mesh(new SphereGeometry(0.026, 6, 5), m.eyes, x, 0.19, 0.15));
    this.head.add(mesh(new SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), m.hair, 0, 0.19, -0.015));
    this.head.add(mesh(new SphereGeometry(0.15, 8, 6), m.hair, 0, 0.17, -0.08));
    const tail = mesh(new ConeGeometry(0.1, 0.3, 7), m.hood, 0, 0.2, -0.26); tail.rotation.x = -Math.PI / 2;
    this.head.add(tail);
    const collar = mesh(new TorusGeometry(0.15, 0.05, 6, 10), m.hood, 0, 0.02, 0); collar.rotation.x = Math.PI / 2;
    this.head.add(collar);
    this.torso.add(this.head);

    // blade in the right hand, hanging a little forward
    const blade = new Group();
    blade.add(mesh(new BoxGeometry(0.035, 0.1, 0.035), m.belt, 0, -0.03, 0));
    blade.add(mesh(new BoxGeometry(0.13, 0.026, 0.045), m.blade, 0, -0.09, 0));
    blade.add(mesh(new BoxGeometry(0.05, 0.42, 0.016), m.blade, 0, -0.31, 0));
    blade.add(mesh(new ConeGeometry(0.025, 0.07, 4), m.blade, 0, -0.55, 0).rotateX(Math.PI));
    blade.position.set(0, -0.29, 0); blade.rotation.x = -0.35;
    this.armR.add(blade);

    // accessories (hidden until equipped)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = mesh(new ConeGeometry(0.035, 0.12, 4), lambert(i % 2 ? 0x5fae4a : 0x3f8a3a), Math.sin(a) * 0.17, 0.19 + 0.17 * 0.95, Math.cos(a) * 0.17);
      leaf.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      this.crown.add(leaf);
    }
    this.crown.visible = false; this.head.add(this.crown);

    this.cloak.position.set(0, 0.34, -0.12);
    this.cloak.add(mesh(new BoxGeometry(0.4, 0.5, 0.035), lambert(0x2f6b3a), 0, -0.24, -0.1));
    this.cloak.add(mesh(new BoxGeometry(0.46, 0.08, 0.2), lambert(0x4f8f4a), 0, 0.02, 0.06));
    for (const [x, y, s] of [[-0.12, -0.12, 0.07], [0.1, -0.3, 0.06], [0.0, -0.42, 0.05]] as const) this.cloak.add(mesh(new SphereGeometry(s, 6, 5), lambert(0x86b85a), x, y, -0.125));
    this.cloak.visible = false; this.torso.add(this.cloak);

    this.lantern.position.set(0, -0.3, 0.05);
    this.lantern.add(mesh(new BoxGeometry(0.02, 0.1, 0.02), lambert(0x3a2a1c), 0, 0.04, 0));
    this.lantern.add(mesh(new BoxGeometry(0.09, 0.11, 0.09), new MeshLambertMaterial({ color: 0xffe08a, emissive: 0xffc54a, emissiveIntensity: 0.9 }), 0, -0.07, 0));
    this.lantern.add(glowSprite(0xffd27a, 0.9, 0.7).translateY(-0.07));
    this.lantern.visible = false; this.armL.add(this.lantern);

    // slash and spin effects
    this.slash = new Mesh(new RingGeometry(0.7, 1.75, 18, 1, -Math.PI / 2 - 1.05, 2.1), new MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
    this.slash.rotation.x = -Math.PI / 2; this.slash.position.y = 0.55; this.slash.visible = false;
    this.root.add(this.slash);
    this.spinRing = new Mesh(new RingGeometry(0.82, 1, 40), new MeshBasicMaterial({ color: 0x9be8ff, transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
    this.spinRing.rotation.x = -Math.PI / 2; this.spinRing.position.y = 0.18; this.spinRing.visible = false;
    this.root.add(this.spinRing);
    this.pose({ speed: 0, time: 0, attack: null, dodge: null, special: null, faint: 0 });
  }

  setOutfit(colors: Record<MeshGroup, number>): void {
    for (const g of MESH_GROUPS) this.mats[g].color.setHex(colors[g]);
  }

  setAccessories(eq: Equipment): void {
    const id = (slot: 'head' | 'back' | 'hand') => (eq[slot] && ACCESSORY_CATALOG.some(a => a.id === eq[slot]) ? eq[slot] : undefined);
    this.crown.visible = id('head') === 'leaf-crown';
    this.cloak.visible = id('back') === 'mossy-cloak';
    this.lantern.visible = id('hand') === 'glow-lantern';
  }

  /** 0..1 red flash after being hit. */
  setFlash(k: number): void {
    this.flashK = k;
    for (const g of MESH_GROUPS) this.mats[g].emissive.setRGB(k * 0.8, k * 0.05, k * 0.05);
  }
  get flash(): number { return this.flashK; }

  pose(p: ProceduralPose): void {
    const b = this.body;
    const moving = clamp01(p.speed / 3.2);
    const phase = p.time * (3.5 + p.speed * 1.9);
    const swing = Math.sin(phase) * 0.95 * moving;
    let bodyY = 0.42 + Math.abs(Math.sin(phase)) * 0.045 * moving + Math.sin(p.time * 2.2) * 0.006 * (1 - moving);
    b.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.set(-swing * 0.8 + 0.08, 0, -0.08);
    this.armR.rotation.set(swing * 0.8 - 0.45, 0, 0.08);
    this.cloak.rotation.x = 0.12 + moving * 0.35 + Math.sin(phase * 0.5) * 0.05 * moving;
    this.slash.visible = false; this.spinRing.visible = false;

    if (p.attack !== null) {
      const n = clamp01(p.attack);
      const hitN = COMBAT.attackHitAt / COMBAT.attackDuration;
      const arm = n < 0.22 ? lerp(-0.45, 2.5, ease(n / 0.22)) : n < 0.55 ? lerp(2.5, -1.55, ease((n - 0.22) / 0.33)) : lerp(-1.55, -0.45, (n - 0.55) / 0.45);
      this.armR.rotation.set(arm, 0, 0.08);
      this.armL.rotation.set(-0.5, 0, -0.3);
      this.legL.rotation.x = 0.5; this.legR.rotation.x = -0.4;
      this.torso.rotation.y = n < 0.55 ? lerp(-0.5, 0.55, ease(clamp01(n / 0.5))) : lerp(0.55, 0, (n - 0.55) / 0.45);
      bodyY = 0.4;
      if (n > hitN - 0.1 && n < 0.8) {
        const f = clamp01((n - (hitN - 0.1)) / 0.45);
        this.slash.visible = true; this.slash.material.opacity = (1 - f) * 0.75; this.slash.scale.setScalar(0.85 + f * 0.25);
      }
    }
    if (p.special !== null) {
      const n = clamp01(p.special);
      b.rotation.y = ease(clamp01(n / 0.8)) * Math.PI * 4;
      this.armL.rotation.set(0, 0, -1.45); this.armR.rotation.set(0, 0, 1.45);
      this.legL.rotation.x = 0.3; this.legR.rotation.x = -0.3;
      const blast = clamp01((n - COMBAT.specialHitAt / COMBAT.specialDuration) / 0.45);
      if (n > COMBAT.specialHitAt / COMBAT.specialDuration - 0.08) {
        this.spinRing.visible = true; this.spinRing.scale.setScalar(0.5 + ease(blast) * (COMBAT.specialRadius - 0.5));
        this.spinRing.material.opacity = (1 - blast) * 0.85;
      }
    }
    if (p.dodge !== null) {
      const n = clamp01(p.dodge);
      b.rotation.x = ease(n) * Math.PI * 2;
      bodyY = 0.42 + Math.sin(n * Math.PI) * 0.18;
      this.legL.rotation.x = -1.2; this.legR.rotation.x = -1.2;
      this.armL.rotation.set(-1.3, 0, -0.2); this.armR.rotation.set(-1.3, 0, 0.2);
    }
    if (p.faint > 0) {
      const f = clamp01(p.faint);
      b.rotation.set(0, 0, 0); this.torso.rotation.set(0, 0, 0);
      b.rotation.z = f * (Math.PI / 2) * 0.95;
      bodyY = lerp(bodyY, 0.17, f);
      this.head.rotation.z = f * 0.3;
    }
    b.position.y = bodyY;
  }
}
