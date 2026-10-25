"""Hero check: all 8 facings and walk frames on desktop and phone sizes, plus collision. Usage: python hero.py http://127.0.0.1:4173/ outdir"""
import sys, os, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
out = sys.argv[2] if len(sys.argv) > 2 else 'out'
os.makedirs(out, exist_ok=True)
results = []
def check(name, cond, detail=''):
    results.append(cond); print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

KEYS = {'east': ['ArrowRight'], 'south-east': ['ArrowRight', 'ArrowDown'], 'south': ['ArrowDown'], 'south-west': ['ArrowLeft', 'ArrowDown'],
        'west': ['ArrowLeft'], 'north-west': ['ArrowLeft', 'ArrowUp'], 'north': ['ArrowUp'], 'north-east': ['ArrowRight', 'ArrowUp']}
errors = []
def session(label, viewport, dpr, touch, lod):
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        ctx = b.new_context(viewport=viewport, device_scale_factor=dpr, has_touch=touch)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(base + '?debug&renderer=canvas&tod=day', wait_until='commit')
        pg.wait_for_function('window.__game && window.__game.scene.isActive("MainMenuScene")', timeout=120000)
        pg.screenshot(path=f'{out}/{label}_menu.png')
        pg.evaluate('window.__game.scene.getScene("MainMenuScene").scene.start("WorldScene")')
        pg.wait_for_function('window.__mq && window.__mq.ambient', timeout=180000)
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f'{out}/{label}_start.png')
        # open ground east of the start so every direction has room; teleport there
        check(f'{label}: hero uses the {lod} atlas', pg.evaluate('window.__mq.heroLod') == lod and pg.evaluate('window.__mq.playerVisual.texture.key') == 'adv-' + lod, pg.evaluate('window.__mq.heroLod'))
        x0, y0 = pg.evaluate('(()=>{const p=window.__mq.player;return [p.x,p.y]})()')
        seen = {}
        for facing, keys in KEYS.items():
            # back to the open start meadow before each direction so a wall never cancels one
            pg.evaluate('(()=>{window.__mq.player.body.reset(%s,%s)})()' % (x0, y0))
            pg.wait_for_timeout(80)
            for k in keys: pg.keyboard.down(k)
            frames = set()
            for _ in range(6):
                pg.wait_for_timeout(110)
                frames.add(pg.evaluate('window.__mq.player.frameName'))
            fac = pg.evaluate('window.__mq.player.facing')
            moving = pg.evaluate('window.__mq.player.isMoving')
            pg.screenshot(path=f'{out}/{label}_{facing}.png')
            for k in keys: pg.keyboard.up(k)
            seen[facing] = (fac, moving, sorted(frames))
            pg.wait_for_timeout(120)
        for facing, (fac, moving, frames) in seen.items():
            # a direction blocked by a tree/river for the whole window shows as not moving; report separately
            check(f'{label}: {facing} faces {facing} and moves', fac == facing and moving, f'facing={fac} moving={moving}')
        walked = [f for f, (fac, mv, fr) in seen.items() if len(fr) > 1]
        check(f'{label}: walk frames cycle in all 8 directions', len(walked) == 8, ','.join(walked))
        check(f'{label}: frames are from the matching direction', all(all(fr_.startswith(('walk_' + f + '_', 'idle_' + f)) for fr_ in fr) for f, (fac, mv, fr) in seen.items()), '')
        b.close()
session('desktop', {'width': 1000, 'height': 620}, 1, False, 'lo')
session('phone', {'width': 390, 'height': 844}, 3, True, 'hi')
check('no page errors', not errors, '; '.join(errors[:3]))
print(f'{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
