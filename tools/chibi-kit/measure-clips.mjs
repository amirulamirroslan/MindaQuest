/** Prints duration, hit time (peak hand speed) and recovery time of every clip in the kit. Usage: node tools/chibi-kit/measure-clips.mjs [kit.glb] */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2] ?? 'public/assets/chibi/chibi_kit.glb');
const nodes = doc.getRoot().listNodes(); const byName = n => nodes.find(x => x.getName() === n);
const qmul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qrot = (q, v) => { const [x, y, z, w] = q; const t = [2*(y*v[2]-z*v[1]), 2*(z*v[0]-x*v[2]), 2*(x*v[1]-y*v[0])]; return [v[0]+w*t[0]+y*t[2]-z*t[1], v[1]+w*t[1]+z*t[0]-x*t[2], v[2]+w*t[2]+x*t[1]-y*t[0]]; };
const slerp = (a, b, t) => { let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]; if (d < 0) { b = b.map(x => -x); d = -d; } if (d > 0.9995) { const r = a.map((x, i) => x + (b[i]-x)*t); const l = Math.hypot(...r); return r.map(x => x/l); } const th = Math.acos(d), s = Math.sin(th); const k1 = Math.sin((1-t)*th)/s, k2 = Math.sin(t*th)/s; return a.map((x, i) => x*k1 + b[i]*k2); };
function sample(ch, t) { const s = ch.getSampler(); const ti = s.getInput().getArray(), out = s.getOutput().getArray(); const w = ch.getTargetPath() === 'rotation' ? 4 : 3; let i = 0; while (i < ti.length - 2 && ti[i+1] <= t) i++; const j = Math.min(i+1, ti.length-1); const f = ti[j] === ti[i] ? 0 : Math.min(1, Math.max(0, (t-ti[i])/(ti[j]-ti[i]))); const a = Array.from(out.slice(i*w, i*w+w)), b = Array.from(out.slice(j*w, j*w+w)); return w === 4 ? slerp(a, b, f) : a.map((x, k) => x + (b[k]-x)*f); }
function handPos(anim, t) {
  const chans = new Map(); for (const ch of anim.listChannels()) chans.set(ch.getTargetNode().getName() + ':' + ch.getTargetPath(), ch);
  const chain = []; for (let n = byName('handslot.r'); n; n = n.getParentNode()) chain.unshift(n);
  let q = [0, 0, 0, 1], p = [0, 0, 0];
  for (const n of chain) { const rc = chans.get(n.getName()+':rotation'), tc = chans.get(n.getName()+':translation'); const lq = rc ? sample(rc, t) : n.getRotation(); const lp = tc ? sample(tc, t) : n.getTranslation(); const sc = n.getScale(); const sp = [lp[0]*1, lp[1]*1, lp[2]*1]; const w = qrot(q, [sp[0]*sc[0]*0+sp[0], sp[1], sp[2]]); p = [p[0]+w[0], p[1]+w[1], p[2]+w[2]]; q = qmul(q, lq); }
  return p;
}
const rows = [];
for (const a of doc.getRoot().listAnimations()) {
  let dur = 0; for (const s of a.listSamplers()) { const t = s.getInput().getArray(); dur = Math.max(dur, t[t.length-1]); }
  let row = { clip: a.getName(), duration: +dur.toFixed(3) };
  if (/Attack|Spellcast|Throw/.test(a.getName())) {
    const N = 80; const sp = []; let prev = handPos(a, 0);
    for (let i = 1; i <= N; i++) { const t = dur*i/N; const pp = handPos(a, t); sp.push(Math.hypot(pp[0]-prev[0], pp[1]-prev[1], pp[2]-prev[2])/(dur/N)); prev = pp; }
    const peak = Math.max(...sp), pi = sp.indexOf(peak);
    let end = pi; while (end < N-1 && sp[end] > peak*0.15) end++;
    row.hit = +(dur*(pi+1)/N).toFixed(2); row.end = +(dur*(end+1)/N).toFixed(2);
  }
  rows.push(row);
}
console.log(JSON.stringify(rows));
