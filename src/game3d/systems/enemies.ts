/**
 * Enemy behaviour for the 3D game: a small state machine per enemy (pure, unit-tested). Every attack is announced by a
 * `telegraph` (a ground shape the scene draws as a glowing warning) before the `strike` lands, so players can read it.
 * Defeat is a harmless "poof": no gore.
 */
import type { Vec2 } from './movement3d';

export type EnemyKind = 'sprout' | 'mossback' | 'shardling' | 'warden' | 'crab' | 'gull' | 'heron';
export type EnemyState = 'idle' | 'chase' | 'telegraph' | 'strike' | 'recover' | 'defeated';

export type Shape =
  | { type: 'circle'; x: number; z: number; r: number }
  | { type: 'line'; x: number; z: number; dx: number; dz: number; length: number; width: number };

export type EnemyEvent =
  | { kind: 'telegraph'; attack: string; shape: Shape; duration: number }
  | { kind: 'strike'; attack: string; shape: Shape; damage: number }
  /** `weak` is true when the blow landed on an exposed weak spot and counted double (the Hollow Warden while it recovers). */
  | { kind: 'hit'; remaining: number; weak?: boolean }
  /** v2.29: a blow landed on a shell that guards the front (the Pebble Crab): no damage, so the scene can play a clink and (once) explain why. */
  | { kind: 'blocked' }
  | { kind: 'phase'; phase: number }
  | { kind: 'defeated' };

export interface EnemyDef {
  kind: EnemyKind; maxHp: number; radius: number; moveSpeed: number; aggroRange: number; leashRange: number;
  attacks: readonly string[]; telegraphTime: number; recoverTime: number; touchDamage: number;
  /** Seconds the defeat animation plays before the body is removed (the boss gets a proper send-off). */
  deathTime: number;
  /** A boss gets the health bar, the camera pull-back and the big send-off. */
  boss: boolean;
  /** A blow during the wind-up cancels a small enemy's attack; a boss is never interrupted (so its pattern stays readable). */
  interruptible: boolean;
  /** Seconds the strike lasts before recovery (the damage is dealt when it starts; the rest is the model's follow-through). */
  strikeTime: number;
  /** How close the hero must be for each attack to begin; the enemy walks closer until then. Anything missing uses `defaultReach`. */
  reach: Readonly<Record<string, number>>;
  defaultReach: number;
  /** Attacks that lock their aim when the wind-up starts (the model stops turning to follow the hero, so the shape is honest). */
  lockAim: readonly string[];
  /** Attacks that carry the enemy along the line while it strikes (a charge or a roll). */
  dash: Readonly<Record<string, { speed: number; time: number }>>;
  /** Health fraction at which the second phase begins (faster, and `attacks2` if given). Omitted = no second phase. */
  phaseAt?: number;
  attacks2?: readonly string[];
  /** Damage multiplier while it recovers: the exposed weak spot. */
  weakWhileRecover?: number;
  /** Walks back to where it started when it loses interest, instead of standing where it gave up. */
  returnsHome: boolean;
  /**
   * v2.29 (Pebble Crab): a shell guards its front. A normal blow from the front arc is blocked (no damage) unless the creature is
   * recovering (shell open); a blow from the side or behind lands. The spin attack ignores the guard. `cos` is the cosine of the half-angle
   * of the guarded arc (0.25 = about 75 degrees either side of where it faces).
   */
  frontGuard?: { cos: number };
  /** Radians per second it can turn to face the hero (chasing and winding up). Omitted = it turns at once (every older creature). */
  turnRate?: number;
}

export const ENEMY_DEFS: Readonly<Record<EnemyKind, EnemyDef>> = {
  sprout: { kind: 'sprout', maxHp: 3, radius: 0.5, moveSpeed: 1.8, aggroRange: 7, leashRange: 12, attacks: ['hop'], telegraphTime: 0.8, recoverTime: 1.0, touchDamage: 1, deathTime: 0.55,
    boss: false, interruptible: true, strikeTime: 0.2, reach: {}, defaultReach: 1.6, lockAim: [], dash: {}, returnsHome: false },
  mossback: { kind: 'mossback', maxHp: 14, radius: 1.3, moveSpeed: 1.6, aggroRange: 14, leashRange: 22, attacks: ['slam', 'charge', 'sporeRing'], telegraphTime: 1.1, recoverTime: 1.6, touchDamage: 1, deathTime: 2.0,
    boss: true, interruptible: false, strikeTime: 0.2, reach: { charge: 9, sporeRing: 6, slam: 3.2 }, defaultReach: 3.2, lockAim: ['charge'], dash: { charge: { speed: 9, time: 0.45 } }, phaseAt: 0.5, returnsHome: false },
  /**
   * v2.28 Crystal Hollow: a small rock critter with a crest of crystal shards. It skitters at you faster than a sprout, curls into a ball
   * (the wind-up) and rolls along a straight line (the strike). One more point of health than a sprout, same fair warning.
   */
  shardling: { kind: 'shardling', maxHp: 4, radius: 0.5, moveSpeed: 2.5, aggroRange: 8, leashRange: 15, attacks: ['roll'], telegraphTime: 0.8, recoverTime: 1.2, touchDamage: 1, deathTime: 0.7,
    boss: false, interruptible: true, strikeTime: 0.4, reach: { roll: 5 }, defaultReach: 5, lockAim: ['roll'], dash: { roll: { speed: 8, time: 0.4 } }, returnsHome: true },
  /**
   * v2.28 The Hollow Warden, a crystal guardian that swallowed the Heartstone's light. Three readable attacks (a falling-crystal circle that
   * marks where the hero STANDS, a long narrow prism beam, a ring around itself), a faster second phase with the circle twice, and one rule
   * to learn: while it recovers its dimmed heart is exposed and every blow counts double.
   */
  warden: { kind: 'warden', maxHp: 30, radius: 1.25, moveSpeed: 1.5, aggroRange: 10, leashRange: 30, attacks: ['shardRain', 'prismBeam', 'novaRing'], telegraphTime: 1.2, recoverTime: 1.8, touchDamage: 1, deathTime: 2.6,
    boss: true, interruptible: false, strikeTime: 0.5, reach: { shardRain: 9, prismBeam: 11, novaRing: 5 }, defaultReach: 6, lockAim: ['prismBeam'], dash: {},
    phaseAt: 0.5, attacks2: ['shardRain', 'prismBeam', 'shardRain', 'novaRing'], weakWhileRecover: 2, returnsHome: true },
  /**
   * v2.29 Moonwake Shore. The Pebble Crab: a stout little crab in a pebble shell. Its shell guards the front and it turns slowly, so the lesson
   * is to step round to its side or back, or to hit it while it is dizzy after a scuttle (the dash along a warned line).
   */
  crab: { kind: 'crab', maxHp: 4, radius: 0.6, moveSpeed: 1.7, aggroRange: 8, leashRange: 15, attacks: ['scuttle'], telegraphTime: 0.9, recoverTime: 1.5, touchDamage: 1, deathTime: 0.7,
    boss: false, interruptible: true, strikeTime: 0.4, reach: { scuttle: 5.5 }, defaultReach: 5.5, lockAim: ['scuttle'], dash: { scuttle: { speed: 7.5, time: 0.45 } }, returnsHome: true,
    frontGuard: { cos: 0.25 }, turnRate: 2.1 },
  /** The Gloom Gull: a grey-feathered gull that circles, then swoops along a warned line (a shardling's roll, in the air). A blow in the wind-up interrupts it. */
  gull: { kind: 'gull', maxHp: 3, radius: 0.55, moveSpeed: 2.9, aggroRange: 9, leashRange: 17, attacks: ['swoop'], telegraphTime: 0.9, recoverTime: 1.3, touchDamage: 1, deathTime: 0.7,
    boss: false, interruptible: true, strikeTime: 0.5, reach: { swoop: 6.5 }, defaultReach: 6.5, lockAim: ['swoop'], dash: { swoop: { speed: 11, time: 0.55 } }, returnsHome: true },
  /**
   * The Tidecaller Heron, a tall grey heron that stopped the tide. Three telegraphed attacks (a water spout where the hero STANDS, a long
   * wing-sweep line, a tidal ring round itself), a faster second phase with the spout twice, and the same rule as the Warden: while it preens
   * (recovers) it is exposed and every blow counts double. It never leaves the lighthouse island.
   */
  heron: { kind: 'heron', maxHp: 32, radius: 1.1, moveSpeed: 1.6, aggroRange: 11, leashRange: 30, attacks: ['waterSpout', 'wingSweep', 'tidalRing'], telegraphTime: 1.2, recoverTime: 1.9, touchDamage: 1, deathTime: 2.6,
    boss: true, interruptible: false, strikeTime: 0.5, reach: { waterSpout: 9, wingSweep: 8, tidalRing: 5 }, defaultReach: 6, lockAim: ['wingSweep'], dash: {},
    phaseAt: 0.5, attacks2: ['waterSpout', 'wingSweep', 'waterSpout', 'tidalRing'], weakWhileRecover: 2, returnsHome: true },
};

/** Does a point (with radius) lie inside a telegraph shape? Used both to draw nothing wrong and to apply the strike. */
export function shapeHits(shape: Shape, p: Vec2, radius = 0.35): boolean {
  if (shape.type === 'circle') return Math.hypot(p.x - shape.x, p.z - shape.z) <= shape.r + radius;
  const rx = p.x - shape.x, rz = p.z - shape.z;
  const along = rx * shape.dx + rz * shape.dz;
  if (along < -radius || along > shape.length + radius) return false;
  const across = Math.abs(rx * -shape.dz + rz * shape.dx);
  return across <= shape.width / 2 + radius;
}

let nextId = 1;

export class Enemy {
  readonly id = nextId++;
  readonly def: EnemyDef;
  hp: number;
  state: EnemyState = 'idle';
  pos: Vec2;
  readonly home: Vec2;
  heading = 0;
  /** Seconds since entering the current state. */
  t = 0;
  /** Seconds since defeat, for the poof effect. */
  poof = 0;
  phase = 1;
  currentAttack = '';
  private attackIndex = 0;
  private strikeShape: Shape | null = null;
  private chargeDir: Vec2 = { x: 0, z: 1 };
  private lastHitIds = new Set<number>();
  /** What the scene needs to remember about this one (the Hollow gives each Shardling an id so a calmed one stays calmed). */
  tag: number | null = null;
  /** Short flash timer for hit feedback. */
  hurtFlash = 0;
  /** Counts up with every blow taken: views use it to start a hit reaction exactly once per hit. */
  hitCount = 0;

  constructor(kind: EnemyKind, pos: Vec2) { this.def = ENEMY_DEFS[kind]; this.hp = this.def.maxHp; this.pos = { ...pos }; this.home = { ...pos }; }

  get defeated(): boolean { return this.state === 'defeated'; }
  /** True while the strike carries the enemy along a line (a charge or a roll): touching it then hurts. */
  get dashing(): boolean { return this.state === 'strike' && this.def.dash[this.currentAttack] !== undefined; }
  /** Its weak spot is showing: blows count extra (see `EnemyDef.weakWhileRecover`). */
  get exposed(): boolean { return this.state === 'recover' && (this.def.weakWhileRecover ?? 1) > 1; }
  get telegraphProgress(): number { return this.state === 'telegraph' ? Math.min(1, this.t / this.telegraphTime) : 0; }
  private get telegraphTime(): number { return this.def.telegraphTime * (this.phase >= 2 ? 0.75 : 1); }

  /**
   * Damage from a swing. `hitId` makes the same swing count once however many frames it overlaps the enemy.
   * The boss is not interrupted by hits (so its pattern stays readable) but flashes.
   */
  takeDamage(amount: number, hitId: number, from?: Vec2, pierce = false): EnemyEvent[] {
    if (this.defeated || amount <= 0 || this.lastHitIds.has(hitId)) return [];
    this.lastHitIds.add(hitId);
    if (this.lastHitIds.size > 32) this.lastHitIds.delete(this.lastHitIds.values().next().value as number);
    if (!pierce && from && this.guarded(from)) return [{ kind: 'blocked' }];
    const weak = this.exposed, dealt = weak ? amount * (this.def.weakWhileRecover as number) : amount;
    this.hp = Math.max(0, this.hp - dealt);
    this.hurtFlash = 0.18; this.hitCount++;
    const ev: EnemyEvent[] = [{ kind: 'hit', remaining: this.hp, ...(weak ? { weak: true } : {}) }];
    if (this.hp <= 0) { this.state = 'defeated'; this.t = 0; this.poof = 0; ev.push({ kind: 'defeated' }); return ev; }
    if (this.def.phaseAt !== undefined && this.phase === 1 && this.hp <= this.def.maxHp * this.def.phaseAt) { this.phase = 2; ev.push({ kind: 'phase', phase: 2 }); }
    if (this.def.interruptible && this.state === 'telegraph') this.enter('recover'); // a hit interrupts a small enemy's attack
    return ev;
  }

  private enter(s: EnemyState): void { this.state = s; this.t = 0; }

  /**
   * Does the shell stop a blow that comes from `from`? Only creatures with a `frontGuard` have one, only while the shell is closed (not while
   * recovering) and only for a blow from the front arc of where the creature faces.
   */
  guarded(from: Vec2): boolean {
    const g = this.def.frontGuard;
    if (!g || this.state === 'recover' || this.state === 'defeated') return false;
    const dx = from.x - this.pos.x, dz = from.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 1e-6) return false;
    return (dx / d) * Math.sin(this.heading) + (dz / d) * Math.cos(this.heading) > g.cos;
  }
  /** Turns the heading toward a point, no faster than the creature's `turnRate` (at once when it has none). */
  private face(dx: number, dz: number, dt: number): void {
    const want = Math.atan2(dx, dz), rate = this.def.turnRate;
    if (rate === undefined) { this.heading = want; return; }
    let diff = want - this.heading; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    const step = rate * dt; this.heading += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
  }

  update(dt: number, player: Vec2): EnemyEvent[] {
    const events: EnemyEvent[] = [];
    if (!(dt > 0)) return events;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.state === 'defeated') { this.poof += dt; return events; }
    this.t += dt;
    const dx = player.x - this.pos.x, dz = player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const homeDist = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);

    switch (this.state) {
      case 'idle':
        if (dist <= this.def.aggroRange) this.enter('chase');
        else if (this.def.returnsHome && homeDist > 0.4) { // lost interest: wander back to where it started
          const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, hd = Math.hypot(hx, hz), step = Math.min(hd, this.def.moveSpeed * 0.8 * dt);
          this.pos.x += (hx / hd) * step; this.pos.z += (hz / hd) * step; this.heading = Math.atan2(hx, hz);
        }
        break;
      case 'chase': {
        if (dist > this.def.leashRange || homeDist > this.def.leashRange) { this.enter('idle'); break; }
        if (dist > 1e-6) this.face(dx, dz, dt);
        const speed = this.def.moveSpeed * (this.phase >= 2 ? 1.25 : 1);
        const reach = this.attackReach();
        if (dist > reach) { this.pos.x += (dx / dist) * speed * dt; this.pos.z += (dz / dist) * speed * dt; }
        else this.beginAttack(player, events);
        break;
      }
      case 'telegraph':
        if (!this.def.lockAim.includes(this.currentAttack) && dist > 1e-6) this.face(dx, dz, dt); // keep aiming until the line is locked
        if (this.t >= this.telegraphTime) this.doStrike(events);
        break;
      case 'strike': {
        const dash = this.def.dash[this.currentAttack];
        if (dash) {
          this.pos.x += this.chargeDir.x * dash.speed * dt; this.pos.z += this.chargeDir.z * dash.speed * dt;
          if (this.t >= dash.time) this.enter('recover');
        } else if (this.t >= this.def.strikeTime) this.enter('recover');
        break;
      }
      case 'recover':
        if (this.t >= this.def.recoverTime * (this.phase >= 2 ? 0.8 : 1)) this.enter(dist <= this.def.aggroRange ? 'chase' : 'idle');
        break;
    }
    return events;
  }

  private get attackList(): readonly string[] { return this.phase >= 2 && this.def.attacks2 ? this.def.attacks2 : this.def.attacks; }
  private nextAttack(): string { const l = this.attackList; return l[this.attackIndex % l.length]; }
  private attackReach(): number { return this.def.reach[this.nextAttack()] ?? this.def.defaultReach; }

  private beginAttack(player: Vec2, events: EnemyEvent[]): void {
    const attack = this.nextAttack();
    this.attackIndex++;
    this.currentAttack = attack;
    const dx = player.x - this.pos.x, dz = player.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / d, z: dz / d };
    let shape: Shape;
    switch (attack) {
      case 'charge': this.chargeDir = dir; shape = { type: 'line', x: this.pos.x, z: this.pos.z, dx: dir.x, dz: dir.z, length: 4.5 + 0.0, width: 2.4 }; break;
      case 'roll': this.chargeDir = dir; shape = { type: 'line', x: this.pos.x, z: this.pos.z, dx: dir.x, dz: dir.z, length: 4.4, width: 1.5 }; break;
      case 'sporeRing': shape = { type: 'circle', x: this.pos.x, z: this.pos.z, r: 5 }; break;
      case 'slam': shape = { type: 'circle', x: this.pos.x + dir.x * 1.6, z: this.pos.z + dir.z * 1.6, r: 2.6 }; break;
      // the Warden: crystals fall where the hero stands NOW (so the hero must move), a long thin beam, and a ring round the Warden
      case 'shardRain': shape = { type: 'circle', x: player.x, z: player.z, r: 2.3 }; break;
      case 'prismBeam': shape = { type: 'line', x: this.pos.x, z: this.pos.z, dx: dir.x, dz: dir.z, length: 13, width: 1.7 }; break;
      case 'novaRing': shape = { type: 'circle', x: this.pos.x, z: this.pos.z, r: 5.2 }; break;
      // Moonwake Shore: a crab scuttles along a line, a gull swoops along a longer one; the heron's spout falls where the hero STANDS, its wing sweeps a long line, its ring surrounds it
      case 'scuttle': this.chargeDir = dir; shape = { type: 'line', x: this.pos.x, z: this.pos.z, dx: dir.x, dz: dir.z, length: 4.4, width: 1.6 }; break;
      case 'swoop': this.chargeDir = dir; shape = { type: 'line', x: this.pos.x, z: this.pos.z, dx: dir.x, dz: dir.z, length: 6.6, width: 1.5 }; break;
      case 'waterSpout': shape = { type: 'circle', x: player.x, z: player.z, r: 2.3 }; break;
      case 'wingSweep': shape = { type: 'line', x: this.pos.x, z: this.pos.z, dx: dir.x, dz: dir.z, length: 12, width: 2.4 }; break;
      case 'tidalRing': shape = { type: 'circle', x: this.pos.x, z: this.pos.z, r: 5.4 }; break;
      default: shape = { type: 'circle', x: this.pos.x + dir.x * 0.8, z: this.pos.z + dir.z * 0.8, r: 1.3 }; // sprout hop
    }
    this.strikeShape = shape;
    this.enter('telegraph');
    events.push({ kind: 'telegraph', attack, shape, duration: this.telegraphTime });
  }

  private doStrike(events: EnemyEvent[]): void {
    const shape = this.strikeShape;
    this.enter('strike');
    if (!shape) return;
    if (shape.type === 'line' && this.def.lockAim.includes(this.currentAttack)) this.heading = Math.atan2(shape.dx, shape.dz);
    events.push({ kind: 'strike', attack: this.currentAttack, shape, damage: this.def.touchDamage });
  }
}
