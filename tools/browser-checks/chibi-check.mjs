// Headless-Chromium check of the built 3D game. Usage: node chibi-check.mjs <dist dir> <out dir>
import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const [dist, out] = [process.argv[2], process.argv[3]]; fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' };
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0);
const port = srv.address().port; const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: 'shell' });
async function session(label, vp, touch) {
  const p = await b.newPage(); const errors = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.setViewport({ ...vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await p.goto(`http://127.0.0.1:${port}/index.html?debug&q=low&tod=day`, { waitUntil: 'load' });
  await p.waitForFunction('window.__mq3d && window.__mq3d.hero && window.__mq3d.hero.ready', { timeout: 90000 }).catch(() => {});
  const ready = await p.evaluate('!!(window.__mq3d && window.__mq3d.hero.ready)'); const chibi = await p.evaluate('!!(window.__mq3d && window.__mq3d.hero.isChibi)');
  check(`${label}: hero ready`, ready); check(`${label}: chibi rig active (not fallback)`, chibi);
  await new Promise(r => setTimeout(r, 2500));
  await p.screenshot({ path: `${out}/${label}-play.png` });
  return { p, errors };
}
const results2 = {};
for (const [label, vp, touch] of [['desktop', { width: 1280, height: 720 }, false], ['phone-portrait', { width: 390, height: 844 }, true], ['phone-landscape', { width: 844, height: 390 }, true]]) {
  const { p, errors } = await session(label, vp, touch);
  await p.evaluate('window.__mq3d.setPaused(false); window.__mq3d.openWardrobe()');
  await new Promise(r => setTimeout(r, 2500));
  await p.screenshot({ path: `${out}/${label}-wardrobe.png` });
  // try each category tab and an equip via the DOM
  const tabCount = await p.evaluate(`document.querySelectorAll('.mq-cs-tab').length`); check(`${label}: wardrobe has 10 tabs`, tabCount === 10, String(tabCount));
  for (const idx of [0, 4, 6, 7, 9]) { await p.evaluate(`document.querySelectorAll('.mq-cs-tab')[${idx}].click()`); await new Promise(r => setTimeout(r, 250)); }
  await p.evaluate(`document.querySelectorAll('.mq-cs-tab')[6].click()`); await new Promise(r => setTimeout(r, 200));
  const cards = await p.evaluate(`[...document.querySelectorAll('.mq-cs-card')].map(c=>c.className+'|'+c.textContent)`); check(`${label}: weapon cards listed`, cards.length >= 8, String(cards.length));
  // overflow check: the panel must fit the viewport
  const fit = await p.evaluate(`(()=>{const r=document.querySelector('.mq-cs-panel').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})()`); check(`${label}: panel inside viewport`, fit);
  const tapSize = await p.evaluate(`Math.min(...[...document.querySelectorAll('.mq-cs-tab,.mq-cs-card,.mq-sw,.mq-cs-vbtn')].map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height)}))`); check(`${label}: smallest tap target >= 36px`, tapSize >= 36, tapSize.toFixed(0) + 'px');
  results2[label] = { errors };
  await p.close();
}
console.log('ERRORS', JSON.stringify(results2, null, 1).slice(0, 2500));
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
await b.close(); srv.close();
