"""v0.9 checks: living world, game feel and sound. Usage: python alive.py http://127.0.0.1:4173/ outdir"""
import sys, json
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
out = sys.argv[2] if len(sys.argv) > 2 else 'out'
import os; os.makedirs(out, exist_ok=True)
errors, results = [], []

def check(name, ok, detail=''):
    results.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))

def start(page, query):
    page.goto(f'{base}?debug&renderer=canvas&{query}')
    page.wait_for_function('window.__game && window.__game.scene.isActive("MainMenuScene")', timeout=20000)
    # start through the scene so the check does not depend on layout
    page.evaluate('window.__game.scene.getScene("MainMenuScene").scene.start("WorldScene")')
    page.wait_for_function('window.__mq && window.__mq.ambient', timeout=20000)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--no-sandbox'])
    page = browser.new_page(viewport={'width': 1000, 'height': 620})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    start(page, 'tod=day')
    page.wait_for_timeout(2500)
    stats = page.evaluate('window.__mq.ambient.stats()')
    print(json.dumps(stats))
    check('plants registered for swaying', stats['swaying'] > 100, stats['swaying'])
    check('leaves drifting in view', stats['leaves'] >= 8, stats['leaves'])
    check('butterflies visible by day', stats['butterflies'] >= 1, stats['butterflies'])
    check('no fireflies by day', stats['fireflies'] == 0)
    rot = page.evaluate('(() => { const s = window.__mq.ambient.swayers.filter(s => s.obj.rotation !== 0); return s.length; })()')
    check('plants actually leaning', rot > 20, rot)
    page.evaluate('window.__mq.ambient.forceFlock(); window.__mq.ambient.forceLeap()')
    page.wait_for_timeout(1200)
    s2 = page.evaluate('window.__mq.ambient.stats()')
    check('a bird flock appears on demand', s2['birds'] >= 2, s2['birds'])
    page.screenshot(path=f'{out}/day.png')
    check('audio engine present', page.evaluate('!!window.__mqAudio && window.__mqAudio.available'))
    state = page.evaluate('window.__mqAudio.ctx.state')
    check('audio context running', state == 'running', state)
    page.wait_for_timeout(1500)
    lvl = page.evaluate('window.__mqAudio.level()')
    check('music/ambience audible in the mix', lvl > 0.002, f'rms={lvl:.4f}')
    # footsteps + pickup
    page.keyboard.down('ArrowDown'); page.wait_for_timeout(700); page.keyboard.up('ArrowDown')
    page.evaluate('window.__mqAudio.pickup(5); window.__mq.fx.sparkleBurst(window.__mq.playerVisual.x, window.__mq.playerVisual.y-20, 10)')
    page.wait_for_timeout(120)
    page.screenshot(path=f'{out}/pickup.png')
    page.evaluate('window.__mqAudio.setMuted(true)'); page.wait_for_timeout(400)
    m = page.evaluate('window.__mqAudio.level()')
    check('mute silences the mix', m < 0.0005, f'rms={m:.5f}')
    page.evaluate('window.__mqAudio.setMuted(false)')
    for t in ['golden', 'dusk', 'night', 'dawn']:
        start(page, f'tod={t}'); page.wait_for_timeout(2200); page.screenshot(path=f'{out}/{t}.png')
        if t == 'night':
            st = page.evaluate('window.__mq.ambient.stats()')
            check('fireflies glow at night', st['fireflies'] >= 4, st['fireflies'])
            check('no butterflies at night', st['butterflies'] == 0, st['butterflies'])
    check('no console errors', not errors, '; '.join(errors[:3]))
    browser.close()
print(f'{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
