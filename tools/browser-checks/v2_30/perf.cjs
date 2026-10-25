const { launch } = require('./lib.cjs');
const fs = require('fs'); const out = {};
(async () => {
  for (const q of ['low', 'high']) {
    const { browser, page, logs } = await launch({ width: 844, height: 390, touch: true, query: `debug&q=${q}` });
    await page.waitForTimeout(2000);
    for (const area of ['woods', 'hollow', 'shore']) {
      await page.evaluate(a => __mq3d.setArea(a), area);
      await page.waitForTimeout(3500);
      out[`${q}-${area}`] = await page.evaluate(() => {
        const g = __mq3d, r = g.renderer, i = r.info; let meshes = 0, visible = 0, casters = 0, lights = 0, skinned = 0, transparent = 0;
        g.scene.traverse(o => { if (o.isLight) lights++; if (o.isMesh || o.isSprite || o.isPoints || o.isLine) { meshes++; let v = true, n = o; while (n) { if (!n.visible) v = false; n = n.parent; } if (v) { visible++; if (o.castShadow) casters++; if (o.isSkinnedMesh) skinned++; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.transparent) transparent++; } } });
        return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length, meshes, visible, casters, lights, skinned, transparent, pixelRatio: r.getPixelRatio(), shadows: r.shadowMap.enabled, size: [innerWidth, innerHeight] };
      });
    }
    out[`${q}-errors`] = logs; await browser.close();
  }
  fs.writeFileSync('perf.json', JSON.stringify(out, null, 1)); console.log('perf done');
})();
