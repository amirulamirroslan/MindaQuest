const { launch } = require('./lib.cjs');
const sharp = require('sharp');
const PLAN = [['crab', 0, 'recover']];
(async () => {
  const { browser, page, logs } = await launch({ width: 560, height: 420, touch: true, query: 'debug&q=low' });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => { const g = __mq3d; g.setArea('shore'); await new Promise(r => setTimeout(r, 2500)); g.shore = { ...g.shore, tide: 'low' }; g.shoreWorld.setTide('low', false); g.chars.clear(); g.spawnShoreCreatures(false); });
  const tiles = []; const info = {};
  for (const [kind, tag, want] of PLAN) {
    const r = await page.evaluate(async ([kind, tag, want]) => {
      const g = __mq3d; const e = g.chars.all().find(c => c.enemy.def.kind === kind && c.enemy.tag === tag); if (!e) return { found: false };
      const p = e.enemy.pos; g.pos.x = p.x; g.pos.z = p.z + 5; g.vitals.hp = g.vitals.maxHp; g.vitals.invuln = 99;
      const real = g.renderer.render.bind(g.renderer); g.renderer.render = () => {}; let now = performance.now(), hit = false, seen = new Set();
      for (let i = 0; i < 1500 && !hit; i++) { now += 16.7; g.frame(now); seen.add(e.enemy.state); if (e.enemy.state === want) hit = true; g.vitals.hp = g.vitals.maxHp; }
      g.renderer.render = real; now += 16.7; g.frame(now);
      const q = e.enemy.pos, h = g.hero.root.position; g.debugCam = { from: [q.x + 3.2, h.y + 4.2, q.z + 5.2], to: [q.x, h.y + 0.6, q.z] };
      return { found: true, hit, state: e.enemy.state, seen: [...seen], markerVisible: e.marker ? e.marker.visible ?? e.marker.group?.visible ?? null : null, attack: e.enemy.currentAttack };
    }, [kind, tag, want]);
    info[`${kind}-${want}`] = r; if (!r.found) continue;
    await page.waitForTimeout(250);
    const buf = await page.screenshot({ clip: { x: 80, y: 40, width: 400, height: 340 }, timeout: 120000 });
    tiles.push({ input: await sharp(buf).resize(300, 255).toBuffer(), left: (tiles.length % 2) * 300, top: Math.floor(tiles.length / 2) * 255 });
  }
  await sharp({ create: { width: 300, height: 255, channels: 3, background: '#222' } }).composite(tiles).png().toFile('shots/combat3.png');
  console.log(JSON.stringify(info)); console.log(logs.join('\n') || 'no console errors'); await browser.close();
})();
