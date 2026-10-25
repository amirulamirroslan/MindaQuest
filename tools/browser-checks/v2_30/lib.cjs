const { chromium } = require('playwright');
const BASE = process.env.MQ_URL || 'http://127.0.0.1:4173/3d.html';
const ALL_UNLOCKS = ['mossy-cloak','crystal-hat','warden-mantle','sailor-jacket','sailor-trousers','sailor-cap','lighthouse-lantern'];
function seed({ xp = 6000, shore = null, equipped = null, lang = 'en' } = {}) {
  const progress = { stage: 'complete', petalIds: [0,1,2,3,4,5], sproutsCalmed: 3, bossDefeated: true, xp, gateOpen: true, unlocked: ALL_UNLOCKS, runesSolved: 3, runeMistakes: 0, runeTier: 2, bonusXp: 0 };
  return { progress, shore, equipped, lang };
}
async function launch({ width = 1280, height = 720, touch = false, query = 'debug&q=low', seedOpts = {}, dpr = 1 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.MQ_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const logs = []; page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); }); page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  const s = seed(seedOpts);
  await page.addInitScript(s => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('mindquest.progress.v1', JSON.stringify(s.progress));
    if (s.shore) localStorage.setItem('mindquest.shore.v1', JSON.stringify(s.shore));
    if (s.equipped) localStorage.setItem('mindquest.cosmetics.v2', JSON.stringify({ version: 2, granted: [], equipped: s.equipped, tints: { cape: 0, headgear: 0 } }));
    localStorage.setItem('mindquest.lang.v1', s.lang);
  }, s);
  await page.goto(`${BASE}?${query}`);
  await page.waitForFunction(() => window.__mq3d, null, { timeout: 30000 });
  return { browser, page, logs };
}
module.exports = { launch, BASE };
