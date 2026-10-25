"""v0.9 game-feel check: walk, collect all timber, repair the bridge, cross. Usage: python feel.py http://127.0.0.1:4173/ outdir"""
import sys, os
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
out = sys.argv[2] if len(sys.argv) > 2 else 'out'
os.makedirs(out, exist_ok=True)
ok = []
def check(name, cond, detail=''):
    ok.append(cond); print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1000, 'height': 620})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(base + '?debug&renderer=canvas&tod=day', wait_until='commit')
    pg.wait_for_function('window.__game && window.__game.scene.isActive("MainMenuScene")', timeout=120000)
    pg.evaluate('window.__game.scene.getScene("MainMenuScene").scene.start("WorldScene")')
    pg.wait_for_function('window.__mq && window.__mq.ambient', timeout=180000)
    pg.wait_for_timeout(1500)
    # footsteps: count how many are triggered while walking
    pg.evaluate('window.__steps = 0; const a = window.__mq.audio, f = a.step.bind(a); a.step = (s, t) => { window.__steps++; f(s, t); }')
    pg.keyboard.down('ArrowDown'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{out}/walking.png'); pg.keyboard.up('ArrowDown')
    steps = pg.evaluate('window.__steps')
    check('footsteps play while walking', steps >= 3, steps)
    # pickup feedback through the real interaction path
    pg.evaluate("""(() => { const m = window.__mq; m.quest.start(); window.__pk = []; const a = m.audio, f = a.pickup.bind(a); a.pickup = (n, t) => { window.__pk.push(n); f(n, t); };
      const id = [...m.timberSprites.keys()][0], s = m.timberSprites.get(id);
      m.player.setPosition(s.getData('worldX'), s.getData('worldY')); m.player.body.reset(s.getData('worldX'), s.getData('worldY')); })()""")
    pg.wait_for_timeout(400)
    pg.keyboard.press('e'); pg.wait_for_timeout(150)
    pg.screenshot(path=f'{out}/pickup.png')
    check('timber pickup chime fires with the running count', pg.evaluate('window.__pk.length') == 1 and pg.evaluate('window.__pk[0]') == 1, pg.evaluate('JSON.stringify(window.__pk)'))
    # collect the rest and repair
    pg.evaluate("(() => { const m = window.__mq; for (const id of [...m.timberSprites.keys()]) m.quest.collect(id); m.timberSprites.forEach((s) => s.destroy()); m.timberSprites.clear(); m.refreshQuestHud(); })()")
    pg.evaluate("(() => { const m = window.__mq; window.__ev = []; for (const k of ['plank','splash','fanfare','reward']) { const a = m.audio, f = a[k].bind(a); a[k] = (...x) => { window.__ev.push(k); return f(...x); }; } const slot = m.bridgeSlots[0]; m.player.body.reset(slot.x - 90, slot.y); })()")
    pg.wait_for_timeout(1200)
    pg.keyboard.press('e')
    pg.wait_for_timeout(900); pg.screenshot(path=f'{out}/repair_mid.png')
    pg.wait_for_timeout(2600); pg.screenshot(path=f'{out}/repair_done.png')
    ev = pg.evaluate('window.__ev')
    check('every plank knocks and splashes as it lands', ev.count('plank') >= 4 and ev.count('splash') >= 4, f"plank={ev.count('plank')} splash={ev.count('splash')}")
    check('fanfare plays when the bridge is finished', 'fanfare' in ev)
    check('no console errors', not errors, '; '.join(errors[:3]))
    b.close()
print(f'{sum(ok)}/{len(ok)} checks passed')
sys.exit(0 if all(ok) else 1)
