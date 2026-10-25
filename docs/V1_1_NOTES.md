# v1.1 notes: customisable hero (wardrobe)

## What you can do
Title screen -> **CUSTOMISE HERO**. Pick a part, tap a colour, and watch the real sprite turn around (tap it, or use the arrows) or walk (WALK). **SURPRISE** picks a random outfit, **RESET** returns to the pack's own look, **DONE** (or Esc) saves and goes back. The choice is stored on the device (`mindaquest.outfit.v1`, eight small numbers) and the hero in the world, and on the title screen, wears it.

Eight parts, 8-10 colours each (index 0 is always the pack's original): **hood & hair**, **tunic**, **trousers**, **boots**, **pack & belt**, **skin**, **blade** (sword and buckle), **eyes**. Lina keeps her teal look and is not affected.

## How it works (and why this is not "real" layers)
The Adventurer pack ships one flattened image per frame. There is no shirt layer or boot layer to swap, and no way to add new clothes without drawing them. What the art does have is a disciplined palette, so:
1. `art/partMask.ts` labels every opaque pixel of the atlas with a part, at boot, from colour (hue/saturation/lightness) plus position in the figure. Hood/hair and tunic are the same ochre, so they are split by height (`HOOD_SPLIT`, 41% down the figure); boots and pack/belt are the same leather, split by `BOOT_SPLIT` (80%). Outline pixels are never part of anything, so the dark contour stays.
2. `art/parts.ts` re-tints each part on its own (`recolourParts`), keeping every pixel's lightness relationship so the pack's shading survives.
3. `art/hero.ts` keeps the pack's atlas untouched as `adv-src` and draws the game from a canvas copy (`adv-hi`, plus the half-size `adv-lo`) with the outfit applied. Frame names are unchanged, so animation, facing, LOD and collision code did not change.
4. The wardrobe only recolours the frames it can show (8 idle frames, plus the walk frames of the facing being previewed) on each tap, and recolours all 64 frames once when you press DONE.

No derived image file is stored or shipped: the mask and the recoloured atlas exist only in memory (this stays inside the pack's licence, see `ASSET-LICENSES.md`).

## Known limits
- **Recolour only.** You cannot change the *shape* of anything: no different hat, no short sleeves, no other sword, no bare head. Those need new layered art (see below).
- **Hood and hair are one part** because the pack paints them in the same colour.
- A few pixels of skin shading and leather sit in grey areas of the palette and are left unclassified, so a very dark skin tone can show a faint lighter fringe on some frames. Tune the thresholds in `classifyPixel` if it bothers you; the unit tests pin the main colours.
- Not tested on a physical phone: the first outfit apply at boot recolours the whole 1632x1632 atlas once, which should be quick but has only been timed in desktop and software-rendered headless Chromium.

## The path to true customisation (hats, other tunics, weapons)
Only layered art can do this. Two realistic routes:
1. **A layered pack drawn to a shared 8-direction grid** (body + separate hair, hat, tunic, trousers, boots, weapon layers, same frame size and anchor). Layer-by-layer swapping then drops into this code: replace `adv-hi` with a composite of chosen layers per frame. Recolouring in this release would carry over to each layer.
2. **Author layers for this sprite.** Each item is drawn once per facing/frame (64 frames per item) on top of a bald/unclothed base. That is a lot of pixel art; a cheaper start is a few **overlay items** (a hat, a cape, a different sword) drawn on the 8 idle frames and the walk cycle.

Either way, `PART_KEYS`/`PARTS` in `art/parts.ts` is where new parts and options would be added.

## Checks
- `npm test` (262 tests, 38 new: part classification, recolour maths, storage, wardrobe layout and finger-sized targets), `npm run build`.
- `tools/browser-checks/wardrobe.py`: menu button opens the wardrobe, customising recolours the sprite without changing its silhouette, DONE saves, a reload keeps the colours (including walk frames), the world hero uses them; desktop, phone portrait and phone landscape, no page errors.
