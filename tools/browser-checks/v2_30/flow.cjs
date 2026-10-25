const { launch } = require('./lib.cjs');
const fs = require('fs'); const res = {};
const STEP = `window.__step = (n) => { const g = __mq3d, real = g.renderer.render.bind(g.renderer); g.renderer.render = () => {}; let now = performance.now(); for (let i = 0; i < n; i++) { now += 16.7; g.frame(now); } g.renderer.render = real; };`;
(async () => {
  const { browser, page, logs } = await launch({ width: 640, height: 400, query: 'debug&q=low' });
  await page.waitForTimeout(2000); await page.evaluate(STEP);
  res.start = await page.evaluate(() => ({ area: __mq3d.area, xp: __mq3d.progress.xp }));
  // 1. walk into the real shore arch trigger
  res.arch = await page.evaluate(() => { const g = __mq3d; g.hollow = { ...g.hollow, heartDone: true }; g.applyWorldState(); g.pos.x = 6.2; g.pos.z = 19; g.portalArmed = true; __step(200); return { area: g.area, transition: !!g.transition, pos: [+g.pos.x.toFixed(1), +g.pos.z.toFixed(1)] }; });
  // 2. quiz: wrong then right, XP must not drop
  res.quiz = await page.evaluate(async () => {
    const g = __mq3d; const xp0 = g.progress.xp; const q = g.gateQuestion(g.st.keeper.ask, 'clock'); g.hud.openDialogue('Keeper', ['Hello'], () => {}, q); g.advanceDialogue(); await new Promise(r => setTimeout(r, 200));
    const opts = [...document.querySelectorAll('.mq-dq-opt')]; const wrong = opts.findIndex((_, i) => i !== q.riddle.answer);
    opts[wrong].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 100));
    const afterWrong = { xp: g.progress.xp, wrongMarked: document.querySelectorAll('.mq-wrong').length, feedback: document.querySelector('.mq-dq-fb')?.textContent.slice(0, 90), rightStillEnabled: !document.querySelectorAll('.mq-dq-opt')[q.riddle.answer].disabled };
    document.querySelectorAll('.mq-dq-opt')[q.riddle.answer].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 100));
    return { xp0, afterWrong, solvedFb: document.querySelector('.mq-dq-fb')?.textContent.slice(0, 70), xpAfterRight: g.progress.xp };
  });
  await page.evaluate(() => { __mq3d.advanceDialogue(); __mq3d.advanceDialogue(); });
  // 3. ring the ebb then the flood song
  res.bells = await page.evaluate(async () => {
    const g = __mq3d; const out = {}; const ring = async (ids) => { for (const id of ids) { g.ringCool = 0; g.ringBell(id); __step(40); } };
    out.xp0 = g.progress.xp;
    await ring(['wave', 'shell', 'star']); out.afterEbb = { tide: g.shore.tide, badge: document.querySelector('.mq-q-tide')?.textContent, xp: g.progress.xp };
    await ring(['star', 'shell', 'wave']); out.afterFlood = { tide: g.shore.tide, badge: document.querySelector('.mq-q-tide')?.textContent, xp: g.progress.xp, causeway: g.shoreWorld ? true : false, saved: JSON.parse(localStorage.getItem('mindquest.shore.v1') || 'null')?.tide };
    return out;
  });
  res.beforeReload = await page.evaluate(() => ({ shore: JSON.parse(localStorage.getItem('mindquest.shore.v1')), xp: JSON.parse(localStorage.getItem('mindquest.progress.v1')).xp }));
  await page.reload(); await page.waitForFunction(() => window.__mq3d); await page.waitForTimeout(1500);
  res.afterReload = await page.evaluate(() => { const g = __mq3d; return { area: g.area, xp: g.progress.xp, shoreTide: g.shore.tide, shoreKeys: Object.keys(g.shore).slice(0, 12) }; });
  // 4. back to woods and into the Hollow via setArea (saves must survive area changes)
  res.areas = await page.evaluate(async () => { const g = __mq3d; const seq = []; for (const a of ['hollow', 'shore', 'woods']) { g.setArea(a); await new Promise(r => setTimeout(r, 300)); seq.push(g.area); } return seq; });
  res.logs = logs; fs.writeFileSync('flow.json', JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1)); await browser.close();
})();
