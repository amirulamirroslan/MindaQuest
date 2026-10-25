// Headless-Chromium screenshots of the built 3D game for visual review of the v2.9 polish pass.
// Usage: node polish-shots.mjs <dist dir> <out dir> [quick]
//   - gameplay frames at desktop / tablet / phone portrait / phone landscape
//   - hero close-ups (front, side) in several poses, on the real gameplay camera and on a free camera
//   - HUD with a quest, pause menu and wardrobe on each viewport
import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const [dist, out, quick] = [process.argv[2], process.argv[3], process.argv[4]]; fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' };
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0);
const port = srv.address().port;
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: 'shell' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const VPS = [['desktop', { width: 1280, height: 720 }, false], ['tablet', { width: 820, height: 1180 }, true], ['phone-portrait', { width: 390, height: 844 }, true], ['phone-landscape', { width: 844, height: 390 }, true]];
const POSES = {
  stand: { speed: 0, attack: null, special: null }, walk: { speed: 3.6, attack: null, special: null }, run: { speed: 5.8, attack: null, special: null },
  attack: { speed: 0, attack: 0.5, special: null },
};
const only = process.env.VP; // e.g. VP=phone-portrait to run a single viewport
for (const [label, vp, touch] of (only ? VPS.filter(v => v[0] === only) : quick ? VPS.slice(0, 1) : VPS)) {
  const p = await b.newPage(); const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.setViewport({ ...vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await p.goto(`http://127.0.0.1:${port}/index.html?debug&q=${touch ? 'medium' : 'high'}&tod=day`, { waitUntil: 'load' });
  await p.waitForFunction('window.__mq3d && window.__mq3d.hero && window.__mq3d.hero.ready', { timeout: 120000 }).catch(() => {});
  await wait(3000);
  await p.screenshot({ path: `${out}/${label}-1-play.png` });
  // walk forward for a moment so the moving pose is on screen
  await p.keyboard.down('KeyW'); await wait(900); await p.screenshot({ path: `${out}/${label}-2-walk.png` }); await p.keyboard.up('KeyW');
  // pause and take free-camera close-ups
  await p.evaluate('window.__mq3d.setPaused(true)'); const hide = await p.addStyleTag({ content: '.mq-hud{visibility:hidden!important}' }); await wait(300);
  for (const [name, pose] of Object.entries(POSES)) {
    if (quick && name !== 'stand' && name !== 'attack') continue;
    await p.evaluate(`(()=>{const g=window.__mq3d; g.hero.setFlash(0); g.hero.pose({speed:${pose.speed},time:g.time||1,attack:${pose.attack},dodge:null,special:${pose.special},faint:0}); g.hero.pose({speed:${pose.speed},time:(g.time||1)+0.05,attack:${pose.attack},dodge:null,special:${pose.special},faint:0});})()`);
    for (const [view, off] of [['front', [0, 1.1, -3.0]], ['side', [3.0, 1.1, 0]]]) {
      await p.evaluate(`(()=>{const g=window.__mq3d; const y=g.hero.root.position.y; g.debugCam={from:[g.pos.x+${off[0]}, y+${off[1]}, g.pos.z+${off[2]}], to:[g.pos.x, y+0.72, g.pos.z]};})()`);
      await wait(350); await p.screenshot({ path: `${out}/${label}-3-close-${name}-${view}.png` });
    }
  }
  await p.evaluate('window.__mq3d.debugCam = null'); await p.evaluate('window.__mq3d.setPaused(false)'); await p.evaluate('document.querySelectorAll("style").forEach(s=>{ if (s.textContent.includes("visibility:hidden!important")) s.remove(); })'); await wait(500);
  // pause menu
  await p.evaluate('window.__mq3d.setPaused(true)'); await wait(400); await p.screenshot({ path: `${out}/${label}-4-pause.png` });
  await p.evaluate('window.__mq3d.setPaused(false); window.__mq3d.openWardrobe()'); await wait(2200);
  await p.screenshot({ path: `${out}/${label}-5-wardrobe.png` });
  for (const idx of [4, 6]) { if (quick) break; await p.evaluate(`document.querySelectorAll('.mq-cs-tab')[${idx}]?.click()`); await wait(700); await p.screenshot({ path: `${out}/${label}-6-wardrobe-tab${idx}.png` }); }
  console.log(label, 'errors:', errors.length ? errors.slice(0, 4) : 'none');
  await p.close();
}
await b.close(); srv.close();
