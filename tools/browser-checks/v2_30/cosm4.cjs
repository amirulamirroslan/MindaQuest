const { launch } = require('./lib.cjs');
const sharp = require('sharp');
const SETS = {
  leafcrown: [{ headgear: 'leaf-crown' }, 'head'], seacrown: [{ headgear: 'sea-crown' }, 'head'], sailorcap: [{ headgear: 'sailor-cap' }, 'head'], crystalhat: [{ headgear: 'crystal-hat' }, 'head'],
  sailorset: [{ outfit: 'sailor-jacket', legs: 'sailor-trousers', headgear: 'sailor-cap' }, 'full'],
  mossy: [{ cape: 'mossy-cloak' }, 'full'], mantle: [{ cape: 'warden-mantle' }, 'full'], lantern: [{ offhand: 'lighthouse-lantern' }, 'full'],
};
const ANGLES = [0.5, 2.6, -0.9];
(async () => {
  const { browser, page, logs } = await launch({ width: 480, height: 420 });
  await page.waitForTimeout(2500);
  const only = process.argv.slice(2);
  for (const [name, [set, frame]] of Object.entries(SETS)) {
    if (only.length && !only.includes(name)) continue;
    await page.evaluate(set => { const g = __mq3d; for (const s of ['headgear','cape','offhand']) g.equip(s, null); g.equip('outfit','outfit-ranger'); g.equip('legs','legs-ranger'); for (const [s, id] of Object.entries(set)) g.equip(s, id); }, set);
    await page.waitForTimeout(400);
    const tiles = [];
    for (const yaw of ANGLES) {
      await page.evaluate(([yaw, frame]) => { const g = __mq3d, r = g.hero.root.position, a = g.heading + yaw; const d = frame === 'head' ? 1.9 : 3.4, hy = frame === 'head' ? 1.15 : 0.8, cy = frame === 'head' ? 1.5 : 1.7; g.debugCam = { from: [r.x + Math.sin(a) * d, r.y + cy, r.z + Math.cos(a) * d], to: [r.x, r.y + hy, r.z] }; }, [yaw, frame]);
      await page.waitForTimeout(350);
      const buf = await page.screenshot({ clip: { x: 40, y: 20, width: 400, height: 380 }, timeout: 120000 });
      tiles.push({ input: await sharp(buf).resize(280, 266).toBuffer(), left: tiles.length * 280, top: 0 });
    }
    await sharp({ create: { width: 840, height: 266, channels: 3, background: '#222' } }).composite(tiles).png().toFile(`shots/c4-${name}.png`);
    console.log('done', name);
  }
  console.log(logs.join('\n') || 'no console errors'); await browser.close();
})();
