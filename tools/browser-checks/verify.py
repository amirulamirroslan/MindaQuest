import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
results = []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name, detail)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, has_touch=True, is_mobile=True)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL + '?debug&renderer=canvas', wait_until='load'); page.wait_for_function('() => !!window.__game', timeout=20000); page.wait_for_timeout(1200)
    page.evaluate("() => window.__game.scene.start('WorldScene')"); page.wait_for_function('() => !!window.__mq', timeout=30000); page.wait_for_timeout(800)
    # take manual control of time
    page.evaluate("() => { window.__game.loop.stop(); }")
    JS_STEP = """([dirx, diry, frames, delta]) => { const g = window.__game, s = window.__mq; s.touch.enabled; s.touch.direction = {x: dirx, y: diry};
      s.touch.pointerId = 0; const ptr = s.input.manager.pointers[0]; ptr.isDown = true;  // finger held
      const x0 = s.player.x, y0 = s.player.y; let t = 100000;
      for (let i = 0; i < frames; i++) { t += delta; g.step(t, delta); }
      const out = { dx: s.player.x - x0, dy: s.player.y - y0, x: s.player.x, y: s.player.y };
      s.touch.direction = {x:0,y:0}; s.touch.pointerId = null; return out; }"""
    RESET = "() => { const s = window.__mq; s.player.body.reset(426, 278); s.player.body.setVelocity(0,0); s.lastValid = {x:426,y:278}; }"
    # --- 1. speed is frame-rate independent (1 simulated second at several rates)
    dists = {}
    for fps in (30, 60, 90, 120, 144):
        page.evaluate(RESET); page.evaluate("([a,b,c,d]) => 0", [0,0,0,0])
        r = page.evaluate(JS_STEP, [0, 1, fps, 1000 / fps]); dists[fps] = (r['dx'] ** 2 + r['dy'] ** 2) ** 0.5
    ref = dists[60]
    check('ground distance after 1s identical at 30/60/90/120/144 fps', all(abs(d - ref) / ref < 0.03 for d in dists.values()), json.dumps({k: round(v, 1) for k, v in dists.items()}))
    check('ground speed is ~170 u/s (WALK_SPEED)', abs(ref - 170) < 6, f'{ref:.1f}')
    # --- 2. hitch / tab-resume: a 5 s frame cannot teleport the hero
    page.evaluate(RESET); r = page.evaluate(JS_STEP, [0, 1, 1, 5000]); jump = (r['dx'] ** 2 + r['dy'] ** 2) ** 0.5
    check('single 5000 ms frame moves at most one clamped (<=50 ms) step', jump <= 170 * 0.06, f'{jump:.2f} units')
    # --- 3. diagonals are not faster (all 8 directions)
    best = None
    for start in [(300, 400), (520, 560), (250, 250), (640, 300), (480, 700)]:
        speeds = []
        for d in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)]:
            page.evaluate("([x,y]) => { const s = window.__mq; s.player.body.reset(x, y); s.lastValid = {x,y}; }", list(start))
            r = page.evaluate(JS_STEP, [d[0], d[1], 12, 1000/60]); speeds.append((r['dx'] ** 2 + r['dy'] ** 2) ** 0.5 / (11/60))
        if best is None or max(speeds) - min(speeds) < max(best) - min(best): best = speeds
    speeds = best
    check('ground speed equal in all 8 directions (±3%)', max(speeds) - min(speeds) < 0.03 * max(speeds), json.dumps([round(v) for v in speeds]))
    # --- 4. river collision: walk into the river from the west for 10 s at various frame rates
    JS_RIVER = """([fps]) => { const s = window.__mq, g = window.__game; const c = (y) => 960 + Math.sin((y-800)/180)*70 + Math.sin(y/97)*20;
      const half = (y) => 84 + Math.sin(y/122)*8; const bridge = (x,y) => y >= 736 && y <= 864 && Math.abs(x - c(800)) <= 158;
      s.player.body.reset(700, 450); s.lastValid = {x:700,y:450}; let t = 200000, worst = 1e9;
      s.touch.pointerId = 0; s.input.manager.pointers[0].isDown = true; s.touch.direction = {x: 1, y: 0.2};
      for (let i = 0; i < fps * 10; i++) { t += 1000/fps; g.step(t, 1000/fps); const b = s.player.body;
        for (const [px, py] of [[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]]) { if (!bridge(px,py)) worst = Math.min(worst, Math.abs(px - c(py)) - half(py)); } }
      s.touch.direction = {x:0,y:0}; s.touch.pointerId = null; return { worst, x: s.player.x, y: s.player.y }; }"""
    for fps in (30, 60, 144):
        r = page.evaluate(JS_RIVER, [fps]); check(f'feet never enter the river at {fps} fps (min clearance >= -0.5)', r['worst'] > -0.5, f"clearance {r['worst']:.2f}")
    # --- 5. broken bridge blocks, repaired bridge opens
    r = page.evaluate("""() => { const s = window.__mq, g = window.__game; s.player.body.reset(830, 800); s.lastValid = {x:830,y:800}; let t = 300000;
      s.touch.pointerId = 0; s.input.manager.pointers[0].isDown = true; s.touch.direction = {x: 1, y: 0.0};
      for (let i = 0; i < 240; i++) { t += 16.7; g.step(t, 16.7); } const x = s.player.x; s.touch.direction={x:0,y:0}; s.touch.pointerId=null; return { x, center: 960 + Math.sin(0)*70 + Math.sin(800/97)*20 }; }""")
    check('broken bridge stops the hero before the gap', r['x'] < r['center'] - 60, f"x={r['x']:.1f} (bridge centre {r['center']:.1f})")
    # --- 6. touch released outside / lost -> hero stops
    r = page.evaluate("""() => { const s = window.__mq, g = window.__game; s.player.body.reset(426, 278); let t = 400000;
      s.touch.pointerId = 0; s.input.manager.pointers[0].isDown = true; s.touch.direction = {x: 0, y: 1};
      for (let i = 0; i < 5; i++) { t += 16.7; g.step(t, 16.7); }
      s.input.manager.pointers[0].isDown = false;           // finger vanished without a pointerup (system gesture)
      for (let i = 0; i < 2; i++) { t += 16.7; g.step(t, 16.7); }
      const y1 = s.player.y; for (let i = 0; i < 20; i++) { t += 16.7; g.step(t, 16.7); }
      return { moved: s.player.y - y1, dir: s.touch.direction, vel: [s.player.body.velocity.x, s.player.body.velocity.y] }; }""")
    check('hero stops when the touch is lost without a pointerup', abs(r['moved']) < 0.01 and r['dir']['x'] == 0 and r['dir']['y'] == 0, json.dumps(r))
    # --- 7. hidden tab: input released and game paused
    page.evaluate("() => { const s = window.__mq; s.touch.direction = {x:1,y:0}; window.__game.events.emit('hidden'); window.__game.step(500000, 16.7); }")
    state = page.evaluate("() => ({ worldPaused: window.__game.scene.isPaused('WorldScene'), pauseOn: window.__game.scene.isActive('PauseScene'), dir: window.__mq.touch.direction })")
    check('hiding the page pauses the world and releases input', state['worldPaused'] and state['pauseOn'] and state['dir'] == {'x': 0, 'y': 0}, json.dumps(state))
    page.evaluate("() => { window.__game.scene.stop('PauseScene'); window.__game.scene.resume('WorldScene'); }")
    # --- 8. rotation / resize
    page.evaluate("() => window.__game.loop.start(performance.now())") if False else None
    def layout():
        return page.evaluate("() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), s = window.__mq, g = window.__game; return { css: [Math.round(r.width), Math.round(r.height)], px: [c.width, c.height], zoom: s.cameras.main.zoom, ui: [s.uiCam.width, s.uiCam.height], main: [s.cameras.main.width, s.cameras.main.height], doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] }; }")
    for size in [(844, 390), (390, 844), (360, 740), (740, 360), (1280, 720), (768, 1024), (320, 568)]:
        page.set_viewport_size({'width': size[0], 'height': size[1]}); page.wait_for_timeout(500)
        # nudge a frame so queued RAF resize runs even though the loop is stopped
        l = layout(); ok = l['css'] == list(size) and l['main'] == l['px'] and l['ui'] == l['px'] and l['doc'][0] <= size[0] and l['doc'][1] <= size[1]
        check(f'canvas fills {size[0]}x{size[1]} exactly, both cameras resized, no page overflow', ok, json.dumps(l))
    check('no page errors / console errors', not errors, '; '.join(errors[:3]))
    b.close()
print(f"\n{sum(1 for r in results if r[1])}/{len(results)} checks passed")
sys.exit(0 if all(r[1] for r in results) else 1)
