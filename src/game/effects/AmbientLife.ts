import Phaser from 'phaser';
import { butterflyKey, FX, leafKey } from '../art/effects';
import { OBJ } from '../art/painter';
import type { GameAudio } from '../audio/GameAudio';
import { earshot } from '../systems/audioMath';
import { fishArc, isOutside, planFlock, spawnLeaf, stepButterfly, stepLeaf, type Flutterer, type FlockPlan, type Leaf, type ViewRect } from '../systems/ambientLife';
import type { TimeOfDay } from '../systems/dayNight';
import { seededRandom } from '../systems/forestLayout';
import type { PerformanceProfile } from '../systems/performance';
import { isOff } from '../systems/features';
import { windAt } from '../systems/wind';
import { isBridgeZone, isRiverCell, RIVER_HALF_WIDTH, riverCenterX, WORLD_HEIGHT } from '../systems/worldGeometry';
import { Fx, GLOW_DEPTH } from './Fx';

type Point = { x: number; y: number };
export type SwayKind = 'tree' | 'pine' | 'bush' | 'tuft';

/** Lean amplitude in radians. Grass bends the most, trunks the least. */
const SWAY_AMPLITUDE: Record<SwayKind, number> = { tree: 0.024, pine: 0.016, bush: 0.03, tuft: 0.07 };
/** Between the day-night overlay (17000) and the sun shafts (18000): leaves and birds are tinted by it, fireflies are not. */
const SKY_DEPTH = 16950;
/** Butterflies keep one fixed depth: changing an object's depth every frame forces the whole scene to be re-sorted. */
const BUTTERFLY_DEPTH = 16940;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Swayer { obj: Phaser.GameObjects.Image; amp: number; phase: number }
interface LeafSprite { img: Phaser.GameObjects.Image; data: Leaf; size: number }
interface BirdSprite { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; dx: number; dy: number; phase: number }
interface Flock { plan: FlockPlan; x: number; y: number; birds: BirdSprite[]; chirped: boolean; age: number }
interface ButterflySprite { img: Phaser.GameObjects.Image; data: Flutterer }
interface Leap { img: Phaser.GameObjects.Image; from: Point; to: Point; start: number; duration: number; height: number; depth: number; volume: number; landed: boolean }
interface Firefly { img: Phaser.GameObjects.Image; x: number; y: number; phase: number; vx: number; vy: number }

export interface AmbientDeps {
  scene: Phaser.Scene;
  profile: PerformanceProfile;
  fx: Fx;
  audio: GameAudio;
  /** Ground (gameplay) coordinates -> isometric screen coordinates. */
  project: (x: number, y: number) => Point;
  /** The hero's ground position. */
  hero: () => Point;
  /** Ground positions where butterflies live (flower patches). */
  homes: Point[];
}

/**
 * Everything small and decorative that makes the forest feel inhabited: swaying plants, drifting leaves, flocks of
 * birds, butterflies, jumping fish and (after dark) fireflies. All of it is cosmetic; nothing here touches
 * collision or the quest. Off-screen things cost almost nothing: plants outside the view are skipped and the
 * creatures are small fixed pools.
 */
export class AmbientLife {
  private readonly rng = seededRandom(8081);
  private readonly swayers: Swayer[] = [];
  private readonly leaves: LeafSprite[] = [];
  private readonly butterflies: ButterflySprite[] = [];
  private readonly fireflies: Firefly[] = [];
  private flock: Flock | null = null;
  private leaps: Leap[] = [];
  private birdTimer: number;
  private fishTimer: number;
  private ready = false;

  constructor(private readonly d: AmbientDeps) {
    this.birdTimer = 5 + this.rng() * 4;
    this.fishTimer = 2 + this.rng() * 2;
    const { scene, profile } = d;

    for (let i = 0; i < (isOff('leaves') ? 0 : profile.leaves); i++) {
      const size = (0.8 + this.rng() * 0.6) / OBJ;
      const img = scene.add.image(0, 0, leafKey(i)).setScale(size).setDepth(SKY_DEPTH).setVisible(false);
      this.leaves.push({ img, size, data: { x: 0, y: 0, vx: 0, vy: 0, spin: 0, rot: 0, phase: 0 } });
    }
    const homes = d.homes.length ? d.homes : [{ x: 500, y: 400 }];
    for (let i = 0; i < (isOff('butterflies') ? 0 : profile.butterflies); i++) {
      const home = homes[i % homes.length];
      const img = scene.add.image(0, 0, butterflyKey(i)).setScale(1 / OBJ).setDepth(BUTTERFLY_DEPTH).setVisible(false);
      const angle = this.rng() * Math.PI * 2;
      const x = home.x + Math.cos(angle) * 30, y = home.y + Math.sin(angle) * 24;
      this.butterflies.push({ img, data: { x, y, goalX: x, goalY: y, homeX: home.x, homeY: home.y, retarget: this.rng() * 2, speed: 18 + this.rng() * 12, phase: this.rng() * 6.28 } });
    }
    for (let i = 0; i < (isOff('fireflies') ? 0 : profile.nightFireflies); i++) {
      const img = scene.add.image(0, 0, 'paint-glow-firefly').setBlendMode(Phaser.BlendModes.ADD).setScale(0.2 + this.rng() * 0.08).setDepth(GLOW_DEPTH - 2).setVisible(false);
      this.fireflies.push({ img, x: 0, y: 0, phase: this.rng() * 6.28, vx: (this.rng() - 0.5) * 6, vy: (this.rng() - 0.5) * 5 });
    }
  }

  /** Registers a plant so it leans with the wind. */
  addSway(obj: Phaser.GameObjects.Image, kind: SwayKind) {
    if (isOff('sway')) return;
    this.swayers.push({ obj, amp: SWAY_AMPLITUDE[kind], phase: this.rng() * 6.28 });
  }

  stats() {
    return {
      swaying: this.swayers.length,
      leaves: this.leaves.filter((l) => l.img.visible).length,
      butterflies: this.butterflies.filter((b) => b.img.visible).length,
      fireflies: this.fireflies.filter((f) => f.img.visible).length,
      birds: this.flock?.birds.length ?? 0,
      leaping: this.leaps.length,
    };
  }

  /** Debug/test hooks: start a flock or a leap right now instead of waiting for the timers. */
  forceFlock() { this.birdTimer = 0; }
  forceLeap() { this.fishTimer = 0; }

  update(time: number, dt: number, tod: TimeOfDay) {
    const view = this.d.scene.cameras.main.worldView;
    if (view.width <= 0 || view.height <= 0) return; // the camera has not rendered its first frame yet
    const sec = dt / 1000;
    if (!this.ready) this.populate(view);
    this.updateSway(time, view);
    this.updateLeaves(time, sec, view, tod);
    this.updateBirds(time, sec, view, tod);
    this.updateButterflies(time, sec, tod);
    this.updateFish(time, sec, view);
    this.updateFireflies(time, sec, view, tod);
  }

  private populate(view: ViewRect) {
    this.ready = true;
    for (const leaf of this.leaves) { leaf.data = spawnLeaf(this.rng, view, true); leaf.img.setVisible(true); }
    for (const f of this.fireflies) { f.x = view.x + this.rng() * view.width; f.y = view.y + this.rng() * view.height; }
  }

  // ------------------------------------------------------------------ plants

  private updateSway(time: number, view: ViewRect) {
    const pad = 70;
    for (const s of this.swayers) {
      const { x, y } = s.obj;
      if (x < view.x - pad || x > view.x + view.width + pad || y < view.y - pad || y > view.y + view.height + pad + 60) continue;
      s.obj.rotation = s.amp * (windAt(time, x) * 0.85 + 0.3 * Math.sin(time * 0.0035 + s.phase));
    }
  }

  // ------------------------------------------------------------------ leaves

  private updateLeaves(time: number, sec: number, view: ViewRect, tod: TimeOfDay) {
    const alpha = 0.92 * clamp(tod.daylight * 1.2 + 0.3, 0.3, 1);
    for (const leaf of this.leaves) {
      const d = leaf.data;
      stepLeaf(d, sec, windAt(time, d.x), time / 1000);
      if (isOutside(d.x, d.y, view, 50)) leaf.data = spawnLeaf(this.rng, view, false);
      // Squashing one axis as it turns makes the leaf look like it is tumbling.
      leaf.img.setPosition(d.x, d.y).setRotation(d.rot).setScale(leaf.size, leaf.size * (0.35 + 0.65 * Math.abs(Math.cos(time / 380 + d.phase)))).setAlpha(alpha);
    }
  }

  // ------------------------------------------------------------------ birds

  private updateBirds(time: number, sec: number, view: ViewRect, tod: TimeOfDay) {
    if (isOff('birds')) return;
    if (!this.flock) {
      this.birdTimer -= sec;
      if (this.birdTimer > 0) return;
      if (tod.daylight < 0.35) { this.birdTimer = 4; return; } // birds roost once the light fades
      this.flock = this.spawnFlock(view);
      return;
    }
    const flock = this.flock, plan = flock.plan;
    flock.x += plan.dir * plan.speed * sec;
    flock.y += plan.dir * plan.slope * plan.speed * sec;
    if (!flock.chirped && Math.abs(flock.x - (view.x + view.width / 2)) < view.width * 0.3) {
      flock.chirped = true;
      this.d.audio.chirp(0.9, clamp((flock.x - (view.x + view.width / 2)) / view.width * 2, -1, 1));
    }
    for (const bird of flock.birds) {
      const x = flock.x + bird.dx, y = flock.y + bird.dy + Math.sin(time / 190 + bird.phase) * 1.6;
      bird.img.setPosition(x, y).setTexture(Math.sin(time / 70 + bird.phase) > 0 ? FX.birdUp : FX.birdDown).setAlpha(clamp(tod.daylight * 2, 0.4, 1));
      bird.shadow.setPosition(x - 2, y + 38);
    }
    // Gone once the last bird has cleared the far edge (or after a while, if the camera moved away).
    flock.age += sec;
    const trailing = plan.dir === 1 ? flock.x + Math.min(...plan.members.map((m) => m.dx)) : flock.x + Math.max(...plan.members.map((m) => m.dx));
    const cleared = plan.dir === 1 ? trailing > view.x + view.width + 60 : trailing < view.x - 60;
    if (cleared || flock.age > 40) {
      for (const bird of flock.birds) { bird.img.destroy(); bird.shadow.destroy(); }
      this.flock = null;
      const [min, max] = this.d.profile.birdGap;
      this.birdTimer = min + this.rng() * (max - min);
    }
  }

  private spawnFlock(view: ViewRect): Flock {
    const plan = planFlock(this.rng, view);
    const birds = plan.members.map((m) => ({
      img: this.d.scene.add.image(0, 0, FX.birdUp).setScale(24 / (28 * OBJ)).setFlipX(plan.dir === -1).setDepth(SKY_DEPTH),
      shadow: this.d.scene.add.ellipse(0, 0, 13, 5, 0x10281c, 0.2).setDepth(-4.5),
      dx: m.dx, dy: m.dy, phase: m.phase,
    }));
    return { plan, x: plan.start.x, y: plan.start.y, birds, chirped: false, age: 0 };
  }

  // ------------------------------------------------------------------ butterflies

  private updateButterflies(time: number, sec: number, tod: TimeOfDay) {
    const hero = this.d.hero();
    const fade = clamp((tod.daylight - 0.15) / 0.35, 0, 1);
    for (const b of this.butterflies) {
      stepButterfly(b.data, sec, this.rng, hero);
      b.img.setVisible(fade > 0);
      if (fade <= 0) continue;
      const p = this.d.project(b.data.x, b.data.y);
      const flap = 0.28 + 0.72 * Math.abs(Math.sin(time * 0.021 + b.data.phase));
      b.img.setPosition(p.x, p.y - 16 - Math.sin(time / 320 + b.data.phase) * 3.5)
        .setScale(flap / OBJ, 1 / OBJ).setRotation(Math.sin(time / 260 + b.data.phase) * 0.3).setAlpha(fade);
    }
  }

  // ------------------------------------------------------------------ fish

  private updateFish(time: number, sec: number, view: ViewRect) {
    if (isOff('fish')) return;
    this.fishTimer -= sec;
    if (this.fishTimer <= 0) {
      const [min, max] = this.d.profile.fishGap;
      this.fishTimer = this.startLeap(time, view) ? min + this.rng() * (max - min) : 1;
    }
    this.leaps = this.leaps.filter((leap) => {
      const t = (time - leap.start) / leap.duration;
      if (t >= 1) {
        leap.img.destroy();
        if (!leap.landed) this.land(leap);
        return false;
      }
      const arc = fishArc(t, leap.from, leap.to, leap.height);
      leap.img.setPosition(arc.x, arc.y).setRotation(arc.rotation);
      return true;
    });
  }

  /** Picks a spot in the river the player can see and sends a fish jumping across it. */
  private startLeap(time: number, view: ViewRect): boolean {
    const hero = this.d.hero();
    for (let attempt = 0; attempt < 10; attempt++) {
      const y = clamp(hero.y + (this.rng() - 0.5) * 560, 40, WORLD_HEIGHT - 40);
      const x = riverCenterX(y) + (this.rng() - 0.5) * 2 * (RIVER_HALF_WIDTH - 40);
      const dir = this.rng() < 0.5 ? -1 : 1;
      const toX = x + dir * (26 + this.rng() * 14), toY = y + (this.rng() - 0.5) * 18;
      if (isBridgeZone(x, y) || isBridgeZone(toX, toY) || !isRiverCell(toX, toY)) continue;
      const from = this.d.project(x, y), to = this.d.project(toX, toY);
      if (isOutside(from.x, from.y, view, -20) || isOutside(to.x, to.y, view, -20)) continue;
      const volume = earshot(Math.hypot(x - hero.x, y - hero.y));
      const img = this.d.scene.add.image(from.x, from.y, FX.fish).setScale(15 / (16 * OBJ)).setFlipX(to.x < from.x).setDepth(from.y + 14);
      this.leaps.push({ img, from, to, start: time, duration: 640 + this.rng() * 160, height: 22 + this.rng() * 10, depth: from.y, volume, landed: false });
      this.d.fx.splash(from.x, from.y, 'small');
      this.d.audio.fishLeap(volume);
      return true;
    }
    return false;
  }

  private land(leap: Leap) {
    leap.landed = true;
    this.d.fx.splash(leap.to.x, leap.to.y, 'small');
    this.d.audio.splash(leap.volume * 0.7, 'small');
  }

  // ------------------------------------------------------------------ fireflies

  private updateFireflies(time: number, sec: number, view: ViewRect, tod: TimeOfDay) {
    const on = tod.night > 0.05;
    for (const f of this.fireflies) {
      f.img.setVisible(on);
      if (!on) continue;
      f.x += (f.vx + Math.sin(time / 900 + f.phase) * 5) * sec;
      f.y += (f.vy + Math.cos(time / 1100 + f.phase * 1.7) * 4 - 1.5) * sec;
      if (isOutside(f.x, f.y, view, 30)) {
        f.x = view.x + this.rng() * view.width; f.y = view.y + this.rng() * view.height;
      }
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin(time / 520 + f.phase));
      f.img.setPosition(f.x, f.y).setAlpha(clamp(tod.night * pulse * 1.1, 0, 1));
    }
  }
}

