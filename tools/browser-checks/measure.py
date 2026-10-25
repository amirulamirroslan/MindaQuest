import sys, json, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; TOUCH = (len(sys.argv) > 3 and sys.argv[3] == 'touch')
SIZES = [('phone-portrait', 390, 844, 3), ('phone-landscape', 844, 390, 3), ('desktop', 1280, 720, 1)]
import os; os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for name, w, h, dpr in SIZES:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=(name != 'desktop'), is_mobile=(name != 'desktop'))
        page = ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(m.text) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        page.goto(URL + '?debug&renderer=canvas', wait_until='load')
        page.wait_for_selector('canvas', timeout=15000); page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT}/{name}-menu.png')
        info = page.evaluate("""() => { const c=document.querySelector('canvas'); const r=c.getBoundingClientRect(); return {cw:c.width,ch:c.height,left:r.left,top:r.top,rw:r.width,rh:r.height}; }""")
        # click BEGIN ADVENTURE: design-space button. Try scene helper if present, else fall back to geometry.
        started = page.evaluate("() => { const g = window.__game; if (!g) return false; g.scene.start('WorldScene'); return true; }")
        if not started:
            gx = info['cw'] / 2; gy = 339
            tx, ty = info['left'] + gx / info['cw'] * info['rw'], info['top'] + gy / info['ch'] * info['rh']
            (page.touchscreen.tap(tx, ty) if name != 'desktop' else page.mouse.click(tx, ty))
        page.wait_for_function("() => !!window.__mq", timeout=20000); page.wait_for_timeout(2500)
        page.screenshot(path=f'{OUT}/{name}-world.png')
        page.evaluate("""() => { const g = window.__mq.game; const ev = g.events; const acc = {logic:0, render:0, frames:0}; let a=0,b=0;
          ev.on('prestep', () => { a = performance.now(); }); ev.on('poststep', () => { acc.logic += performance.now() - a; acc.frames++; });
          ev.on('prerender', () => { b = performance.now(); }); ev.on('postrender', () => { acc.render += performance.now() - b; });
          window.__acc = acc; }""")
        stats = page.evaluate("""() => { const s = window.__mq; const g = s.game;
          return { children: s.children.list.length, tweens: s.tweens.getTweens().length, colliders: s.physics.world.colliders.length,
            statics: s.physics.world.staticBodies.size,
            scale: { w: s.scale.width, h: s.scale.height, dx: +s.scale.displayScale.x.toFixed(3), zoom: s.cameras.main.zoom, canvasCss: [g.canvas.clientWidth, g.canvas.clientHeight] },
            renderer: g.renderer.type === 2 ? 'WEBGL' : 'CANVAS' }; }""")
        page.wait_for_timeout(4000)
        a = page.evaluate("() => window.__acc")
        stats['logicMsPerFrame'] = round(a['logic'] / max(a['frames'], 1), 3)
        stats['renderMsPerFrame(canvas-sw)'] = round(a['render'] / max(a['frames'], 1), 2)
        stats['logs'] = logs[:6]
        print(name, json.dumps(stats))
        ctx.close()
    b.close()
