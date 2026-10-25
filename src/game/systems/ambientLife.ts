/** Motion rules for the small decorative creatures. Pure functions over plain data, so they can be unit-tested; the Phaser sprites live in effects/AmbientLife.ts. */

export interface ViewRect { x: number; y: number; width: number; height: number }
type Rng = () => number;

// ------------------------------------------------------------------ drifting leaves

export interface Leaf { x: number; y: number; vx: number; vy: number; spin: number; rot: number; phase: number }

/** A leaf somewhere in (or just beside) the view; when `anywhere` is false it enters from the upwind edge. */
export function spawnLeaf(rng: Rng, view: ViewRect, anywhere: boolean): Leaf {
  let x = view.x + rng() * view.width, y = view.y + rng() * view.height;
  if (!anywhere) {
    if (rng() < 0.5) { y = view.y - 24; x = view.x + rng() * (view.width + 60) - 60; } else { x = view.x - 24; y = view.y + rng() * view.height; }
  }
  return { x, y, vx: 6 + rng() * 10, vy: 9 + rng() * 12, spin: (rng() - 0.5) * 2.4, rot: rng() * Math.PI * 2, phase: rng() * Math.PI * 2 };
}

/** Moves a leaf by `dt` seconds: pushed along by the wind, bobbing as it falls, tumbling slowly. */
export function stepLeaf(leaf: Leaf, dt: number, wind: number, timeSeconds: number): void {
  leaf.x += (leaf.vx + wind * 14) * dt;
  leaf.y += (leaf.vy + Math.sin(timeSeconds * 1.6 + leaf.phase) * 6) * dt;
  leaf.rot += leaf.spin * dt;
}

export function isOutside(x: number, y: number, view: ViewRect, pad = 40): boolean {
  return x < view.x - pad || y < view.y - pad || x > view.x + view.width + pad || y > view.y + view.height + pad;
}

// ------------------------------------------------------------------ birds

export interface FlockPlan {
  dir: 1 | -1;
  /** Screen px per second along x. */
  speed: number;
  /** y change per x travelled. */
  slope: number;
  start: { x: number; y: number };
  members: Array<{ dx: number; dy: number; phase: number }>;
}

/** A small V-shaped flock that crosses the view from one side to the other. */
export function planFlock(rng: Rng, view: ViewRect): FlockPlan {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const count = 2 + Math.floor(rng() * 3);
  const members = Array.from({ length: count }, (_, i) => ({
    dx: -dir * (i * 15 + rng() * 6),
    dy: (i % 2 === 0 ? -1 : 1) * Math.ceil(i / 2) * 9 + (rng() - 0.5) * 4,
    phase: rng() * Math.PI * 2,
  }));
  return {
    dir, speed: 62 + rng() * 30, slope: (rng() - 0.35) * 0.22, members,
    start: { x: dir === 1 ? view.x - 50 : view.x + view.width + 50, y: view.y + view.height * (0.1 + 0.4 * rng()) },
  };
}

// ------------------------------------------------------------------ butterflies

export interface Flutterer {
  /** Ground position and the point it is drifting toward. */
  x: number; y: number; goalX: number; goalY: number;
  homeX: number; homeY: number;
  /** Seconds until it picks a new spot, and its cruising speed (ground px/s). */
  retarget: number; speed: number;
  phase: number;
}

export const BUTTERFLY_RANGE = 90;
export const BUTTERFLY_SHY = 64;

/** Wanders around its home flower patch; startled butterflies dart away from the hero, then drift back. */
export function stepButterfly(b: Flutterer, dt: number, rng: Rng, hero: { x: number; y: number }): void {
  const away = { x: b.x - hero.x, y: b.y - hero.y };
  const near = Math.hypot(away.x, away.y);
  let boost = 1;
  if (near < BUTTERFLY_SHY) {
    const len = Math.max(near, 0.001);
    b.goalX = b.x + (away.x / len) * (70 + rng() * 40);
    b.goalY = b.y + (away.y / len) * (70 + rng() * 40);
    b.retarget = 1.2;
    boost = 2.4;
  } else {
    b.retarget -= dt;
    if (b.retarget <= 0) {
      const angle = rng() * Math.PI * 2, reach = BUTTERFLY_RANGE * Math.sqrt(rng());
      b.goalX = b.homeX + Math.cos(angle) * reach;
      b.goalY = b.homeY + Math.sin(angle) * reach * 0.8;
      b.retarget = 1.5 + rng() * 2.5;
    }
  }
  const dx = b.goalX - b.x, dy = b.goalY - b.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return;
  const step = Math.min(dist, b.speed * boost * dt);
  b.x += (dx / dist) * step;
  b.y += (dy / dist) * step;
}

// ------------------------------------------------------------------ fish

export interface Arc { x: number; y: number; rotation: number }

/**
 * Position and heading of a leaping fish at `t` (0..1): a parabola from `from` to `to` that rises `height` px.
 * The fish sprite is drawn facing right and flipped when it travels left, so `rotation` is the tilt of its nose
 * relative to that facing: negative lifts it while rising, positive tips it down while falling.
 */
export function fishArc(t: number, from: { x: number; y: number }, to: { x: number; y: number }, height: number): Arc {
  const u = Math.min(1, Math.max(0, t));
  const x = from.x + (to.x - from.x) * u;
  const y = from.y + (to.y - from.y) * u - 4 * height * u * (1 - u);
  const vx = to.x - from.x, vy = to.y - from.y - 4 * height * (1 - 2 * u);
  return { x, y, rotation: Math.atan2(vy, Math.max(Math.abs(vx), 0.001)) * (vx < 0 ? -1 : 1) };
}
