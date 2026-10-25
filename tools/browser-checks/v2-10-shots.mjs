// v2.10 visual checks: weapon scale, shoes, map, HUD. Usage: node tools/browser-checks/v2-10-shots.mjs dist out [only]
import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const dist = process.argv[2], out = process.argv[3], only = process.argv[4]; fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0);
await new Promise(r => srv.on('listening', r));
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: 'shell' });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(w, h, extra = '', dsf = 1) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?debug&q=low&tod=day${extra}`);
  await p.waitForFunction('window.__mq3d&&window.__mq3d.hero.ready', { timeout: 120000 });
}
const hero = async (look, yawOff = 0, zoom = 1.5) => {
  await p.evaluate(`(()=>{const g=window.__mq3d;g.progress={...g.progress,xp:900};g.openWardrobe();document.querySelector('.mq-cs-panel').style.display='none';document.querySelector('.mq-cs-view').style.display='none';
    for(const [s,id] of Object.entries(${JSON.stringify(look)}))g.equip(s,id); g.wardrobeZoom=${zoom}; g.wardrobeHeading=g.wardrobeYaw+${yawOff};})()`);
  await sleep(1500);
};
const SHOTS = {
  async weapons() {
    await open(700, 560);
    for (const [name, w, o] of [['lantern', 'sword-hero', 'glow-lantern'], ['sword', 'sword-hero', null], ['sword-shield', 'sword-hero', 'shield-round'], ['great', 'sword-great', null], ['axe', 'axe-clan', null], ['dagger', 'dagger-ranger', null], ['staff', 'staff-moon', null]]) {
      await hero({ weapon: w, offhand: o }, 1.1); await p.screenshot({ path: `${out}/weapon-${name}.png` });
    }
  },
  async feet() {
    await open(700, 560, '', 4);
    const clip = { x: 270, y: 310, width: 190, height: 120 };
    const ids = (process.env.SHOES || '').split(',').filter(Boolean);
    for (const yaw of (process.env.YAWS || '1.1,0.2').split(',').map(Number)) {
      await hero({ weapon: null, offhand: null }, yaw, 1.5);
      await p.screenshot({ path: `${out}/feet-default-${yaw}.png`, clip });
      for (const id of ids) { await p.evaluate(`window.__mq3d.equip('shoes','${id}')`); await sleep(900); await p.screenshot({ path: `${out}/feet-${id}-${yaw}.png`, clip }); }
    }
  },
};
for (const [k, fn] of Object.entries(SHOTS)) if (!only || only === k) await fn();
console.log('errors', JSON.stringify(errs)); await b.close(); srv.close();
