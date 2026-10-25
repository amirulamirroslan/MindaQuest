import { CanvasTexture, DirectionalLight, Fog, Group, HemisphereLight, Scene, SRGBColorSpace, Vector3 } from 'three';
import { ColliderGrid, buildWorldLayout, type WorldLayout } from '../systems/layout3d';
import { lookForPhase, type SkyLook } from '../systems/lighting3d';
import { heightAt } from '../systems/worldShape';
import { Scenery } from './env/Scenery';
import { paintLook, rimLight } from './stylize';
import { buildMoonGate, buildRuins, buildVillage, type NightGlow } from './env/Structures';
import { buildCamp } from './env/Camp';
import { buildTerrain } from './env/terrain';
import { SETTINGS, type Quality, type QualitySettings } from '../systems/quality';

export interface BuiltWorld {
  group: Group;
  layout: WorldLayout;
  grid: ColliderGrid;
  setGateOpen(open: boolean): void;
  /** 0 = quiet runes, 1 = fully lit (boss awake). */
  setArenaGlow(k: number): void;
  /** Applies a time-of-day look: sky colours, fog, lights, exposure (see systems/lighting3d.ts). Cheap enough to call every frame. */
  applyLook(look: SkyLook): void;
  /** 0 = lamps and windows as by day, 1 = fully glowing (night). */
  setLampGlow(k: number): void;
  update(t: number): void;
  /** Moves the shadow window, wind and detail rings with the hero. Call every frame. */
  /** `y` is the ground height under the hero (the woods work it out themselves); `scenery: false` skips the woods' wind and detail rings (used inside the Crystal Hollow, where the woods are hidden). */
  follow(t: number, x: number, z: number, opts?: { y?: number; scenery?: boolean }): void;
  setQuality(q: Quality): void;
  readonly sun: DirectionalLight;
}

const hexCss = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
function paintSky(c: HTMLCanvasElement, stops: SkyLook['sky']): void {
  const g = c.getContext('2d')!; const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hexCss(stops[0])); grad.addColorStop(0.55, hexCss(stops[1])); grad.addColorStop(0.85, hexCss(stops[2])); grad.addColorStop(1, hexCss(stops[3]));
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
}
function skyTexture(): { texture: CanvasTexture; paint(stops: SkyLook['sky']): void } {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return { texture: t, paint: stops => { paintSky(c, stops); t.needsUpdate = true; } };
}

export function buildWorld(scene: Scene, quality: Quality = 'high'): BuiltWorld {
  const group = new Group(); scene.add(group);
  const layout = buildWorldLayout();
  const grid = new ColliderGrid(layout.colliders);
  const sky = skyTexture(); scene.background = sky.texture;
  const fog = new Fog(0xe3ebc6, 32, 92); scene.fog = fog;
  const hemi = new HemisphereLight(0xfff0d4, 0x5a7a38, 1.2); scene.add(hemi);
  const sun = new DirectionalLight(0xffe2a4, 2.05); sun.position.set(-42, 38, 24); scene.add(sun);

  let q: QualitySettings = SETTINGS[quality];
  const terrain = buildTerrain(layout, quality === 'low' ? 110 : quality === 'medium' ? 130 : 190); group.add(terrain);
  const scenery = new Scenery(layout, q); group.add(scenery.group);
  sun.castShadow = q.shadowMap > 0;
  const configureShadow = () => {
    sun.shadow.mapSize.set(q.shadowMap || 16, q.shadowMap || 16); sun.shadow.map?.dispose(); sun.shadow.map = null;
    const c = sun.shadow.camera; c.left = -q.shadowRange; c.right = q.shadowRange; c.top = q.shadowRange; c.bottom = -q.shadowRange; c.near = 1; c.far = 160; c.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2.5;
  };
  configureShadow(); scene.add(sun.target);
  const sunVec = new Vector3(-0.45, 0.82, 0.3).normalize(); const texel = (2 * q.shadowRange) / Math.max(16, q.shadowMap || 16);
  const nightGlows: NightGlow[] = [];
  buildVillage(group, nightGlows);
  buildCamp(group, nightGlows);
  const ruins = buildRuins(layout, group);
  const gate = buildMoonGate(group);
  gate.open(false);
  let glowK = 0;
  let nightK = 0;
  let lampK = -1;
  let lastSkyKey = '';
  const world: BuiltWorld = {
    group, layout, grid,
    setGateOpen: o => gate.open(o),
    setArenaGlow(k) { glowK = k; },
    applyLook(look) {
      hemi.color.setHex(look.hemiSky); hemi.groundColor.setHex(look.hemiGround); hemi.intensity = look.hemiIntensity;
      sun.color.setHex(look.sun); sun.intensity = look.sunIntensity; sunVec.set(look.sunPos[0], look.sunPos[1], look.sunPos[2]).normalize(); sun.position.copy(sun.target.position).addScaledVector(sunVec, 70);
      fog.color.setHex(look.fog); fog.near = look.fogNear; fog.far = look.fogFar;
      // the sky texture is only repainted when its colours really changed (a 8x256 canvas: cheap, but no need every frame)
      nightK = Math.min(1, Math.max(0, (1.25 - look.hemiIntensity) * 1.6 + (look.sunIntensity < 1 ? 0.25 : 0)));
      scenery.applyLook(look, nightK);
      paintLook.shadowTint.value.setRGB(0.86 + 0.06 * nightK, 0.93 + 0.04 * nightK, 1.1 - 0.02 * nightK); paintLook.bandMix.value = 0.42 - 0.12 * nightK;
      rimLight.rimColor.value.setHex(look.hemiSky); rimLight.rimStrength.value = 0.3 + 0.25 * nightK;
      const key = look.sky.join(',');
      if (key !== lastSkyKey) { lastSkyKey = key; sky.paint(look.sky); }
    },
    setLampGlow(k) {
      if (Math.abs(k - lampK) < 0.004) return;
      lampK = k;
      for (const g of nightGlows) { g.sprite.material.opacity = g.day + (g.night - g.day) * k; const sz = g.size * (1 + 0.5 * k); g.sprite.scale.set(sz, sz, 1); }
    },
    sun,
    follow(t, x, z, opts) {
      if (opts?.scenery !== false) scenery.update(t, x, z);
      if (!sun.castShadow) return;
      // keep the shadow window centred on the hero, snapped to whole shadow texels so shadows do not shimmer while walking
      const tx = Math.round(x / texel) * texel, tz = Math.round(z / texel) * texel;
      const ty = opts?.y ?? heightAt(x, z);
      sun.target.position.set(tx, ty, tz); sun.position.set(tx + sunVec.x * 70, ty + sunVec.y * 70, tz + sunVec.z * 70);
      sun.target.updateMatrixWorld();
    },
    setQuality(next) {
      q = SETTINGS[next]; scenery.applyQuality(q); sun.castShadow = q.shadowMap > 0; configureShadow();
    },
    update(t) {
      gate.update(t);
      ruins.runes.opacity = 0.2 + glowK * 0.5 + Math.sin(t * 2) * 0.05;
      ruins.coreMat.emissiveIntensity = 0.3 + glowK * 0.9;
      ruins.glows.forEach((s, i) => { s.material.opacity = 0.2 + glowK * 0.45 + Math.sin(t * 2 + i) * 0.06; });
    },
  };
  world.applyLook(lookForPhase(0)); world.setLampGlow(0);
  return world;
}
