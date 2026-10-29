/**
 * v2.20: pictures of the REAL hero, taken with the game's own renderer, rig and materials: the round HUD portrait (the head, with the
 * hair, hat and colours the player picked) and the item thumbnails in the wardrobe (each item worn on the hero, framed on the part
 * of the body it belongs to). Nothing is drawn by hand, so a new item gets a picture for free and the pictures can never disagree
 * with the character on screen.
 *
 * How: for one synchronous call the hero is lifted into a tiny private scene (own lights, own backdrop), drawn into a small corner
 * of the game canvas, copied into a 2D canvas, and put back. The browser only shows the canvas after the whole frame task, so the
 * player never sees the corner, and the world is drawn again from scratch on the next frame.
 */
import { CanvasTexture, Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, Vector4, type Object3D, type SkinnedMesh, type WebGLRenderer } from 'three';
import type { Loadout } from '../cosmetics/loadout';
import type { HeroModel } from './HeroModel';

export type SnapFrame = 'head' | 'hat' | 'portrait' | 'torso' | 'legs' | 'feet' | 'handR' | 'handL' | 'body' | 'back';
export interface SnapSpec {
  frame: SnapFrame;
  /** Output width and height in device pixels. */
  size: number;
  /** Backdrop gradient, top and bottom colours. */
  bg: readonly [string, string];
  /** Another loadout to show for this picture (the live hero is put back afterwards). */
  loadout?: Loadout | null;
  /** Hero turn in radians (0 = facing the camera); a little turn reads as 3/4 view. */
  yaw?: number;
}

/** Where the camera looks and how much height it must fit, as fractions of the head bone's height above the ground. */
export const FRAMES: Readonly<Record<SnapFrame, { cy: number; fit: number; cx?: number; bone?: string; fwd?: number }>> = {
  head: { cy: 1.17, fit: 0.98 },
  hat: { cy: 1.3, fit: 1.2 },
  portrait: { cy: 1.2, fit: 1.04 },
  torso: { cy: 0.66, fit: 1.0 },
  legs: { cy: 0.3, fit: 0.78 },
  feet: { cy: 0.1, fit: 0.7 },
  // weapons and shields: centred on the hand that holds them (cy is an offset from the hand, in head-heights)
  handR: { cy: -0.1, fit: 1.4, bone: 'handslot.r', fwd: 0.34 },
  handL: { cy: -0.05, fit: 1.15, bone: 'handslot.l', fwd: 0.1 },
  body: { cy: 0.66, fit: 1.58 },
  back: { cy: 0.66, fit: 1.58 },
};

/** Which part of the body each wardrobe slot is shown on. */
export const SLOT_FRAME: Readonly<Record<string, SnapFrame>> = { hair: 'head', headgear: 'hat', outfit: 'torso', legs: 'legs', shoes: 'feet', cape: 'back', weapon: 'handR', offhand: 'handL' };

/** Pure: camera distance so `fit` metres of height fill the picture for a vertical field of view (degrees). */
export const distanceFor = (fit: number, fovDeg: number): number => fit / (2 * Math.tan((fovDeg * Math.PI) / 360));

function backdrop(top: string, bottom: string): CanvasTexture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/**
 * Re-poses every skinned mesh under `root` from the bones' CURRENT world matrices. three.js refreshes a skeleton at most once per frame it
 * counts, and moving the hero between scenes inside one frame would otherwise leave the body drawn where the hero stood in the world
 * (out of shot), or leave the world frame drawn at the snapshot spot. Done on the way in and again on the way out.
 */
export function repose(root: Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse(o => { const m = o as SkinnedMesh; if (m.isSkinnedMesh && m.skeleton) { m.bindMatrixInverse.copy(m.matrixWorld).invert(); m.skeleton.update(); } });
}

export class HeroSnapshot {
  private readonly scene = new Scene();
  private readonly cam = new PerspectiveCamera(24, 1, 0.05, 40);
  private readonly bgs = new Map<string, CanvasTexture>();
  private readonly head = new Vector3(); private readonly look = new Vector3();

  constructor(private readonly renderer: WebGLRenderer, private readonly hero: HeroModel, environment: () => Scene['environment']) {
    const sun = new DirectionalLight(0xfff1d6, 2.6); sun.position.set(-1.6, 2.4, 3.2);
    const rim = new DirectionalLight(0xbfe3ff, 0.9); rim.position.set(2.4, 1.2, -2.2);
    this.scene.add(new HemisphereLight(0xfff6e4, 0x6f8a5a, 1.5), sun, rim);
    this.envOf = environment;
  }
  private readonly envOf: () => Scene['environment'];

  private bg(spec: SnapSpec): CanvasTexture { const k = spec.bg.join('|'); let t = this.bgs.get(k); if (!t) { t = backdrop(spec.bg[0], spec.bg[1]); this.bgs.set(k, t); } return t; }

  /** Draws one picture, or returns null when the chibi hero is not showing yet. */
  render(spec: SnapSpec): HTMLCanvasElement | null {
    const hero = this.hero, r = this.renderer, root: Object3D = hero.root;
    const parent = root.parent, px = root.position.clone(), ry = root.rotation.y;
    root.position.set(0, 0, 0); root.rotation.y = 0; root.updateMatrixWorld(true);
    if (!hero.boneWorld('head', this.head)) { root.position.copy(px); root.rotation.y = ry; return null; }
    const H = Math.max(0.3, this.head.y);
    const f = FRAMES[spec.frame]; const back = spec.frame === 'back';
    const turn = (back ? Math.PI : 0) + (spec.yaw ?? 0.42);
    root.rotation.y = turn; repose(root);
    // aim at the middle of the part, straight on from the front (or back) of the hero
    if (f.bone && hero.boneWorld(f.bone, this.look)) { this.look.y += f.cy * H; this.look.x += Math.sin(turn) * (f.fwd ?? 0) * H; this.look.z += Math.cos(turn) * (f.fwd ?? 0) * H; } else this.look.set((f.cx ?? 0) * H, f.cy * H, 0);
    const d = distanceFor(f.fit * H, this.cam.fov);
    this.cam.position.set(this.look.x, this.look.y + 0.05 * H, this.look.z + d); this.cam.lookAt(this.look); this.cam.aspect = 1; this.cam.updateProjectionMatrix();
    this.scene.background = this.bg(spec); this.scene.environment = this.envOf();
    this.scene.add(root);

    const out = document.createElement('canvas'); out.width = out.height = spec.size; const ctx = out.getContext('2d')!;
    const vp = r.getViewport(new Vector4()), sc = r.getScissor(new Vector4()), st = r.getScissorTest(), clear = r.getClearColor(new Color()), ca = r.getClearAlpha();
    const pr = r.getPixelRatio(), logical = spec.size / pr, canvasH = r.domElement.height;
    let ok = true;
    try {
      hero.snapshotScope(spec.loadout ?? null, () => {
        r.setScissorTest(true); r.setViewport(0, 0, logical, logical); r.setScissor(0, 0, logical, logical);
        r.render(this.scene, this.cam);
        ctx.drawImage(r.domElement, 0, canvasH - spec.size, spec.size, spec.size, 0, 0, spec.size, spec.size);
      });
    } catch (e) { ok = false; console.warn('MindQuest: snapshot skipped', e); }
    finally {
      r.setViewport(vp); r.setScissor(sc); r.setScissorTest(st); r.setClearColor(clear, ca);
      this.scene.remove(root); this.scene.background = null; this.scene.environment = null;
      root.position.copy(px); root.rotation.y = ry; parent?.add(root); repose(root);
    }
    return ok ? out : null;
  }
}
