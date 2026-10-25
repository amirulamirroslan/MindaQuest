import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, has_touch=True, is_mobile=True)
    page = ctx.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL + '?debug&renderer=canvas', wait_until='load'); page.wait_for_function('() => !!window.__game', timeout=20000); page.wait_for_timeout(1200)
    # tap BEGIN ADVENTURE for real
    pos = page.evaluate("() => { const s = window.__game.scene.getScene('MainMenuScene'); const b = s.children.list.find(o => o.type === 'Container'); const cam = s.cameras.main; const sc = window.__game.scale; const r = document.querySelector('canvas').getBoundingClientRect(); const px = (b.x - cam.worldView.x) * cam.zoom, py = (b.y - cam.worldView.y) * cam.zoom; return [r.left + px / sc.displayScale.x, r.top + py / sc.displayScale.y]; }")
    page.touchscreen.tap(*pos); page.wait_for_function('() => !!window.__mq', timeout=30000); page.wait_for_timeout(1500)
    def css(obj_expr):
        return page.evaluate("() => { const s = window.__mq, r = window.__mq.scale.displayScale; const o = " + obj_expr + "; return [o.x / r.x, o.y / r.y]; }")
    print('pause tap target css', css('s.hud.pause'), 'stick', css('s.touch.stickBase'), 'use', css('s.touch.actionButton'))
    # tap pause button
    page.touchscreen.tap(*css('s.hud.pause')); page.wait_for_timeout(700)
    print('paused via tap:', page.evaluate("() => window.__game.scene.isActive('PauseScene')"))
    page.screenshot(path=f'{OUT}/flow-pause.png')
    # tap RESUME EXPLORING (first button): find via scene
    rp = page.evaluate("() => { const s = window.__game.scene.getScene('PauseScene'); const root = s.children.list.find(o => o.type === 'Container'); const btn = root.list.find(o => o.type === 'Rectangle'); const m = root.getWorldTransformMatrix(); const pt = m.transformPoint(btn.x, btn.y); const r = window.__mq.scale.displayScale; return [pt.x / r.x, pt.y / r.y]; }")
    page.touchscreen.tap(*rp); page.wait_for_timeout(700)
    print('resumed via tap:', not page.evaluate("() => window.__game.scene.isActive('PauseScene')") and not page.evaluate("() => window.__game.scene.isPaused('WorldScene')"))
    # walk next to Lina and talk
    page.evaluate("() => { const s = window.__mq; s.player.body.reset(640, 690); }"); page.wait_for_timeout(1200)
    page.screenshot(path=f'{OUT}/flow-prompt.png')
    print('prompt text:', page.evaluate("() => window.__mq.hud.floating.visible ? 'floating shown' : (window.__mq.hud.docked.visible ? 'docked' : 'none')"))
    page.touchscreen.tap(*css('s.touch.actionButton')); page.wait_for_timeout(700)
    print('dialogue open:', page.evaluate("() => window.__mq.dialogue.open"), 'stage:', page.evaluate("() => window.__mq.quest.stage"))
    page.screenshot(path=f'{OUT}/flow-dialogue.png')
    for _ in range(6):
        page.touchscreen.tap(195, 780); page.wait_for_timeout(350)
    print('dialogue closed:', not page.evaluate("() => window.__mq.dialogue.open"), 'stage:', page.evaluate("() => window.__mq.quest.stage"))
    # collect a timber with the USE button
    t = page.evaluate("() => { const s = window.__mq; const [id, spr] = [...s.timberSprites.entries()][0]; return [spr.getData('worldX'), spr.getData('worldY')]; }")
    page.evaluate("([x,y]) => window.__mq.player.body.reset(x - 20, y)", t); page.wait_for_timeout(900)
    page.screenshot(path=f'{OUT}/flow-timber-prompt.png')
    page.touchscreen.tap(*css('s.touch.actionButton')); page.wait_for_timeout(700)
    print('timber:', page.evaluate("() => window.__mq.quest.timberCount"))
    page.screenshot(path=f'{OUT}/flow-toast.png')
    print('errors:', errors)
    b.close()
