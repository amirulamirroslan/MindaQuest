// Dumps computed styles of every .mq-* element in several UI states and viewports, so a CSS clean-up can be proven to change nothing.
// Usage: node tools/browser-checks/css-snapshot.mjs dist out.json [shots-dir]
import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const [dist, outFile, shots] = process.argv.slice(2); if (shots) fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0);
await new Promise(r => srv.on('listening', r));
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: 'shell' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); const result = {}; const errs = [];
const dump = () => `(() => { const out = {}; const els = [...document.querySelectorAll('[class*="mq-"]')]; const cnt = {};
  for (const e of els) { const cls = (e.getAttribute('class') || '').split(/\\s+/).filter(c => c.startsWith('mq-')).join('.'); const k = cls + '#' + (cnt[cls] = (cnt[cls] || 0) + 1); const cs = getComputedStyle(e); const o = {};
    for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (/^(transition|animation|will-change|caret|-webkit-)/.test(p)) continue; o[p] = cs.getPropertyValue(p); } const r = e.getBoundingClientRect(); o.__rect = [r.x, r.y, r.width, r.height].map(v => Math.round(v)).join(','); out[k] = o; } return out; })()`;
for (const [name, w, h] of [['phone', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 720]]) {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: name !== 'desktop', isMobile: name !== 'desktop' });
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?debug&q=low&tod=day`); await p.waitForFunction('window.__mq3d&&window.__mq3d.hero.ready', { timeout: 150000 }); await sleep(800);
  const snap = async (state) => { result[`${name}/${state}`] = await p.evaluate(dump()); if (shots) await p.screenshot({ path: `${shots}/${name}-${state}.png` }); };
  await snap('hud');
  if (await p.evaluate('typeof window.__mq3d.toggleMap') === 'function') { await p.evaluate('window.__mq3d.toggleMap(true)'); await sleep(600); await snap('map'); await p.evaluate('window.__mq3d.toggleMap(false)'); await sleep(200); }
  await p.evaluate('window.__mq3d.setPaused(true)'); await sleep(300); await snap('pause');
  await p.evaluate('window.__mq3d.openWardrobe()'); await sleep(900); await snap('wardrobe');
  const tabs = await p.$$('.mq-cs-tab'); for (let i = 0; i < tabs.length; i++) { await p.evaluate(`document.querySelectorAll('.mq-cs-tab')[${i}].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); document.querySelectorAll('.mq-cs-tab')[${i}].click()`); await sleep(250); await snap(`wardrobe-tab${i}`); }
  await p.close();
}
fs.writeFileSync(outFile, JSON.stringify(result)); console.log('states', Object.keys(result).length, 'errors', JSON.stringify(errs)); await b.close(); srv.close();
