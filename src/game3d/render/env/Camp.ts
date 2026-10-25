/**
 * The trail-keeper's camp (v2.4 style pass): a red canvas tent, a campfire with a log seat, a short wooden fence and a lantern.
 * Original low-poly models, merged into one vertex-coloured mesh (one draw call), with a flickering fire glow at dusk.
 */
import { Group, type Mesh, type Sprite } from 'three';
import { CAMP_FIRE, CAMP_POS, CAMP_TENT } from '../../systems/layout3d';
import { heightAt } from '../../systems/worldShape';
import { glowSprite } from '../common';
import { addWorldOutline } from './worldOutline';
import { Kit, M, mat, type NightGlow } from './Structures';
import { ConeGeometry, CylinderGeometry, Mesh as ThreeMesh, BufferGeometry } from 'three';

const CANVAS = 0xd8503c, CANVAS_DARK = 0xa83a2c, WOOD = 0x7a5233, WOOD_LIGHT = 0xa8794a, STONE = 0x9a9a90, EMBER = 0xff9a2a;

function tentGeometry(): BufferGeometry {
  const k = new Kit();
  // an A-frame tent: two sloped canvas panels, a dark open doorway, ridge pole and pegs
  const w = 2.6, h = 1.7, d = 2.2, slope = Math.atan2(h, d / 2), len = Math.hypot(h, d / 2);
  for (const s of [-1, 1]) k.box(w, 0.07, len, 0, h / 2, s * d / 4, s > 0 ? CANVAS : CANVAS_DARK, 0, 0, s * slope);
  k.box(w + 0.1, 0.12, 0.12, 0, h, 0, WOOD);                                  // ridge pole
  k.box(0.08, 1.1, 0.5, w / 2, 0.5, 0, CANVAS_DARK); k.box(0.08, 1.1, 0.5, -w / 2, 0.5, 0, CANVAS_DARK);
  k.box(0.9, 1.25, 0.06, 0, 0.62, d / 2 - 0.12, 0x2a1a14);                   // doorway
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.04, 0.04, 0.35, 5, sx * (w / 2 + 0.15), 0.12, sz * (d / 2 + 0.25), WOOD_LIGHT);
  return k.build(0.3, 1.0);
}
function fireGeometry(): BufferGeometry {
  const k = new Kit();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.ball(0.13, Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5, STONE, 1, 0.8, 1, 0); }   // stone ring
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; k.box(0.07, 0.07, 0.55, Math.cos(a) * 0.12, 0.14, Math.sin(a) * 0.12, WOOD, a, 0, 0.5); } // crossed sticks
  k.add(new ConeGeometry(0.18, 0.5, 6), EMBER, M(0, 0.4, 0));                  // stylised flame
  k.add(new ConeGeometry(0.1, 0.34, 6), 0xffe27a, M(0, 0.38, 0));
  // log seat
  k.add(new CylinderGeometry(0.2, 0.2, 1.3, 10), WOOD_LIGHT, M(1.1, 0.2, 0.2, Math.PI / 2, 0.3, 0));
  k.add(new CylinderGeometry(0.17, 0.17, 1.0, 10), WOOD, M(-0.9, 0.17, 0.9, Math.PI / 2, -0.5, 0));
  return k.build(0.3, 0.6);
}
function fenceRun(): BufferGeometry {
  const k = new Kit(); const n = 6;
  for (let i = 0; i <= n; i++) k.cyl(0.07, 0.08, 0.95, 6, i * 0.8, 0.47, 0, WOOD);
  k.box(n * 0.8, 0.09, 0.07, n * 0.4, 0.78, 0, WOOD_LIGHT); k.box(n * 0.8, 0.09, 0.07, n * 0.4, 0.45, 0, WOOD_LIGHT);
  return k.build(0.25, 0.5);
}

export function buildCamp(root: Group, glows: NightGlow[]): { update(t: number): void } {
  const material = mat();
  const put = (g: BufferGeometry, x: number, z: number, ry: number): Mesh => {
    const m = new ThreeMesh(g, material); m.position.set(x, heightAt(x, z), z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  };
  addWorldOutline(put(tentGeometry(), CAMP_TENT.x, CAMP_TENT.z, 0.5));
  put(fireGeometry(), CAMP_FIRE.x, CAMP_FIRE.z, 0);
  put(fenceRun(), CAMP_POS.x - 3.6, CAMP_POS.z + 2.4, -0.35);
  const fy = heightAt(CAMP_FIRE.x, CAMP_FIRE.z);
  const glow: Sprite = glowSprite(0xff9a3a, 2.4, 0.5); glow.position.set(CAMP_FIRE.x, fy + 0.6, CAMP_FIRE.z); root.add(glow);
  glows.push({ sprite: glow, size: 2.4, day: 0.35, night: 1 });
  return { update(t) { glow.position.y = fy + 0.6 + Math.sin(t * 9) * 0.03; } };
}
