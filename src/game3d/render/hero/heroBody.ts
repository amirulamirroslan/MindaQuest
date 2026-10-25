/**
 * The hero's skinned body: skin, tunic, trousers, boots, belt and trim, all modelled as sweeps around the Universal Animation
 * Library skeleton (rest pose = T-pose, 1.78 m, facing +Z, the character's left on +X). Bone names are the library's own.
 */
import { Vector3 } from 'three';
import { PartBuilder, blendAlong, lerp, ringsFromTable, smooth, sweep, type Ring, type Weights } from './geom';

export type Side = 'l' | 'r';
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const UP = V(0, 1, 0), FWD = V(0, 0, 1);

/** Centre line of the torso in z, from the hips to the neck. */
const zc = (y: number): number => (y < 1.1 ? lerp(-0.05, -0.012, (y - 0.9) / 0.2) : lerp(-0.012, -0.008, Math.min(1, (y - 1.1) / 0.4)));
const mix = (a: Weights, b: Weights, k: number): Weights => {
  const out: [string, number][] = [];
  for (const [n, w] of a) out.push([n, w * (1 - k)]);
  for (const [n, w] of b) out.push([n, w * k]);
  return out;
};

/** Weights of a torso-like vertex: pelvis, spine and neck by height, with the hem following the legs on each side. */
function torsoWeights(p: Vector3, hem = true): Weights {
  const base = blendAlong(p.y, ['pelvis', 'spine_01', 'spine_02', 'spine_03'], [1.0, 1.13, 1.26], [0.07, 0.06, 0.07]);
  let w: Weights = base;
  if (p.y > 1.44) w = mix(w, [['neck_01', 1]], smooth((p.y - 1.44) / 0.05) * 0.6);
  if (hem && p.y < 0.97) {
    const side = p.x >= 0 ? 'thigh_l' : 'thigh_r';
    const k = smooth((0.97 - p.y) / 0.25) * 0.3 * smooth(Math.abs(p.x) / 0.14);
    w = mix(w, [[side, 1]], k);
  }
  return w;
}

function armWeights(p: Vector3, side: Side): Weights {
  const s = Math.abs(p.x);
  const base = blendAlong(s, [`clavicle_${side}`, `upperarm_${side}`, `lowerarm_${side}`, `hand_${side}`], [0.15, 0.466, 0.72], [0.06, 0.075, 0.03]);
  const sp = 0.55 * (1 - smooth((s - 0.02) / 0.15));
  return mix(base, [['spine_03', 1]], sp);
}

function legWeights(p: Vector3, side: Side, pelvisMix = 0.65): Weights {
  const base = blendAlong(-p.y, [`thigh_${side}`, `calf_${side}`, `foot_${side}`], [-0.532, -0.17], [0.075, 0.05]);
  return mix(base, [['pelvis', 1]], smooth((p.y - 0.9) / 0.14) * pelvisMix);
}

export interface BodyParts { skin: PartBuilder; tunic: PartBuilder; trousers: PartBuilder; boots: PartBuilder; belt: PartBuilder; trim: PartBuilder }

/** Pose-independent tints (multiplied with the wardrobe colour): darker where cloth folds or meets the body. */
const T = { hem: 0xc9c9c9, dark: 0xa8a8a8, mid: 0xe0e0e0, white: 0xffffff, light: 0xf4f4f4 };

export function buildBody(parts: BodyParts): void {
  // ---------------- tunic ----------------
  const tunicRows: [number, number, number, number, number][] = [
    [0.735, 0.232, 0.172, T.dark, 0], [0.775, 0.22, 0.162, T.hem, 0], [0.86, 0.196, 0.146, T.mid, 0], [0.95, 0.168, 0.127, T.white, 0], [1.05, 0.142, 0.108, T.white, 0],
    [1.17, 0.148, 0.111, T.white, 0], [1.29, 0.166, 0.116, T.light, 0], [1.38, 0.175, 0.11, T.white, 0], [1.435, 0.131, 0.093, T.white, 0], [1.462, 0.074, 0.067, T.mid, 0], [1.478, 0.06, 0.059, T.dark, 0],
  ];
  const tunicRings: Ring[] = ringsFromTable(tunicRows, 'y', 0, 0).map(r => { r.p.z = zc(r.p.y); return r; });
  sweep(parts.tunic, tunicRings, 0xffffff, { radial: 22, ref: FWD, weights: p => torsoWeights(p), capStart: 'none' });
  // gold hem and collar trim
  const hem: Ring[] = [{ p: V(0, 0.735, zc(0.735)), rA: 0.176, rB: 0.236, tint: 0xffffff }, { p: V(0, 0.775, zc(0.775)), rA: 0.167, rB: 0.224, tint: 0xffffff }];
  sweep(parts.trim, hem, 0xffffff, { radial: 22, ref: FWD, weights: p => torsoWeights(p) });
  const collar: Ring[] = [{ p: V(0, 1.466, zc(1.466)), rA: 0.072, rB: 0.078, tint: 0xffffff }, { p: V(0, 1.484, zc(1.484)), rA: 0.064, rB: 0.07, tint: 0xffffff }];
  sweep(parts.trim, collar, 0xffffff, { radial: 14, ref: FWD, weights: () => [['spine_03', 0.6], ['neck_01', 0.4]] });

  for (const side of ['l', 'r'] as const) {
    const sx = side === 'l' ? 1 : -1;
    const xs = (x: number) => sx * x;
    // sleeve: shoulder to three-quarters down the forearm
    const sleeve: Ring[] = [
      { p: V(xs(0.075), 1.44, -0.062), rA: 0.066, rB: 0.07, tint: T.white }, { p: V(xs(0.13), 1.442, -0.064), rA: 0.067, rB: 0.07, tint: T.white },
      { p: V(xs(0.192), 1.441, -0.065), rA: 0.066, rB: 0.066, tint: T.white }, { p: V(xs(0.27), 1.441, -0.067), rA: 0.057, rB: 0.059, tint: T.light },
      { p: V(xs(0.37), 1.441, -0.069), rA: 0.052, rB: 0.054, tint: T.white }, { p: V(xs(0.466), 1.441, -0.07), rA: 0.05, rB: 0.052, tint: T.mid },
      { p: V(xs(0.52), 1.441, -0.07), rA: 0.052, rB: 0.054, tint: T.white }, { p: V(xs(0.585), 1.441, -0.07), rA: 0.058, rB: 0.06, tint: T.hem },
    ];
    sweep(parts.tunic, sleeve, 0xffffff, { radial: 12, ref: UP, weights: p => armWeights(p, side) });
    // shoulder ball so the shoulder stays round when the arm lowers
    const cap: Ring[] = [{ p: V(xs(0.145), 1.442, -0.064), rA: 0.07, rB: 0.07, tint: T.white }, { p: V(xs(0.205), 1.442, -0.065), rA: 0.07, rB: 0.07, tint: T.white }];
    sweep(parts.tunic, cap, 0xffffff, { radial: 12, ref: UP, capStart: 'round', capEnd: 'round', weights: p => armWeights(p, side) });
    // cuff band
    const cuff: Ring[] = [{ p: V(xs(0.575), 1.441, -0.07), rA: 0.0595, rB: 0.0615, tint: T.white }, { p: V(xs(0.608), 1.441, -0.07), rA: 0.0615, rB: 0.0635, tint: T.white }];
    sweep(parts.trim, cuff, 0xffffff, { radial: 12, ref: UP, weights: p => armWeights(p, side) });
    // leather bracer on the lower arm
    const bracer: Ring[] = [
      { p: V(xs(0.622), 1.441, -0.069), rA: 0.0455, rB: 0.047, tint: T.mid }, { p: V(xs(0.632), 1.441, -0.069), rA: 0.0495, rB: 0.051, tint: T.white },
      { p: V(xs(0.665), 1.441, -0.068), rA: 0.049, rB: 0.05, tint: T.light }, { p: V(xs(0.69), 1.441, -0.067), rA: 0.0445, rB: 0.046, tint: T.mid },
    ];
    sweep(parts.belt, bracer, 0xffffff, { radial: 12, ref: UP, weights: p => armWeights(p, side) });
    // bare forearm and wrist
    const arm: Ring[] = [
      { p: V(xs(0.5), 1.441, -0.07), rA: 0.044, rB: 0.046, tint: T.white }, { p: V(xs(0.62), 1.441, -0.069), rA: 0.039, rB: 0.04, tint: T.white },
      { p: V(xs(0.7), 1.441, -0.067), rA: 0.034, rB: 0.036, tint: T.dark }, { p: V(xs(0.77), 1.436, -0.066), rA: 0.034, rB: 0.036, tint: T.dark },
    ];
    sweep(parts.skin, arm, 0xffffff, { radial: 10, ref: UP, weights: p => armWeights(p, side) });

    // ---------------- trousers ----------------
    const lx = 0.089 * sx;
    const legRows: [number, number, number][] = [
      [0.97, 0.1, 0.097], [0.9, 0.1, 0.098], [0.78, 0.09, 0.088], [0.66, 0.08, 0.078], [0.55, 0.073, 0.072], [0.46, 0.071, 0.07], [0.37, 0.074, 0.073],
    ];
    const legRings: Ring[] = legRows.map(([y, rz, rx], i) => ({ p: V(lx, y, lerp(0, -0.012, y < 0.5 ? 1 : 0)), rA: rz, rB: rx, tint: i === legRows.length - 1 ? T.mid : T.white }));
    sweep(parts.trousers, legRings, 0xffffff, { radial: 14, ref: FWD, weights: p => legWeights(p, side) });

    // ---------------- boots ----------------
    const shaft: Ring[] = [
      { p: V(lx, 0.405, -0.004), rA: 0.087, rB: 0.086, tint: T.light }, { p: V(lx, 0.375, -0.005), rA: 0.083, rB: 0.082, tint: T.white },
      { p: V(lx, 0.3, -0.008), rA: 0.077, rB: 0.075, tint: T.white }, { p: V(lx, 0.2, -0.02), rA: 0.07, rB: 0.068, tint: T.mid }, { p: V(lx, 0.12, -0.034), rA: 0.067, rB: 0.065, tint: T.mid },
    ];
    sweep(parts.boots, shaft, 0xffffff, { radial: 14, ref: FWD, weights: p => blendAlong(-p.y, [`calf_${side}`, `foot_${side}`], [-0.17], [0.05]) });
    const foot: Ring[] = [
      { p: V(lx, 0.062, -0.07), rA: 0.058, rB: 0.056, tint: T.white }, { p: V(lx, 0.058, -0.03), rA: 0.064, rB: 0.06, tint: T.white },
      { p: V(lx, 0.048, 0.04), rA: 0.052, rB: 0.062, tint: T.white }, { p: V(lx, 0.038, 0.112), rA: 0.042, rB: 0.065, tint: T.light }, { p: V(lx, 0.032, 0.178), rA: 0.03, rB: 0.052, tint: T.light },
    ];
    const footW = (p: Vector3): Weights => blendAlong(p.z, [`foot_${side}`, `ball_${side}`], [0.095], [0.04]);
    sweep(parts.boots, foot, 0xffffff, { radial: 14, ref: UP, capStart: 'round', capEnd: 'round', weights: footW });
  }

  // trousers: hips, so the two legs join under the tunic
  const hipRows: [number, number, number, number, number][] = [[0.86, 0.095, 0.105, T.white, 0], [0.92, 0.102, 0.135, T.white, 0], [1.0, 0.1, 0.132, T.white, 0], [1.08, 0.098, 0.128, T.white, 0]];
  const hips = ringsFromTable(hipRows, 'y', 0, 0).map(r => { r.p.z = zc(r.p.y) + 0.01; return r; });
  sweep(parts.trousers, hips, 0xffffff, { radial: 20, ref: FWD, capStart: 'round', weights: p => torsoWeights(p) });

  // neck
  const neck: Ring[] = [
    { p: V(0, 1.4, zc(1.4)), rA: 0.052, rB: 0.054, tint: T.white }, { p: V(0, 1.47, -0.01), rA: 0.047, rB: 0.047, tint: T.white },
    { p: V(0, 1.53, -0.002), rA: 0.044, rB: 0.044, tint: T.white }, { p: V(0, 1.58, 0.004), rA: 0.045, rB: 0.045, tint: T.white },
  ];
  sweep(parts.skin, neck, 0xffffff, { radial: 12, ref: FWD, weights: p => blendAlong(p.y, ['spine_03', 'neck_01', 'Head'], [1.44, 1.54], [0.05, 0.04]) });

  // belt: a rolled leather band at the waist
  const beltRows: [number, number, number, number, number][] = [
    [1.03, 0.104, 0.136, T.mid, 0], [1.036, 0.11, 0.142, T.white, 0], [1.06, 0.111, 0.143, T.light, 0], [1.084, 0.11, 0.142, T.white, 0], [1.09, 0.104, 0.136, T.mid, 0],
  ];
  const beltRings = ringsFromTable(beltRows, 'y', 0, 0).map(r => { r.p.z = zc(r.p.y); return r; });
  sweep(parts.belt, beltRings, 0xffffff, { radial: 22, ref: FWD, weights: () => [['pelvis', 0.5], ['spine_01', 0.5]] });

  // crossed leather straps for the pack: over the shoulder, down the chest to the belt
  for (const sx of [1, -1]) {
    const mk = (x: number, y: number, z: number, ref: Vector3): Ring => ({ p: V(sx * x, y, z), rA: 0.011, rB: 0.03, tint: T.white, ref });
    const strap: Ring[] = [
      mk(0.1, 1.462, -0.075, UP), mk(0.108, 1.467, 0.0, UP), mk(0.1, 1.405, 0.098, FWD), mk(0.094, 1.3, 0.112, FWD), mk(0.086, 1.18, 0.108, FWD), mk(0.082, 1.092, 0.108, FWD),
    ];
    sweep(parts.belt, strap, 0xffffff, { radial: 6, ref: FWD, weights: p => torsoWeights(p, false) });
  }
}
