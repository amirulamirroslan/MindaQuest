const { launch } = require('./lib.cjs');
const fs = require('fs');
const SIZES = [[844, 390, 'land'], [390, 844, 'port']];
(async () => {
  for (const [w, h, tag] of SIZES) {
    const { browser, page, logs } = await launch({ width: w, height: h, touch: true });
    await page.waitForTimeout(2000);
    const res = {};
    await page.evaluate(() => { __mq3d.setArea('shore'); });
    await page.waitForTimeout(2500);
    res.tideBadge = await page.evaluate(() => { const e = document.querySelector('.mq-q-tide'); return e ? { text: e.textContent, display: getComputedStyle(e).display, cls: e.className } : null; });
    await page.screenshot({ path: `shots/shore-${tag}.png`, timeout: 120000 });
    for (const theme of ['clock', 'money']) {
      const seen = new Set();
      for (let i = 0; i < 12 && seen.size < 2; i++) {
        const kind = await page.evaluate(async theme => {
          const g = __mq3d; const k = g.st[theme === 'clock' ? 'keeper' : 'mak']; const q = g.gateQuestion(k.ask, theme);
          g.hud.openDialogue('Test', ['Hello'], () => {}, q); g.advanceDialogue();
          await new Promise(r => setTimeout(r, 300));
          return q.riddle.kind;
        }, theme);
        if (seen.has(kind)) continue; seen.add(kind);
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => { const b = document.querySelector('.mq-dq'); const r = b && b.getBoundingClientRect(); return { clocks: document.querySelectorAll('.mq-dq-clock').length, coins: document.querySelectorAll('.mq-dq-coin').length, petals: document.querySelectorAll('.mq-dq-petal').length, rect: r && [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], vw: innerWidth, vh: innerHeight, ask: document.querySelector('.mq-dlg-text, .mq-dialogue-text')?.textContent }; });
        res[`${theme}-${kind}`] = m;
        await page.screenshot({ path: `shots/q-${theme}-${kind}-${tag}.png`, timeout: 120000 });
      }
    }
    res.logs = logs;
    fs.writeFileSync(`shore-${tag}.json`, JSON.stringify(res, null, 1));
    console.log(tag, 'done');
    await browser.close();
  }
})();
