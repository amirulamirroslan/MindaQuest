/**
 * The ground of the Whispering Woods: a smooth, vertex-coloured mesh with painted variation (sunlit patches, shaded hollows,
 * a worn dirt trail with soft edges, trampled village green, cracked stone around the ruins), baked ambient occlusion under every
 * tree, rock and building, and a fine procedural grain added in the shader so the ground never looks like a flat colour.
 */
import { BufferAttribute, Color, Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import type { WorldLayout } from '../../systems/layout3d';
import { POND, RUINS, VILLAGE, WORLD_RADIUS, distToTrail, heightAt, smoothstep } from '../../systems/worldShape';
import { fbm2, noise2 } from './noise';
import { withPaint } from '../stylize';

export function buildTerrain(layout: WorldLayout, segments = 190): Mesh {
  const size = WORLD_RADIUS * 2 + 12;
  const g = new PlaneGeometry(size, size, segments, segments); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);

  // occluders for baked AO: trees (trunk + canopy shade), rocks, houses
  const cell = 4; const buckets = new Map<string, { x: number; z: number; r: number; k: number; tree: number }[]>();
  const put = (x: number, z: number, r: number, k: number, tree = 0) => {
    for (let cx = Math.floor((x - r) / cell); cx <= Math.floor((x + r) / cell); cx++) for (let cz = Math.floor((z - r) / cell); cz <= Math.floor((z + r) / cell); cz++) {
      const key = `${cx},${cz}`; const a = buckets.get(key); const o = { x, z, r, k, tree }; if (a) a.push(o); else buckets.set(key, [o]);
    }
  };
  for (const t of layout.trees) put(t.x, t.z, 2.6 * t.scale, 0.5, t.kind === 'pine' ? 2 : 1);
  for (const t of layout.deadTrees) put(t.x, t.z, 2.2 * t.scale, 0.35, 3);
  for (const r of layout.rocks) put(r.x, r.z, 1.5 * r.scale, 0.38);
  for (const c of layout.colliders) if (c.r > 0.9) put(c.x, c.z, c.r + 1.4, 0.3);

  const grassA = new Color(0x5cc24a), grassB = new Color(0x2f9a40), sun = new Color(0xa8e056), deep = new Color(0x1b6f40), dirt = new Color(0xc99a62), dirtDark = new Color(0x9a7448);
  const village = new Color(0x82bf55), rim = new Color(0x5e6a58), mud = new Color(0x6e9a52), shore = new Color(0xc2b684), c = new Color();
  const ruinsFloor = new Color(0x9aa39a);
  const litter = new Color(0xb08a3e), litterRed = new Color(0xa8552a), needles = new Color(0x9a6a3a), deadGround = new Color(0x8a7a5e);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = heightAt(x, z);
    const pd = Math.hypot(x - POND.x, z - POND.z);
    if (pd < POND.r + 0.9) y -= 0.42 * (1 - smoothstep(POND.r - 2.2, POND.r + 0.9, pd)) ** 1.2 * 1.0;
    pos.setY(i, y);
    const big = fbm2(x * 0.045 + 7, z * 0.045 - 3, 3), mid = fbm2(x * 0.16, z * 0.16, 3), fine = noise2(x * 0.9, z * 0.9);
    c.copy(grassB).lerp(grassA, smoothstep(0.3, 0.75, mid)).lerp(sun, smoothstep(0.55, 0.85, big) * 0.65).lerp(deep, smoothstep(0.55, 0.2, big) * 0.55);
    c.multiplyScalar(0.93 + 0.14 * fine);
    c.lerp(village, 1 - smoothstep(VILLAGE.r - 3, VILLAGE.r + 3, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)));
    // the worn trail: dirt in the middle, grassy flecks at the edges
    const td = distToTrail(x, z) + (fbm2(x * 0.7, z * 0.7, 2) - 0.5) * 0.7;
    const trail = 1 - smoothstep(0.85, 1.7, td); // v2.9: a crisper trail edge reads better against the meadow
    const cobble = noise2(Math.floor(x * 3.2) * 1.7 + 11, Math.floor(z * 3.2) * 1.7 - 5);
    c.lerp(dirt, trail * 0.95).lerp(dirtDark, trail * (smoothstep(0.55, 0.9, noise2(x * 2.2, z * 2.2)) * 0.35 + smoothstep(0.35, 0.8, cobble) * 0.4));
    c.lerp(ruinsFloor, 0.75 * (1 - smoothstep(RUINS.r - 3, RUINS.r + 1.5, Math.hypot(x - RUINS.x, z - RUINS.z))) * (0.6 + 0.4 * fine));
    c.lerp(rim, smoothstep(30, WORLD_RADIUS, Math.hypot(x, z)) * 0.8);
    // pond: muddy bank and a pale sandy lip
    c.lerp(shore, (1 - smoothstep(POND.r - 0.2, POND.r + 1.3, pd)) * 0.7).lerp(mud, 1 - smoothstep(POND.r - 1.6, POND.r - 0.2, pd));
    // baked AO
    let ao = 1;
    const list = buckets.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
    if (list) for (const o of list) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.r) {
        ao *= 1 - o.k * (1 - smoothstep(0, o.r, d)) ** 1.5;
        // leaf litter / needle carpet / bare earth under the trees, in speckled patches
        if (o.tree && trail < 0.5) {
          const near = (1 - smoothstep(o.r * 0.2, o.r * 0.95, d)) * (smoothstep(0.38, 0.7, fbm2(x * 1.6 + 5, z * 1.6 - 2, 2)) * 0.8 + 0.2);
          const base = o.tree === 2 ? needles : o.tree === 3 ? deadGround : (noise2(x * 5.1, z * 5.1) > 0.55 ? litterRed : litter);
          c.lerp(base, near * (o.tree === 1 ? 0.55 : 0.7));
        }
      }
    }
    c.multiplyScalar(Math.max(0.52, ao));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mat = new MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vGround;
      float gHeight = 0.0;
      float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float camD = length(vViewPosition);
        float far = 1.0 - smoothstep(14.0, 42.0, camD);           // fine detail fades with distance (no shimmer)
        float n = gn(vGround*2.3)*0.55 + gn(vGround*7.1)*0.3 + gn(vGround*19.0)*0.15; diffuseColor.rgb *= 0.85 + 0.3*n; // v2.13: calmer grain, so the ground reads as big painted shapes
        float grassy = smoothstep(0.04, 0.16, diffuseColor.g - diffuseColor.r);
        // painted blade strokes: stretched noise in two directions, darker and lighter streaks
        float s1 = gn(vec2(vGround.x*34.0, vGround.y*6.0)), s2 = gn(vec2(vGround.x*7.0 + 9.0, vGround.y*30.0));
        float s3 = gn(vec2(vGround.x*60.0 + 3.0, vGround.y*11.0)), s4 = gn(vec2(vGround.x*13.0, vGround.y*58.0 - 4.0));
        diffuseColor.rgb *= 1.0 + grassy*((s1-0.5)*0.17 + (s2-0.5)*0.13 + far*((s3-0.5)*0.08 + (s4-0.5)*0.06)); // v2.9: calmer strokes
        // dark crevices between grass tussocks and sun-bleached dry fleck patches
        float tus = gn(vGround*3.1 + 17.0);
        diffuseColor.rgb *= 1.0 - grassy*0.22*smoothstep(0.62, 0.9, tus);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.22,1.1,0.6), grassy*smoothstep(0.7, 0.92, gn(vGround*0.5 + 31.0))*0.45*far);
        // tiny meadow flowers as speckles (white, yellow, pink, lilac)
        vec2 fp = vGround*5.5; vec2 fi = floor(fp); vec2 ff = fract(fp) - 0.5; float fh = gh(fi + 3.7);
        float dot_ = smoothstep(0.11, 0.05, length(ff + (vec2(gh(fi), gh(fi+1.3)) - 0.5)*0.5)) * step(0.955, fh) * grassy; // v2.9: fewer speckle flowers
        vec3 fc = fh > 0.985 ? vec3(1.0,0.95,0.55) : fh > 0.96 ? vec3(1.0,0.62,0.78) : fh > 0.948 ? vec3(0.78,0.66,1.0) : vec3(1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, fc, dot_*0.85);
        // pebbles and grit on the dirt (anything that is not grass): round pale stones with a small bump
        float dirtM = 1.0 - grassy;
        vec2 pp = vGround*8.0; vec2 pi = floor(pp); vec2 pf = fract(pp) - 0.5; float ph = gh(pi + 9.1);
        float pr = 0.1 + 0.12*gh(pi + 4.4);
        float peb = smoothstep(pr, pr - 0.05, length(pf + (vec2(gh(pi), gh(pi+2.2)) - 0.5)*0.45)) * step(0.52, ph) * dirtM;
        vec3 pc = mix(vec3(0.66,0.62,0.55), vec3(0.5,0.52,0.54), gh(pi + 1.1)) * (0.85 + 0.3*gh(pi + 6.3));
        diffuseColor.rgb = mix(diffuseColor.rgb, pc, peb*0.92);
        // a height field for the bump below: lumps, grit, stones and blade strokes
        gHeight = (gn(vGround*14.0)*0.45 + gn(vGround*37.0)*0.3*far + peb*0.9 + grassy*(s1*0.35 + s2*0.25 + tus*0.3)) * (0.35 + 0.65*far + 0.25*peb);
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // screen-space bump (derivative based, no texture): ridges and stones catch the low golden sun
        vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
        float hx = dFdx(gHeight), hy = dFdy(gHeight);
        vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
        float det = dot(sx, r1);
        vec3 grad = sign(det) * (hx * r1 + hy * r2);
        normal = normalize(abs(det) * normal - 0.03 * grad);
      }`);
  };
  withPaint(mat);
  const m = new Mesh(g, mat); m.receiveShadow = true; m.name = 'terrain';
  return m;
}
