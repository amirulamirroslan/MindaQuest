/**
 * The living scenery of the Whispering Woods: trees (detailed model near the hero, light model far away, both instanced), rocks,
 * bushes, ferns, flowers, mushrooms, stumps, logs and a meadow of wind-blown grass; plus the points of interest (the Ancient Tree,
 * the pond with lily pads, the glowing mushroom fairy ring) and the far backdrop (mountain layers and drifting clouds).
 * Everything is merged, vertex-coloured geometry; one shared wind shader moves it. Pure drawing code: layout comes from systems/layout3d.
 */
import {
  BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, RingGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, Object3D, Quaternion, RepeatWrapping, ShaderChunk, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { ANCIENT_TREE_POS, FAIRY_RING_POS, mulberry32, type PlantSpec, type WorldLayout } from '../../systems/layout3d';
import type { SkyLook } from '../../systems/lighting3d';
import type { QualitySettings } from '../../systems/quality';
import { LEGACY_PLAY_RADIUS as PLAY_RADIUS, PLAY_RADIUS as NEW_PLAY_RADIUS, POND, RUINS, TRAIL, VILLAGE, distToTrail, heightAt } from '../../systems/worldShape';
import { CLEARINGS, FIELDS, MIRROR, distToPaths } from '../../systems/expansionShape';
import { glowSprite } from '../common';
import { noise3 } from './noise';
import {
  blossomGeometry, fallenLeafGeometry, fernGeometry, grassCellGeometry, logGeometry, mushroomGeometry, reedGeometry, rockGeometry, spikeBudsGeometry, spikeStemGeometry, stemGeometry, stumpGeometry,
} from './plants';
import { withPaint } from '../stylize';
import { ancientTree, bushModel, treeModel, TREE_VARIANTS, type TreeKind } from './treeGen';

const wind = { uTime: { value: 0 }, uHero: { value: new Vector3(0, -99, 0) } };

type Sway = 'tree' | 'plant' | 'none';
/** Lambert, vertex-coloured; the vertex shader sways instances (trees a little at the top, plants all over). */
function envMaterial(sway: Sway, opts: { grass?: boolean; double?: boolean; unlit?: boolean; fade?: boolean; glow?: number } = {}): MeshLambertMaterial | MeshBasicMaterial {
  const m = envMaterialBase(sway, opts);
  if (!opts.unlit) withPaint(m as MeshLambertMaterial); // v2.13: hand-painted lighting shared with the terrain, buildings and hero
  return m;
}
function envMaterialBase(sway: Sway, opts: { grass?: boolean; double?: boolean; unlit?: boolean; fade?: boolean; glow?: number }): MeshLambertMaterial | MeshBasicMaterial {
  const m = opts.unlit ? new MeshBasicMaterial({ vertexColors: true }) : new MeshLambertMaterial({ vertexColors: true });
  if (opts.double || opts.grass) m.side = DoubleSide;
  if (sway === 'none' && !opts.grass) return m;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = wind.uTime; sh.uniforms.uHero = wind.uHero;
    let body: string;
    if (opts.grass) {
      body = `
        float b = aBend; vec2 wp = position.xz;
        float g1 = sin(uTime*1.6 + wp.x*0.55 + wp.y*0.35) * 0.5 + sin(uTime*3.1 + wp.x*1.7) * 0.18;
        transformed.x += g1 * 0.11 * b; transformed.z += cos(uTime*1.3 + wp.y*0.6) * 0.06 * b;
        vec2 dh = wp - uHero.xz; float dl = length(dh); float push = (1.0 - smoothstep(0.0, 1.15, dl)) * b;
        transformed.xz += dh / max(dl, 0.05) * push * 0.42; transformed.y -= push * 0.14;
        // v2.9: a calm halo. Grass within a few metres of the hero is flattened to about 40 %, growing back to full height further out,
        // so the hero's feet, sword and shadow are never buried and the busy meadow does not fight the silhouette.
        float calm = 1.0 - smoothstep(1.3, 3.6, dl); transformed.y -= aRise * 0.6 * calm;`;
    } else {
      const k = sway === 'tree' ? '0.0034 * hh * hh' : '0.07 * hh';
      body = `
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float hh = max(position.y, 0.0);
        float w1 = sin(uTime*1.25 + ip.x*0.33 + ip.z*0.27) * 0.6 + sin(uTime*2.4 + ip.x*0.9) * 0.2;
        transformed.x += w1 * ${k}; transformed.z += cos(uTime*1.05 + ip.z*0.31) * 0.6 * ${k};
        ${sway === 'plant' ? 'vec2 dh = ip.xz - uHero.xz; float dl = length(dh); transformed.xz += dh / max(dl,0.05) * (1.0 - smoothstep(0.0, 0.9, dl)) * hh * 0.5;' : ''}`;
    }
    // grass is lit as if it faced the sky from both sides (a blade seen from behind must not turn dark)
    if (sway === 'tree' || opts.fade) {
      // leaves near the camera dissolve (screen-door dither) instead of filling the screen when the camera sits among the trees
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', `void main() {
        { float camD = length(vViewPosition); float fk = smoothstep(1.6, 4.6, camD);
          if (fk < 1.0) { float th = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (th > fk) discard; } }`);
    }
    if (opts.glow) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${opts.glow.toFixed(2)};`);
    if (opts.grass) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'));
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform vec3 uHero;\n${opts.grass ? 'attribute float aBend;\nattribute float aRise;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${body}`);
  };
  m.customProgramCacheKey = () => `env_${sway}_${opts.grass ? 'g' : ''}${opts.unlit ? 'u' : ''}${opts.fade ? 'f' : ''}${opts.glow ?? ''}`;
  return m;
}

interface Item { x: number; z: number; y?: number; scale: number; rot: number; tint: Color; tilt?: number }

/**
 * A set of instances of one model. `refresh` keeps only the instances within `radius` of the hero (the rest are skipped), and
 * optionally draws the far ones with a lighter model.
 */
class InstanceSet {
  readonly hi: InstancedMesh; readonly lo: InstancedMesh | null;
  private readonly mats: Float32Array; private readonly cols: Float32Array; private readonly pos: Float32Array;
  constructor(readonly items: Item[], hiGeo: BufferGeometry, mat: MeshLambertMaterial | MeshBasicMaterial, loGeo: BufferGeometry | null = null, shadow = false, readonly receive = true) {
    const n = Math.max(1, items.length);
    this.hi = new InstancedMesh(hiGeo, mat, n); this.hi.count = 0; this.hi.castShadow = shadow; this.hi.receiveShadow = receive; this.hi.frustumCulled = false;
    this.lo = loGeo ? new InstancedMesh(loGeo, mat, n) : null;
    if (this.lo) { this.lo.count = 0; this.lo.receiveShadow = receive; this.lo.frustumCulled = false; }
    this.mats = new Float32Array(n * 16); this.cols = new Float32Array(n * 3); this.pos = new Float32Array(n * 2);
    const d = new Object3D(); const q = new Quaternion(); const e = new Vector3();
    items.forEach((t, i) => {
      d.position.set(t.x, t.y ?? heightAt(t.x, t.z), t.z);
      q.setFromAxisAngle(e.set(0, 1, 0), t.rot); d.quaternion.copy(q);
      if (t.tilt) { const tq = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), t.tilt); d.quaternion.multiply(tq); }
      d.scale.setScalar(t.scale); d.updateMatrix(); d.matrix.toArray(this.mats, i * 16);
      this.cols[i * 3] = t.tint.r; this.cols[i * 3 + 1] = t.tint.g; this.cols[i * 3 + 2] = t.tint.b; this.pos[i * 2] = t.x; this.pos[i * 2 + 1] = t.z;
    });
    for (const m of [this.hi, this.lo]) if (m) { m.instanceColor = new InstancedBufferAttribute(new Float32Array(n * 3), 3); }
  }
  get meshes(): InstancedMesh[] { return this.lo ? [this.hi, this.lo] : [this.hi]; }
  refresh(hx: number, hz: number, nearR: number, farR = Infinity): void {
    const n2 = nearR * nearR, f2 = farR * farR; let h = 0, l = 0;
    const hiM = this.hi.instanceMatrix.array as Float32Array, hiC = this.hi.instanceColor!.array as Float32Array;
    const loM = this.lo ? this.lo.instanceMatrix.array as Float32Array : null, loC = this.lo ? this.lo.instanceColor!.array as Float32Array : null;
    for (let i = 0; i < this.items.length; i++) {
      const dx = this.pos[i * 2] - hx, dz = this.pos[i * 2 + 1] - hz, d2 = dx * dx + dz * dz;
      if (d2 <= n2) { hiM.set(this.mats.subarray(i * 16, i * 16 + 16), h * 16); hiC.set(this.cols.subarray(i * 3, i * 3 + 3), h * 3); h++; }
      else if (loM && loC && d2 <= f2) { loM.set(this.mats.subarray(i * 16, i * 16 + 16), l * 16); loC.set(this.cols.subarray(i * 3, i * 3 + 3), l * 3); l++; }
    }
    this.hi.count = h; this.hi.instanceMatrix.needsUpdate = true; this.hi.instanceColor!.needsUpdate = true;
    if (this.lo && loM) { this.lo.count = l; this.lo.instanceMatrix.needsUpdate = true; this.lo.instanceColor!.needsUpdate = true; }
  }
}

const tintWarm = new Color(1.1, 1.02, 0.86), tintCool = new Color(0.88, 1.03, 1.06);
const tintGold = new Color(1.8, 1.0, 0.34);
const treeTint = (h: number): Color => new Color(1, 1, 1).lerp(h < 0.5 ? tintWarm : tintCool, Math.abs(h - 0.5) * 1.2);
/** Species for a layout tree without touching the layout: a few oaks are pink-blossom trees, a few turn autumn gold. */
const speciesOf = (t: { kind: string; hue: number }): TreeKind => (t.kind === 'oak' && t.hue > 0.9 ? 'blossom' : (t.kind as TreeKind));
const treeTintFor = (t: { kind: string; hue: number }): Color => (t.kind === 'oak' && t.hue < 0.07 ? tintGold.clone() : t.kind === 'blossom' ? new Color(1, 1, 1) : treeTint(t.hue));

const NEAR_GRASS_CELL = 6;
/** Rocks, logs, stumps and reeds are drawn within this distance of the hero (the fog hides everything further out). */
const ROCK_RADIUS = 90;
/** Trees are drawn a little smaller than the layout's footprint so the camera can sit among them. */
const TREE_SCALE = 0.74;
const FLOWER_COLOURS = [0xffd84a, 0xff8fc8, 0xffffff, 0xb79cff, 0xff9a6a];

export class Scenery {
  readonly group = new Group();
  private readonly trees: InstanceSet[] = [];
  private readonly sets: { set: InstanceSet; kind: 'tree' | 'plant' | 'rock' }[] = [];
  private readonly grass: { mesh: Mesh; x: number; z: number; count: number; ends: number[] }[] = [];
  private grassBuilt = 1;
  /** v2.31: grass cells of the expanded woods are built the first time the hero gets near them (a few per frame), not at start-up. */
  private grassLazy: { cx: number; cz: number; built: boolean }[] = [];
  private grassMat!: MeshLambertMaterial;
  private lastRefresh = new Vector3(1e9, 0, 1e9);
  private readonly mountains: { mat: MeshBasicMaterial; mix: number }[] = [];
  private readonly clouds: Sprite[] = [];
  private readonly cloudBase: { a: number; r: number; speed: number }[] = [];
  private readonly water: Mesh; private readonly waterTex: CanvasTexture;
  private foam: Mesh | null = null; private readonly pondGlints: Sprite[] = []; private nightNow = 0;
  private readonly glowMush: MeshBasicMaterial;
  private readonly ancientGlow: Sprite[] = [];
  private readonly lilyGroup = new Group();
  private q: QualitySettings;

  constructor(layout: WorldLayout, quality: QualitySettings) {
    this.q = quality;
    const rnd = mulberry32(777);
    // ---- trees: three species x three variants, each with a detailed and a light model
    const treeMat = envMaterial('tree');
    for (const kind of ['oak', 'pine', 'birch', 'blossom'] as TreeKind[]) {
      for (let v = 0; v < TREE_VARIANTS; v++) {
        const items: Item[] = layout.trees.filter(t => speciesOf(t) === kind && t.variant === v).map(t => ({ x: t.x, z: t.z, scale: t.scale * TREE_SCALE, rot: t.rot, tint: treeTintFor(t) }));
        if (!items.length) continue;
        const m = treeModel(kind, v);
        const s = new InstanceSet(items, m.hi, treeMat as MeshLambertMaterial, m.lo, true);
        this.trees.push(s); this.sets.push({ set: s, kind: 'tree' });
      }
    }
    // ---- twisted dead trees (v2.6)
    for (let v = 0; v < TREE_VARIANTS; v++) {
      const items: Item[] = layout.deadTrees.filter(t => t.variant === v).map(t => ({ x: t.x, z: t.z, scale: t.scale * TREE_SCALE * 1.15, rot: t.rot, tint: new Color(1, 1, 1) }));
      if (!items.length) continue;
      const m = treeModel('dead', v);
      const s = new InstanceSet(items, m.hi, envMaterial('none') as MeshLambertMaterial, m.lo, true);
      this.trees.push(s); this.sets.push({ set: s, kind: 'tree' });
    }
    // ---- rocks (two shapes)
    const rockMat = envMaterial('none');
    for (let v = 0; v < 2; v++) {
      const items: Item[] = layout.rocks.filter((_, i) => i % 2 === v).map(r => ({ x: r.x, z: r.z, y: heightAt(r.x, r.z) - 0.12 * r.scale, scale: r.scale * 1.15, rot: r.rot, tint: new Color(1, 1, 1) }));
      const s = new InstanceSet(items, rockGeometry(11 + v * 7), rockMat as MeshLambertMaterial, null, true);
      this.sets.push({ set: s, kind: 'rock' });
    }
    // ---- bushes, ferns, flowers, mushrooms, stumps, logs
    const plantMat = envMaterial('plant', { fade: true });
    const tintG = (h: number) => new Color(1, 1, 1).lerp(new Color(0.92, 1.08, 0.84), h);
    const mkPlant = (specs: PlantSpec[], geo: BufferGeometry, mat = plantMat, shadow = false, y0 = 0) => {
      const s = new InstanceSet(specs.map(p => ({ x: p.x, z: p.z, y: heightAt(p.x, p.z) + y0, scale: p.scale, rot: p.rot, tint: tintG(p.hue) })), geo, mat as MeshLambertMaterial, null, shadow);
      this.sets.push({ set: s, kind: 'plant' }); return s;
    };
    const bushItems = layout.bushes.map(b => ({ x: b.x, z: b.z, scale: b.scale * 1.15, rot: b.hue * 40, hue: b.hue }));
    const bushKinds = ['plain', 'berry', 'flower'] as const;
    for (let v = 0; v < 3; v++) mkPlant(bushItems.filter((_, i) => i % 3 === v), bushModel(3 + v * 5, bushKinds[v]), plantMat, v === 0);
    // life at the foot of the trees: toadstool clusters, ferns, and a scatter of fallen leaves (all deterministic, layout untouched)
    const r2 = mulberry32(2026);
    const foot: PlantSpec[] = [], footFerns: PlantSpec[] = [];
    layout.trees.forEach((t, i) => {
      const rr = t.scale * TREE_SCALE;
      if (i % 5 === 0) for (let k = 0; k < 3; k++) { const a = r2() * 6.283, d = (0.42 + r2() * 0.35) * rr + 0.2; foot.push({ x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, scale: 0.7 + r2() * 0.8, rot: r2() * 6.28, hue: r2() }); }
      if (i % 3 === 0) for (let k = 0; k < 2; k++) { const a = r2() * 6.283, d = (0.8 + r2() * 0.9) * rr + 0.2; footFerns.push({ x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, scale: 0.7 + r2() * 0.6, rot: r2() * 6.28, hue: r2() }); }
    });
    for (const t of layout.deadTrees) for (let k = 0; k < 2; k++) { const a = r2() * 6.283, d = 0.7 + r2() * 0.6; foot.push({ x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, scale: 0.9 + r2() * 0.6, rot: r2() * 6.28, hue: r2() }); }
    const allMush = layout.mushrooms.concat(foot);
    mkPlant(layout.ferns.concat(footFerns), fernGeometry(), envMaterial('plant', { double: true }));
    mkPlant(allMush.filter((_, i) => i % 2 === 0), mushroomGeometry(false, 1));
    mkPlant(allMush.filter((_, i) => i % 2 === 1), mushroomGeometry(false, 5));
    const leafCols = [0xe8c23a, 0xd98a2a, 0xb85a28, 0xcfa23a, 0xa8b43a, 0x8a5a2a];
    const leafItems: Item[] = [];
    layout.trees.forEach(t => {
      if (t.kind === 'pine') return;
      const gold = t.kind === 'oak' && t.hue < 0.07; const n = gold ? 9 : 4; const rr = t.scale * TREE_SCALE;
      for (let k = 0; k < n; k++) {
        const a = r2() * 6.283, d = (0.5 + Math.sqrt(r2()) * 2.0) * rr; const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        const c = new Color(gold ? leafCols[Math.floor(r2() * 3)] : t.kind === 'oak' && t.hue > 0.9 ? 0xf6c4d8 : leafCols[Math.floor(r2() * leafCols.length)]);
        leafItems.push({ x, z, y: heightAt(x, z) + 0.01, scale: 0.9 + r2() * 0.9, rot: r2() * 6.283, tint: c.multiplyScalar(0.85 + 0.3 * r2()) });
      }
    });
    { const s = new InstanceSet(leafItems, fallenLeafGeometry(), envMaterial('none', { double: true }) as MeshLambertMaterial, null, false); this.sets.push({ set: s, kind: 'plant' }); }
    // pebbles along the trail edges and small stones around every big rock
    const pebbleItems: Item[] = [];
    for (let i = 0; i < TRAIL.length - 1; i++) {
      const a = TRAIL[i], b = TRAIL[i + 1]; const L = Math.hypot(b.x - a.x, b.z - a.z); const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
      for (let k = 0; k < Math.round(L * 3.2); k++) {
        const u = r2(), side = r2() < 0.5 ? -1 : 1, off = side * (0.7 + r2() * 1.5); const x = a.x + (b.x - a.x) * u + nx * off, z = a.z + (b.z - a.z) * u + nz * off;
        pebbleItems.push({ x, z, y: heightAt(x, z) - 0.02, scale: 0.05 + r2() * 0.11, rot: r2() * 6.28, tint: new Color(1, 1, 1).multiplyScalar(0.85 + 0.3 * r2()) });
      }
    }
    layout.rocks.forEach((r, i) => {
      if (i % 2) return;
      for (let k = 0; k < 3; k++) { const a = r2() * 6.283, d = r.scale * (0.9 + r2() * 0.7); const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d; pebbleItems.push({ x, z, y: heightAt(x, z) - 0.03, scale: (0.08 + r2() * 0.16) * Math.min(1.6, 0.6 + r.scale * 0.5), rot: r2() * 6.28, tint: new Color(1, 1, 1) }); }
    });
    { const s = new InstanceSet(pebbleItems, rockGeometry(23, 1), envMaterial('none') as MeshLambertMaterial, null, false); this.sets.push({ set: s, kind: 'plant' }); }
    // tall flower spikes (foxglove / lavender) around trees, bushes and the open meadow
    const spikeItems: Item[] = []; const spikeCols = [0xa57cff, 0xff6fb0, 0xffffff, 0xff9a52, 0x7ab4ff];
    const addSpike = (x: number, z: number): void => {
      if (distToTrail(x, z) < 1.3 || Math.hypot(x - RUINS.x, z - RUINS.z) < 11 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 1 || Math.hypot(x, z) > PLAY_RADIUS - 1) return;
      const c = spikeCols[Math.floor(r2() * spikeCols.length)];
      for (let k = 0; k < 2 + Math.floor(r2() * 3); k++) { const xx = x + (r2() - 0.5) * 0.7, zz = z + (r2() - 0.5) * 0.7; spikeItems.push({ x: xx, z: zz, y: heightAt(xx, zz), scale: 0.8 + r2() * 0.7, rot: r2() * 6.28, tint: new Color(c).multiplyScalar(0.9 + 0.2 * r2()) }); }
    };
    layout.trees.forEach((t, i) => { if (i % 4 === 1) { const a = r2() * 6.283, d = (1.0 + r2() * 1.2) * t.scale * TREE_SCALE + 0.3; addSpike(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d); } });
    for (let i = 0; i < 90; i++) { const a = r2() * 6.283, d = Math.sqrt(r2()) * (PLAY_RADIUS - 2); addSpike(Math.sin(a) * d, Math.cos(a) * d); }
    { const stemSet = new InstanceSet(spikeItems.map(f => ({ ...f, tint: new Color(1, 1, 1) })), spikeStemGeometry(), plantMat as MeshLambertMaterial, null, false); this.sets.push({ set: stemSet, kind: 'plant' });
      const buds = new InstanceSet(spikeItems, spikeBudsGeometry(), envMaterial('plant', { double: true }) as MeshLambertMaterial, null, false); this.sets.push({ set: buds, kind: 'plant' }); }
    // cattails and reeds around the pond bank
    const reedItems: Item[] = [];
    for (let i = 0; i < 26; i++) {
      const a = r2() * 6.283; if (Math.abs(((a + 6.283) % 6.283) - 3.4) < 0.5) continue; // leave a gap on the west bank so the pond stays visible
      const d = POND.r + 0.05 + r2() * 0.8; const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
      reedItems.push({ x, z, y: heightAt(x, z) - 0.3, scale: 0.85 + r2() * 0.7, rot: r2() * 6.28, tint: new Color(1, 1, 1).multiplyScalar(0.9 + 0.2 * r2()) });
    }
    { const s = new InstanceSet(reedItems, reedGeometry(), envMaterial('plant', { double: true }) as MeshLambertMaterial, null, false); this.sets.push({ set: s, kind: 'rock' }); }
    const stumpMat = envMaterial('none');
    for (const [specs, geo] of [[layout.stumps, stumpGeometry()], [layout.logs, logGeometry()]] as const) {
      const s = new InstanceSet(specs.map(p => ({ x: p.x, z: p.z, y: heightAt(p.x, p.z) - 0.05, scale: p.scale, rot: p.rot, tint: new Color(1, 1, 1) })), geo, stumpMat as MeshLambertMaterial, null, true);
      this.sets.push({ set: s, kind: 'rock' });
    }
    // flowers: clusters of 3-4 around each layout flower, stems separate from blossoms (blossoms take a per-flower colour)
    const fItems: Item[] = [];
    layout.flowers.forEach(f => {
      const n = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const x = f.x + (rnd() - 0.5) * 1.1, z = f.z + (rnd() - 0.5) * 1.1;
        if (Math.hypot(x - RUINS.x, z - RUINS.z) < 11 || distToTrail(x, z) < 1.4 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.6) continue;
        if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 9 && rnd() < 0.5) continue;
        fItems.push({ x, z, scale: 0.8 + rnd() * 0.6, rot: rnd() * 6.28, tint: new Color(FLOWER_COLOURS[Math.floor((f.hue * 5 + (i > 1 ? 0.4 : 0)) % 5)]) });
      }
    });
    const stems = new InstanceSet(fItems.map(f => ({ ...f, tint: new Color(1, 1, 1) })), stemGeometry(), plantMat as MeshLambertMaterial, null, false);
    this.sets.push({ set: stems, kind: 'plant' });
    const blossomMat = envMaterial('plant', { double: true });
    const bl = blossomGeometry(); bl.translate(0, 0.3, 0);
    const heads = new InstanceSet(fItems, bl, blossomMat as MeshLambertMaterial, null, false);
    this.sets.push({ set: heads, kind: 'plant' });
    // fairy ring: glowing mushrooms, drawn unlit so they shine
    this.glowMush = envMaterial('plant', { unlit: true }) as MeshBasicMaterial;
    const ring = new InstanceSet(layout.fairyRing.map(p => ({ x: p.x, z: p.z, scale: p.scale * 1.3, rot: p.rot, tint: new Color(1, 1, 1) })), mushroomGeometry(true, 2), this.glowMush as unknown as MeshLambertMaterial, null, false, false);
    this.sets.push({ set: ring, kind: 'rock' });

    for (const { set } of this.sets) for (const m of set.meshes) this.group.add(m);

    this.buildGrass(rnd);
    this.buildPointsOfInterest(rnd);
    this.water = this.buildPond(); this.waterTex = (this.water.material as MeshBasicMaterial).map as CanvasTexture;
    this.buildBackdrop(rnd);
    this.applyQuality(quality);
    this.refresh(0, 27, true);
  }

  // ------------------------------------------------------------------------------------------------ grass
  private buildGrass(rnd: () => number): void {
    const density = 3.4; // tufts (4-7 blades each, or a clover patch / dandelion) per square metre at full quality; lower tiers draw a prefix of each cell's tufts
    const mat = envMaterial('none', { grass: true }) as MeshLambertMaterial; this.grassMat = mat;
    const accept = (x: number, z: number): boolean => {
      if (Math.hypot(x, z) > PLAY_RADIUS + 3) return false;
      if (distToTrail(x, z) < 1.25 + rnd() * 0.5) return false;
      if (Math.hypot(x - RUINS.x, z - RUINS.z) < 10.5) return false;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.3) return false;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r - 1 && rnd() < 0.5) return false; // a short, trampled green in the village
      return true;
    };
    for (let cx = -PLAY_RADIUS - 6; cx < PLAY_RADIUS + 6; cx += NEAR_GRASS_CELL) {
      for (let cz = -PLAY_RADIUS - 6; cz < PLAY_RADIUS + 6; cz += NEAR_GRASS_CELL) {
        if (Math.hypot(cx + 3, cz + 3) > PLAY_RADIUS + 5) continue;
        const g = grassCellGeometry(Math.round(density * NEAR_GRASS_CELL * NEAR_GRASS_CELL), { x: cx, z: cz, size: NEAR_GRASS_CELL }, heightAt, accept, rnd);
        if (!g) continue;
        const mesh = new Mesh(g, mat); mesh.receiveShadow = true; mesh.frustumCulled = true; mesh.visible = false;
        this.group.add(mesh); this.grass.push({ mesh, x: cx + NEAR_GRASS_CELL / 2, z: cz + NEAR_GRASS_CELL / 2, count: g.index!.count, ends: g.userData.ends as number[] });
      }
    }
    // v2.31: the cells outside the original glade, built on demand
    for (let cx = -NEW_PLAY_RADIUS - 6; cx < NEW_PLAY_RADIUS + 6; cx += NEAR_GRASS_CELL) for (let cz = -NEW_PLAY_RADIUS - 6; cz < NEW_PLAY_RADIUS + 6; cz += NEAR_GRASS_CELL) {
      const d = Math.hypot(cx + 3, cz + 3);
      if (d <= PLAY_RADIUS + 5 || d > NEW_PLAY_RADIUS + 5) continue;
      this.grassLazy.push({ cx, cz, built: false });
    }
  }

  /** Whether a blade of the expanded woods may grow at (x, z): not on paths, floors, fields, water or inside the cave. */
  private expandedGrassOk(x: number, z: number, rnd: () => number): boolean {
    if (Math.hypot(x, z) > NEW_PLAY_RADIUS + 3) return false;
    if (distToPaths(x, z) < 1.25 + rnd() * 0.5) return false;
    if (Math.hypot(x - MIRROR.x, z - MIRROR.z) < MIRROR.r + 0.2 && Math.hypot(x - MIRROR.x, z - MIRROR.z) > MIRROR.island) return false;
    for (const f of FIELDS) if (Math.abs(x - f.x) < f.w / 2 + 0.5 && Math.abs(z - f.z) < f.d / 2 + 0.5) return false;
    if (Math.hypot(x - 0, z + 78) < 11 || Math.hypot(x - 30, z + 54) < 4 || Math.hypot(x - 62, z + 66) < 4 || Math.hypot(x + 70, z + 48) < 4.6) return false;
    const hf = CLEARINGS[0]; if (Math.hypot(x - hf.x, z - hf.z) < 11 && rnd() < 0.5) return false;   // a short, trampled green in the lower village
    return true;
  }
  private buildLazyGrass(budget: number, hx: number, hz: number, range: number): void {
    let built = 0;
    for (const c of this.grassLazy) {
      if (c.built || built >= budget) continue;
      if (Math.hypot(c.cx + NEAR_GRASS_CELL / 2 - hx, c.cz + NEAR_GRASS_CELL / 2 - hz) > range) continue;
      c.built = true; built++;
      const rnd = mulberry32(((c.cx + 512) * 7919 + (c.cz + 512) * 104729) >>> 0);
      const g = grassCellGeometry(Math.round(3.4 * NEAR_GRASS_CELL * NEAR_GRASS_CELL), { x: c.cx, z: c.cz, size: NEAR_GRASS_CELL }, heightAt, (x, z) => this.expandedGrassOk(x, z, rnd), rnd);
      if (!g) continue;
      const mesh = new Mesh(g, this.grassMat); mesh.receiveShadow = true; mesh.frustumCulled = true; mesh.visible = false;
      this.group.add(mesh);
      const entry = { mesh, x: c.cx + NEAR_GRASS_CELL / 2, z: c.cz + NEAR_GRASS_CELL / 2, count: g.index!.count, ends: g.userData.ends as number[] };
      this.grass.push(entry); this.applyGrassQuality(entry);
    }
    if (built) this.lastRefresh.set(1e9, 0, 1e9);
  }
  private applyGrassQuality(g: { mesh: Mesh; count: number; ends: number[] }): void {
    const ratio = this.grassBuilt === 0 ? 0 : Math.min(1, this.q.grass);
    const want = g.count * ratio; let lo = 0, hi = g.ends.length; while (lo < hi) { const m = (lo + hi) >> 1; if (g.ends[m] <= want) lo = m + 1; else hi = m; }
    g.mesh.geometry.setDrawRange(0, lo > 0 ? g.ends[lo - 1] : 0);
  }

  // ------------------------------------------------------------------------------------------------ points of interest
  private buildPointsOfInterest(rnd: () => number): void {
    // the Ancient Tree
    const ay = heightAt(ANCIENT_TREE_POS.x, ANCIENT_TREE_POS.z);
    const tree = new Mesh(ancientTree(), envMaterial('tree', { glow: 0.5 })); tree.position.set(ANCIENT_TREE_POS.x, ay, ANCIENT_TREE_POS.z); tree.castShadow = true; tree.receiveShadow = true; tree.scale.setScalar(0.9);
    this.group.add(tree);
    for (const [dx, dy, dz, c, s] of [[0, 9.5, 0, 0xff9ad8, 16], [3.5, 10.5, 2, 0x7ff0d0, 12], [-3.8, 9.8, -1.5, 0xff9ad8, 12]] as const) {
      const g = glowSprite(c, s, 0.3); g.position.set(ANCIENT_TREE_POS.x + dx, ay + dy, ANCIENT_TREE_POS.z + dz); this.group.add(g); this.ancientGlow.push(g);
    }
    // a carpet of glowing blossoms under it and a few roots' mushrooms are already scattered; add petals on the ground
    const petals = new Group();
    const pm = new MeshBasicMaterial({ color: 0xffb6e0, side: DoubleSide, transparent: true, opacity: 0.85 });
    const pg = new CircleGeometry(0.09, 5); pg.rotateX(-Math.PI / 2);
    const carpet = new InstancedMesh(pg, pm, 90); const d = new Object3D();
    for (let i = 0; i < 90; i++) {
      const a = rnd() * 6.28, r = 1.6 + Math.sqrt(rnd()) * 6.5; const x = ANCIENT_TREE_POS.x + Math.cos(a) * r, z = ANCIENT_TREE_POS.z + Math.sin(a) * r;
      d.position.set(x, heightAt(x, z) + 0.05, z); d.rotation.set(rnd() * 0.4, rnd() * 6, rnd() * 0.4); d.scale.setScalar(0.8 + rnd()); d.updateMatrix(); carpet.setMatrixAt(i, d.matrix);
      carpet.setColorAt(i, new Color().setHSL(0.9 + rnd() * 0.06, 0.8, 0.8 + rnd() * 0.12));
    }
    petals.add(carpet); this.group.add(petals);
    // the fairy ring glow
    const fg = glowSprite(0x66e8f0, 4.4, 0.25); fg.position.set(FAIRY_RING_POS.x, heightAt(FAIRY_RING_POS.x, FAIRY_RING_POS.z) + 0.5, FAIRY_RING_POS.z); this.group.add(fg); this.ancientGlow.push(fg);
    this.fairyGlow = fg;
  }
  private fairyGlow: Sprite | null = null;

  private buildPond(): Mesh {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
    x.fillStyle = '#4f9fcf'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 38; i++) { const px = Math.random() * 128, py = Math.random() * 128, r = 3 + Math.random() * 11; x.strokeStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.25})`; x.lineWidth = 1 + Math.random() * 1.5; x.beginPath(); x.ellipse(px, py, r * 1.5, r * 0.6, 0, 0, 6.3); x.stroke(); }
    const g = x.createRadialGradient(40, 36, 2, 40, 36, 60); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const tex = new CanvasTexture(c); tex.wrapS = tex.wrapT = RepeatWrapping; tex.repeat.set(2.4, 2.4); tex.colorSpace = SRGBColorSpace;
    // v2.13: a second, fixed layer: deeper teal in the middle fading to pale turquoise at the bank, so the pond has depth
    const dc = document.createElement('canvas'); dc.width = dc.height = 128; const dx = dc.getContext('2d')!;
    const dg = dx.createRadialGradient(64, 64, 4, 64, 64, 64); dg.addColorStop(0, 'rgba(18,70,120,0.55)'); dg.addColorStop(0.55, 'rgba(40,130,170,0.25)'); dg.addColorStop(0.9, 'rgba(190,245,240,0.35)'); dg.addColorStop(1, 'rgba(255,255,255,0)'); dx.fillStyle = dg; dx.fillRect(0, 0, 128, 128);
    const depthTex = new CanvasTexture(dc); depthTex.colorSpace = SRGBColorSpace;
    const geo = new CircleGeometry(POND.r + 0.45, 40); geo.rotateX(-Math.PI / 2);
    const m = new Mesh(geo, new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 }));
    m.position.set(POND.x, heightAt(POND.x, POND.z) - 0.2, POND.z); m.renderOrder = 1; this.group.add(m);
    const depth = new Mesh(geo, new MeshBasicMaterial({ map: depthTex, transparent: true, depthWrite: false })); depth.position.copy(m.position); depth.position.y += 0.004; depth.renderOrder = 2; this.group.add(depth);
    // a soft foam ring that breathes at the bank, and glints that twinkle on the surface
    const fr = new Mesh(new RingGeometry(POND.r + 0.18, POND.r + 0.5, 40), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide })); fr.rotation.x = -Math.PI / 2; fr.position.copy(m.position); fr.position.y += 0.012; fr.renderOrder = 2; this.group.add(fr); this.foam = fr;
    for (let i = 0; i < 9; i++) { const a = i * 2.39, r = 0.4 + (i * 0.37) % (POND.r - 0.5); const sp = glowSprite(0xffffff, 0.45, 0); sp.position.set(POND.x + Math.cos(a) * r, m.position.y + 0.1, POND.z + Math.sin(a) * r); this.group.add(sp); this.pondGlints.push(sp); }
    // lily pads and reeds
    const pad = new CircleGeometry(0.34, 10, 0.4, 5.6); pad.rotateX(-Math.PI / 2);
    const padMesh = new InstancedMesh(pad, new MeshBasicMaterial({ color: 0x5fb04a, side: DoubleSide }), 9); const d = new Object3D();
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.5 + (i % 4) * 0.62; d.position.set(POND.x + Math.cos(a) * r, m.position.y + 0.02, POND.z + Math.sin(a) * r); d.rotation.y = i; d.scale.setScalar(0.8 + (i % 3) * 0.3); d.updateMatrix(); padMesh.setMatrixAt(i, d.matrix); }
    this.lilyGroup.add(padMesh); this.group.add(this.lilyGroup);
    // rim stones around the bank
    const stones: Item[] = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28 + (i % 2) * 0.1, r = POND.r + 0.55 + (i % 3) * 0.2; const sx = POND.x + Math.cos(a) * r, sz = POND.z + Math.sin(a) * r; stones.push({ x: sx, z: sz, y: heightAt(sx, sz) - 0.1, scale: 0.35 + (i % 4) * 0.12, rot: i * 1.3, tint: new Color(1, 1, 1) }); }
    const ss = new InstanceSet(stones, rockGeometry(31), envMaterial('none') as MeshLambertMaterial, null, true); this.group.add(ss.hi); ss.refresh(0, 0, 1e6);
    return m;
  }

  // ------------------------------------------------------------------------------------------------ backdrop
  private buildBackdrop(rnd: () => number): void {
    const gradient = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d')!; const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.92)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new CanvasTexture(c); })();
    const layers: [number, number, number, number, number][] = [[138, 26, 22, 3, 0.62], [160, 38, 30, 11, 0.45], [182, 52, 40, 23, 0.3]];
    for (const [radius, base, amp, seed, mix] of layers) {
      const segs = 120; const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2; const cx = Math.cos(a), cz = Math.sin(a);
        const ridge = base + amp * (0.5 * noise3(cx * 2.2 + seed, cz * 2.2, seed) + 0.3 * noise3(cx * 5 + seed, cz * 5, 3 + seed) + 0.2 * noise3(cx * 12, cz * 12 + seed, seed)) - amp * 0.3;
        pos.push(cx * radius, -6, cz * radius, cx * radius, ridge, cz * radius); uv.push(i / segs, 0, i / segs, 1);
        if (i < segs) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); g.setIndex(idx);
      const mat = new MeshBasicMaterial({ map: gradient, transparent: true, fog: false, side: DoubleSide, depthWrite: false });
      const mesh = new Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -2; this.group.add(mesh); this.mountains.push({ mat, mix });
    }
    // clouds
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 96; const cx = cc.getContext('2d')!;
    for (let i = 0; i < 16; i++) { const px = 40 + Math.random() * 176, py = 48 + (Math.random() - 0.5) * 26, r = 18 + Math.random() * 24; const g = cx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = g; cx.fillRect(0, 0, 256, 96); }
    const cloudTex = new CanvasTexture(cc); cloudTex.colorSpace = SRGBColorSpace;
    for (let i = 0; i < 11; i++) {
      const s = new Sprite(new SpriteMaterial({ map: cloudTex, transparent: true, fog: false, depthWrite: false, opacity: 0.8 }));
      const a = rnd() * 6.28, r = 110 + rnd() * 40; const sc = 55 + rnd() * 45; s.scale.set(sc, sc * 0.38, 1); s.position.set(Math.cos(a) * r, 62 + rnd() * 26, Math.sin(a) * r); s.renderOrder = -1;
      this.group.add(s); this.clouds.push(s); this.cloudBase.push({ a, r, speed: 0.004 + rnd() * 0.005 });
    }
  }

  // ------------------------------------------------------------------------------------------------ per frame
  /** Day-night colours for the backdrop, water and glows. */
  applyLook(look: SkyLook, night: number): void {
    this.nightNow = night;
    const fog = new Color(look.fog); const tint = new Color(0x587f98);
    for (const m of this.mountains) m.mat.color.copy(fog).lerp(tint, m.mix * (1 - night * 0.5));
    const cloudCol = new Color(look.sun).lerp(new Color(0xffffff), 0.55).multiplyScalar(0.45 + 0.55 * Math.min(1, look.hemiIntensity / 1.2));
    for (const c of this.clouds) { c.material.color.copy(cloudCol); c.material.opacity = 0.82 - night * 0.45; }
    (this.water.material as MeshBasicMaterial).color.setScalar(0.62 + 0.38 * (1 - night));
    this.glowMush.color.setScalar(0.85 + night * 0.9);
    this.fairyGlow && (this.fairyGlow.material.opacity = 0.2 + night * 0.45);
    for (let i = 0; i < 3; i++) this.ancientGlow[i].material.opacity = 0.22 + night * 0.3;
  }

  applyQuality(q: QualitySettings): void {
    this.q = q;
    const ratio = this.grassBuilt === 0 ? 0 : Math.min(1, q.grass);
    for (const g of this.grass) {
      // draw whole tufts only: the largest tuft boundary that fits the quality ratio
      const want = g.count * ratio; let lo = 0, hi = g.ends.length; while (lo < hi) { const m = (lo + hi) >> 1; if (g.ends[m] <= want) lo = m + 1; else hi = m; }
      g.mesh.geometry.setDrawRange(0, lo > 0 ? g.ends[lo - 1] : 0);
    }
    this.lastRefresh.set(1e9, 0, 1e9);
  }

  /** Called every frame; the heavy part only runs after the hero has moved a metre or so. */
  update(t: number, heroX: number, heroZ: number): void {
    wind.uTime.value = t; wind.uHero.value.set(heroX, 0, heroZ);
    this.waterTex.offset.set(t * 0.012, t * 0.008);
    if (this.foam) { const k = 1 + Math.sin(t * 0.9) * 0.025; this.foam.scale.set(k, k, 1); (this.foam.material as MeshBasicMaterial).opacity = 0.28 + 0.12 * Math.sin(t * 1.3); }
    this.pondGlints.forEach((g, i) => { const k = Math.max(0, Math.sin(t * 1.9 + i * 1.7)) ** 10; g.material.opacity = k * 0.9 * (1 - this.nightNow * 0.7); });
    this.clouds.forEach((c, i) => { const b = this.cloudBase[i]; const a = b.a + t * b.speed * 0.1; c.position.x = Math.cos(a) * b.r; c.position.z = Math.sin(a) * b.r; });
    this.buildLazyGrass(2, heroX, heroZ, this.q.plantRadius + 2 + NEAR_GRASS_CELL * 2);
    this.refresh(heroX, heroZ, false);
  }

  private refresh(hx: number, hz: number, force: boolean): void {
    if (!force && Math.hypot(hx - this.lastRefresh.x, hz - this.lastRefresh.z) < 1.2) return;
    this.lastRefresh.set(hx, 0, hz);
    const q = this.q;
    for (const { set, kind } of this.sets) {
      if (kind === 'tree') set.refresh(hx, hz, q.detailRadius, q.detailRadius * 4.5);
      else if (kind === 'plant') set.refresh(hx, hz, q.plantRadius);
      else set.refresh(hx, hz, ROCK_RADIUS);
    }
    const gr = q.plantRadius + 2;
    for (const g of this.grass) g.mesh.visible = q.grass > 0 && Math.hypot(g.x - hx, g.z - hz) < gr + NEAR_GRASS_CELL;
  }
}
