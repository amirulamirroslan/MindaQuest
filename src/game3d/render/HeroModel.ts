import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, SRGBColorSpace, Vector3,
} from 'three';
import { COMBAT } from '../systems/combat';
import { smoothingFactor, wrapAngle } from '../systems/movement3d';
import type { Equipment, MeshGroup } from '../systems/outfit3d';
import { blobShadow, glowTexture } from './common';
import { HeroAnimator, type HeroPose } from './hero/heroAnim';
import { HERO_SCALE, loadHeroRig, type HeroRig } from './hero/HeroRig';
import { ProceduralHero } from './ProceduralHero';
import type { Expression } from './hero/faceTextures';
import { ChibiAnimator } from './chibi/chibiAnim';
import { WeaponTrail } from './chibi/WeaponTrail';
import { attackHit, type SwingShape } from './chibi/chibiClips';
import { loadChibiRig, type ChibiRig } from './chibi/ChibiRig';
import type { Loadout } from '../cosmetics/loadout';
import { defaultOutfit, type Outfit } from '../../game/art/parts';

export type { HeroPose };
const ease = (t: number) => 1 - (1 - t) * (1 - t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A curved sword swoosh: a ribbon bent into an arc, faded along its length with a canvas gradient. */
function swooshMesh(): Mesh<BufferGeometry, MeshBasicMaterial> {
  const seg = 28, a0 = -0.8, a1 = 0.8, r0 = 0.55, r1 = 1.5;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, a = a0 + (a1 - a0) * u;
    for (const [k, r] of [[0, r0], [1, r1]] as const) { pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); uv.push(u, k); }
    if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); g.setIndex(idx);
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const x = c.getContext('2d')!;
  const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,248,214,0.55)'); gr.addColorStop(0.92, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 32);
  x.globalCompositeOperation = 'destination-in';
  const vg = x.createLinearGradient(0, 0, 0, 32); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.5, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = vg; x.fillRect(0, 0, 128, 32);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(g, new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, toneMapped: false }));
  // v2.12: normal blending (not additive): an additive trail vanishes against bright grass, a normal-blended white one stays readable by day and night
  m.visible = false; m.frustumCulled = false; m.renderOrder = 5;
  return m;
}

/** A faint warm pool of light on the ground under the hero: lifts the hero off the busy grass without any real light. */
function groundPool(): Mesh {
  const m = new Mesh(new PlaneGeometry(3.4, 3.4), new MeshBasicMaterial({ map: glowTexture(), color: 0xfff0c4, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 0; return m;
}

let streakTex: CanvasTexture | null = null;
/** A soft comet-like gradient, bright at the front edge (v = 0) and fading to nothing behind it. Shared by every streak. */
function streakTexture(): CanvasTexture {
  if (streakTex) return streakTex;
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.4)'); g.addColorStop(0.93, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.15)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 128);
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 32, 128);
  streakTex = new CanvasTexture(c); streakTex.colorSpace = SRGBColorSpace; return streakTex;
}
/** A flat glowing streak lying along the hero's forward (+Z) axis: stabs, spells, and the speed lines of a dodge. */
function streakMesh(): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: streakTexture(), transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.frustumCulled = false; m.renderOrder = 5; return m;
}
/** Places a streak so its bright end is at `headZ` and it trails `len` metres behind that. */
function placeStreak(m: Mesh, x: number, y: number, headZ: number, len: number, width: number): void { m.position.set(x, y, headZ - len / 2); m.scale.set(width, len, 1); }
/** The ground glow used by the spin's charge-up and shockwave. */
function flatGlow(color: number): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.visible = false; m.renderOrder = 1; return m;
}
const SWING_COLORS = [0xfff1c9, 0xffd77a, 0xc9f4ff] as const;
const sm01 = (t: number) => { const k = clamp01(t); return k * k * (3 - 2 * k); };

/**
 * The hero as the game sees it. It owns the rigged model (see `hero/HeroRig.ts`) and falls back to the original
 * procedural model if the rig cannot be loaded. API is unchanged: `pose()` is called every frame with what the hero is doing.
 */
export class HeroModel {
  readonly root = new Group();
  private readonly fallback = new ProceduralHero();
  private rig: HeroRig | null = null;
  private anim: HeroAnimator | null = null;
  /** The chibi hero (preferred). The older rig above is only used if the chibi kit fails to load. */
  private chibi: ChibiRig | null = null;
  private chibiAnim: ChibiAnimator | null = null;
  private look: Outfit = defaultOutfit();
  private loadout: Loadout | null = null;
  private readonly fx = new Group();
  private readonly swoosh = swooshMesh();
  /** The swoosh hangs off a pivot: tilting the pivot turns the flat arc into a diagonal or an overhead one (v2.12). */
  private readonly swooshPivot = new Group();
  private readonly thrust = streakMesh();
  private readonly dashStreaks = [streakMesh(), streakMesh(), streakMesh()];
  /** v2.12: the blade-following swing trail (chibi hero); the flat ribbon above is only the fallback for a hero with no weapon or the older rig. */
  private readonly trail = new WeaponTrail();
  private trailWas = false; private readonly tipW = new Vector3(); private readonly baseW = new Vector3();
  private readonly spinRing2 = new Mesh(new RingGeometry(0.88, 1, 40), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
  private readonly spinDisc = flatGlow(0x9be8ff);
  private readonly spinRing = new Mesh(new RingGeometry(0.82, 1, 40), new MeshBasicMaterial({ color: 0x9be8ff, transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }));
  private outfit: Record<MeshGroup, number> | null = null;
  private equipment: Equipment = {};
  private flashK = 0;
  private lastTime = -1;
  private lean = 0; private bank = 0; private lastYaw = 0;
  private readonly wpos = new Vector3();
  private onReady: (() => void)[] = [];
  /** True once the rigged hero is showing. */
  ready = false;
  failed = false;

  constructor() {
    this.root.add(this.fallback.root);
    this.fallback.root.visible = false; // hidden until we know whether the rig loads (avoids a one-frame pop)
    this.fx.add(groundPool(), blobShadow(0.74));
    this.swooshPivot.position.y = 0.9; this.swooshPivot.add(this.swoosh);
    this.spinRing.rotation.x = -Math.PI / 2; this.spinRing.position.y = 0.18; this.spinRing.visible = false;
    this.spinRing2.rotation.x = -Math.PI / 2; this.spinRing2.position.y = 0.2; this.spinRing2.visible = false;
    this.root.add(this.trail.mesh);
    this.fx.add(this.swooshPivot, this.spinRing, this.spinRing2, this.spinDisc, this.thrust, ...this.dashStreaks); this.fx.visible = false;
    this.root.add(this.fx);
    const showReady = () => { this.fallback.root.visible = false; this.fx.visible = true; this.ready = true; this.onReady.splice(0).forEach(f => f()); };
    const timings = { attackHitN: COMBAT.attackHitAt / COMBAT.attackDuration, specialBlastN: COMBAT.specialHitAt / COMBAT.specialDuration };
    const idlePose = { speed: 0, time: 0, attack: null, dodge: null, special: null, faint: 0 };
    loadChibiRig().then(rig => {
      this.chibi = rig; this.chibiAnim = new ChibiAnimator(rig, timings); rig.setOutline(this.outlineOn);
      this.root.add(rig.root);
      rig.setOutfit(this.look);
      if (this.loadout) { rig.setLoadout(this.loadout); this.chibiAnim.setLoadout(this.loadout); }
      this.chibiAnim.update(0, idlePose);
      showReady();
    }).catch(err => {
      console.warn('MindQuest: chibi hero failed to load, trying the older rigged hero', err);
      loadHeroRig().then(rig => {
        this.rig = rig; this.anim = new HeroAnimator(rig, timings);
        this.root.add(rig.root);
        if (this.outfit) rig.setOutfit(this.outfit);
        rig.setAccessories(this.equipment);
        this.anim.update(0, idlePose);
        showReady();
      }).catch(err2 => {
        console.warn('MindQuest: rigged hero failed to load, using the simple hero', err2);
        this.failed = true; this.fallback.root.visible = true;
      });
    });
  }

  whenReady(f: () => void): void { if (this.ready) f(); else this.onReady.push(f); }

  setOutfit(colors: Record<MeshGroup, number>): void { this.outfit = colors; this.fallback.setOutfit(colors); this.rig?.setOutfit(colors); }
  setAccessories(eq: Equipment): void { this.equipment = eq; this.fallback.setAccessories(eq); this.rig?.setAccessories(eq); }
  /** The wardrobe's eight colour swatches (indices) for the chibi hero. */
  setLook(o: Outfit): void { this.look = { ...o }; this.chibi?.setOutfit(this.look); }
  /** What the hero wears and holds (the cosmetics inventory, resolved). Changes the shapes, the attack clips and the idle stance. */
  setLoadout(l: Loadout): void { this.loadout = l; this.chibi?.setLoadout(l); this.chibiAnim?.setLoadout(l); }
  /** The attack clip the current weapon uses (for tests and the wardrobe's preview). */
  /** The dark outline around the chibi hero (a quality-tier decision made by the game; see `outlineWanted`). */
  setOutline(on: boolean): void { this.outlineOn = on; this.chibi?.setOutline(on); }
  private outlineOn = true;
  get outlined(): boolean { return this.outlineOn; }
  get isChibi(): boolean { return this.chibi !== null; }
  /** v2.20: world position of a rig bone (the portrait and item thumbnails frame the head, torso, legs and feet from these). False when the chibi rig is not showing. */
  boneWorld(name: string, out: Vector3): boolean { const b = this.chibi?.bone(name); if (!b) return false; b.updateWorldMatrix(true, false); b.getWorldPosition(out); return true; }
  /** v2.20: runs `fn` with the effects hidden (ground glow, swing trail) and, when given, another loadout shown, then puts both back exactly as they were. No frame is drawn in between. */
  snapshotScope(loadout: Loadout | null, fn: () => void): void {
    const fxWas = this.fx.visible, trailWas = this.trail.mesh.visible; this.fx.visible = false; this.trail.mesh.visible = false;
    if (loadout) this.chibi?.setLoadout(loadout);
    try { fn(); } finally { this.fx.visible = fxWas; this.trail.mesh.visible = trailWas; if (loadout && this.loadout) this.chibi?.setLoadout(this.loadout); }
  }
  /** v2.12: spirit glow while a dodge makes the hero untouchable (0..1). */
  setPhase(k: number): void { this.chibi?.setPhase(k); }
  setFlash(k: number): void { this.flashK = k; this.fallback.setFlash(k); this.rig?.setFlash(k); this.chibi?.setFlash(k); }
  get flash(): number { return this.flashK; }
  /** A short flinch (the hero was hit). */
  hit(): void { this.anim?.hit(); this.chibiAnim?.hit(); this.rig?.setExpression('hurt', 0.6); }
  /** A happy face for a moment (collected something, finished a quest). */
  cheer(seconds = 1.4): void { this.rig?.setExpression('happy', seconds); this.chibiAnim?.cheer(seconds + 0.2); }
  setExpression(e: Expression, seconds = 0): void { this.rig?.setExpression(e, seconds); }

  pose(p: HeroPose): void {
    if (this.chibi && this.chibiAnim) {
      const dt = this.lastTime < 0 ? 0 : Math.min(0.1, Math.max(0, p.time - this.lastTime)); this.lastTime = p.time;
      this.chibiAnim.update(dt, p);
      this.chibi.root.rotation.y = p.special !== null ? sm01(p.special) * Math.PI * 2 : 0; // the spin clip turns the hero once on its own
      this.bodyLanguage(dt, p, this.chibi.root);
      this.chibi.blink(p.faint > 0 ? 1 : p.time);
      this.effects(p, g => this.chibi!.setGlow(g), dt);
      return;
    }
    if (!this.rig || !this.anim) {
      if (this.failed) this.fallback.pose({ speed: p.speed, time: p.time, attack: p.attack, dodge: p.dodge, special: p.special, faint: p.faint });
      return;
    }
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, Math.max(0, p.time - this.lastTime)); this.lastTime = p.time;
    this.anim.update(dt, p);
    const rig = this.rig;
    // spin for the special
    rig.root.rotation.y = p.special !== null ? ease(clamp01(p.special / 0.85)) * Math.PI * 4 : 0;
    // the sword is drawn for combat and put away after a moment
    const drawn = this.anim.combatIdle < 1.8;
    if (drawn !== rig.isSwordDrawn) { rig.setSwordDrawn(drawn); }
    rig.root.getWorldPosition(this.wpos);
    rig.updateSecondary(dt, p.time, this.wpos, p.speed);
    this.effects(p, g => rig.setSwordGlow(g), dt);
    void HERO_SCALE;
  }

  /**
   * Procedural body language on top of the clips (v2.9): the hero leans into a run, banks into a turn and crouches a touch into a
   * dodge, all eased so it never snaps. The game sets `root.rotation.y` (the heading) before `pose`, so the turn rate is read from it.
   */
  private bodyLanguage(dt: number, p: HeroPose, node: Group): void {
    const yaw = this.root.rotation.y; const turn = dt > 0 ? wrapAngle(yaw - this.lastYaw) / dt : 0; this.lastYaw = yaw;
    const busy = p.faint > 0 || p.special !== null;
    const leanT = busy ? 0 : p.dodge !== null ? 0.3 : p.attack !== null ? 0.05 : Math.min(0.13, p.speed * 0.024);
    const bankT = busy || p.speed < 0.5 ? 0 : Math.max(-0.14, Math.min(0.14, -turn * 0.03)) * Math.min(1, p.speed / 3);
    const k = smoothingFactor(9, dt);
    this.lean += (leanT - this.lean) * k; this.bank += (bankT - this.bank) * k;
    node.rotation.x = this.lean; node.rotation.z = this.bank;
  }

  /**
   * Swing trails, thrust streaks, spin whirl and shockwaves, dodge speed lines and weapon glow (shared by both rigs). v2.12: the swing's
   * look follows the combo step and weapon: a flat slash, a back-slash on the diagonal, an overhead chop, a forward stab or spell bolt;
   * the third swing is bigger and cooler in colour.
   */
  private effects(p: HeroPose, setGlow: (g: number) => void, dt = 0): void {
    const hitN = COMBAT.attackHitAt / COMBAT.attackDuration;
    const step = Math.min(2, p.combo ?? 0);
    const shape: SwingShape = this.loadout ? attackHit(this.loadout, step).shape : 'slash';
    let glow = 0;
    this.swooshPivot.visible = false; this.thrust.visible = false;
    // blade trail: sampled from the real weapon while the swing is fast (attack) or the whole turn (spin)
    const blastN0 = COMBAT.specialHitAt / COMBAT.specialDuration;
    const nA = p.attack !== null ? clamp01(p.attack) : -1, nS = p.special !== null ? clamp01(p.special) : -1;
    const trailOn = (nA >= hitN - 0.12 && nA <= hitN + 0.3) || (nS >= 0.16 && nS <= blastN0 + 0.4);
    let trailLive = false;
    if (this.chibi && shape !== 'cast') {
      if (trailOn) {
        this.root.updateMatrixWorld(true);
        if (this.chibi.weaponTrailPoints(this.tipW, this.baseW, nS >= 0 ? 2.3 : step === 2 ? 2.1 : 1.9, 0.5)) {
          this.root.worldToLocal(this.tipW); this.root.worldToLocal(this.baseW);
          if (!this.trailWas) this.trail.clear();
          this.trail.push(this.tipW, this.baseW); trailLive = true;
        }
      }
      this.trailWas = trailOn && trailLive;
      const spin = nS >= 0;
      this.trail.life = spin ? 0.34 : 0.2 + step * 0.03;
      this.trail.step(dt, spin ? 0xbfeeff : SWING_COLORS[step], spin ? 1 : 0.95);
    } else { this.trailWas = false; this.trail.clear(); }
    const bladeTrail = this.chibi !== null && shape !== 'cast' && this.trail.count > 0;
    if (p.attack !== null) {
      const n = clamp01(p.attack);
      const f = clamp01((n - (hitN - 0.14)) / 0.42), env = Math.sin(f * Math.PI);
      const color = SWING_COLORS[step], big = 1 + step * 0.14;
      if (f > 0 && f < 1) {
        if (shape === 'stab' || shape === 'cast') {
          const cast = shape === 'cast';
          this.thrust.visible = true; this.thrust.material.color.setHex(cast ? 0xa8e6ff : color); this.thrust.material.opacity = env * 0.95;
          placeStreak(this.thrust, 0, cast ? 1.0 : 0.9, 0.9 + ease(f) * 1.5, 1.0 + f * 1.8, (cast ? 0.5 : 0.3) * big);
        } else if (!bladeTrail) {
          // horizontal slash: right to left; back-slash: diagonal, left to right; chop: a vertical arc swept from overhead down to the front
          const sp = shape === 'slash' ? { tilt: -0.1, dir: 1, from: -1.7, to: 0.1, s: 1 } : shape === 'back' ? { tilt: 0.5, dir: -1, from: 1.7, to: -0.1, s: 1 } : { tilt: 1.05, dir: -1, from: 1.9, to: 0.45, s: 0.95 };
          this.swooshPivot.visible = true; this.swooshPivot.rotation.z = sp.tilt;
          this.swoosh.visible = true; this.swoosh.material.color.setHex(color); this.swoosh.material.opacity = env * 0.95;
          this.swoosh.scale.set(sp.dir * sp.s * big, 1, sp.s * big); this.swoosh.rotation.y = sp.from + (sp.to - sp.from) * ease(f);
        }
      }
      glow = (0.6 + step * 0.2) * Math.sin(n * Math.PI);
    } else this.swoosh.visible = false;

    // special (spin): charge-up glow, a whirl of ribbons round the hero, then two shockwave rings
    const blastN = COMBAT.specialHitAt / COMBAT.specialDuration;
    if (p.special !== null) {
      const n = clamp01(p.special), b = clamp01((n - blastN) / 0.45), b2 = clamp01((n - blastN - 0.07) / 0.45);
      glow = 1;
      const charge = sm01(n / blastN) * (n < blastN ? 1 : 0);
      const flash = n >= blastN ? 1 - b : 0;
      this.spinDisc.visible = charge > 0.01 || flash > 0.01;
      this.spinDisc.material.opacity = charge * 0.55 + flash * 0.9;
      this.spinDisc.scale.setScalar(n < blastN ? 1.6 + charge * 1.2 : 3 + ease(b) * (COMBAT.specialRadius * 1.7));
      if (n > blastN - 0.08) { this.spinRing.visible = true; this.spinRing.scale.setScalar(0.5 + ease(b) * (COMBAT.specialRadius - 0.5)); this.spinRing.material.opacity = (1 - b) * 0.85; }
      if (b2 > 0) { this.spinRing2.visible = true; this.spinRing2.scale.setScalar(0.4 + ease(b2) * (COMBAT.specialRadius * 0.8)); this.spinRing2.material.opacity = (1 - b2) * 0.8; }
    } else { this.spinRing.visible = false; this.spinRing2.visible = false; this.spinDisc.visible = false; }

    // dodge: speed lines streaming behind the hero
    if (p.dodge !== null) {
      const d = clamp01(p.dodge), env = Math.sin(clamp01(d * 1.5) * Math.PI) * (d < 0.7 ? 1 : (1 - d) / 0.3);
      this.dashStreaks.forEach((st, i) => {
        st.visible = env > 0.01; st.material.color.setHex(i === 1 ? 0xffffff : 0xbfeaff); st.material.opacity = env * (i === 1 ? 0.8 : 0.55);
        placeStreak(st, (i - 1) * 0.34, 0.3 + i * 0.28, -0.15 - (i === 1 ? 0 : 0.15), (1.5 + d * 1.7) * (i === 1 ? 1.2 : 1), 0.27);
      });
    } else this.dashStreaks.forEach(st => { st.visible = false; });
    setGlow(glow);
  }
}
