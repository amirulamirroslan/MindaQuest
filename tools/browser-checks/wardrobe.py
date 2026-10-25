"""Wardrobe check: menu button -> wardrobe -> recolour parts -> Done -> saved -> reload -> hero in the world is customised.
Usage: python wardrobe.py http://127.0.0.1:4173/ outdir"""
import sys, os, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
out = sys.argv[2] if len(sys.argv) > 2 else 'out'
os.makedirs(out, exist_ok=True)
results, errors = [], []
def check(name, cond, detail=''):
    results.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)

# Pixel stats of one atlas frame on the hi canvas texture: dominant colours per region of the figure.
FRAME_PIXELS = '''(name) => { const t = window.__game.textures.get("adv-hi"); const f = t.get(name);
  const c = t.getSourceImage(); const d = c.getContext("2d").getImageData(f.cutX, f.cutY, f.width, f.height).data; return Array.from(d); }'''

def session(label, viewport, dpr, touch):
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        ctx = b.new_context(viewport=viewport, device_scale_factor=dpr, has_touch=touch)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto(base + '?debug&renderer=canvas&tod=day', wait_until='commit')
        pg.wait_for_function('window.__game && window.__game.scene.isActive("MainMenuScene")', timeout=120000)
        pg.wait_for_timeout(600)
        pg.screenshot(path=f'{out}/{label}_menu.png')
        base_pixels = pg.evaluate(FRAME_PIXELS, 'idle_south')

        # The menu button is wired to the wardrobe.
        clicked = pg.evaluate('''() => { const s = window.__game.scene.getScene("MainMenuScene");
          const b = s.children.list.find(o => o.type === "Container" && o.list.some(c => c.type === "Text" && c.text === "CUSTOMISE HERO"));
          if (!b) return false; b.list[0].emit("pointerdown"); return true; }''')
        check(f'{label}: menu has a CUSTOMISE HERO button', clicked)
        pg.wait_for_function('window.__game.scene.isActive("WardrobeScene")', timeout=20000)
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{out}/{label}_wardrobe_default.png')
        check(f'{label}: untouched wardrobe shows the pack colours', pg.evaluate(FRAME_PIXELS, 'idle_south') == base_pixels)

        sc = 'window.__game.scene.getScene("WardrobeScene")'
        picks = [('hood', 2), ('tunic', 4), ('trousers', 5), ('boots', 1), ('gear', 6), ('skin', 4), ('steel', 1), ('eyes', 1)]
        for part, idx in picks:
            pg.evaluate(f'(() => {{ const s = {sc}; s.part = "{part}"; s.refreshControls(); s.choose({idx}); }})()')
        pg.wait_for_timeout(1700)  # let the hero auto-turn
        pg.screenshot(path=f'{out}/{label}_wardrobe_custom.png')
        changed = pg.evaluate(FRAME_PIXELS, 'idle_south')
        diff = sum(1 for i in range(0, len(base_pixels), 4) if base_pixels[i:i+3] != changed[i:i+3] and base_pixels[i+3] > 0)
        opaque = sum(1 for i in range(3, len(base_pixels), 4) if base_pixels[i] > 0)
        check(f'{label}: customising recolours the sprite', diff > 0.55 * opaque, f'{diff}/{opaque} px changed')
        same_alpha = all(base_pixels[i+3] == changed[i+3] for i in range(0, len(base_pixels), 4))
        check(f'{label}: silhouette (alpha) is unchanged', same_alpha)
        pg.evaluate(f'(() => {{ const s = {sc}; s.toggleWalk(); }})()')
        pg.wait_for_timeout(500); pg.screenshot(path=f'{out}/{label}_wardrobe_walk.png')
        pg.evaluate(f'(() => {{ const s = {sc}; s.toggleWalk(); s.part = "tunic"; s.refreshControls(); }})()')

        # Done saves, returns to the menu and leaves every frame (not just the previewed ones) in the new colours.
        pg.evaluate(f'(() => {{ {sc}.finish(); }})()')
        pg.wait_for_function('window.__game.scene.isActive("MainMenuScene")', timeout=20000)
        saved = pg.evaluate('localStorage.getItem("mindaquest.outfit.v1")')
        check(f'{label}: outfit saved on the device', saved and json.loads(saved).get('tunic') == 4, saved)
        walk_after = pg.evaluate(FRAME_PIXELS, 'walk_east_04')
        pg.wait_for_timeout(400); pg.screenshot(path=f'{out}/{label}_menu_custom.png')
        pg.reload(wait_until='commit')
        pg.wait_for_function('window.__game && window.__game.scene.isActive("MainMenuScene")', timeout=120000)
        check(f'{label}: customised walk frame survives a reload', pg.evaluate(FRAME_PIXELS, 'walk_east_04') == walk_after)
        if label == 'desktop':  # the world start is slow in software-rendered Chromium, so only the first session does it
            pg.evaluate('window.__game.scene.getScene("MainMenuScene").scene.start("WorldScene")')
            pg.wait_for_function('window.__mq && window.__mq.ambient', timeout=180000)
            pg.wait_for_timeout(1000)
            pg.screenshot(path=f'{out}/{label}_world_custom.png')
            check(f'{label}: world hero uses the customised atlas', pg.evaluate('window.__mq.playerVisual.texture.key') in ('adv-hi', 'adv-lo'))
        b.close()

if '--phones-only' not in sys.argv: session('desktop', {'width': 1280, 'height': 720}, 1, False)
session('phone', {'width': 390, 'height': 844}, 2, True)
session('phone-land', {'width': 844, 'height': 390}, 2, True)
real = [e for e in errors if 'GPU stall' not in e and 'WebGL' not in e]
check('no page errors', not real, '; '.join(real[:3]))
print(f'{sum(results)}/{len(results)} passed')
sys.exit(0 if all(results) else 1)
