# MindQuest v2.8 — premium chibi hero + modular cosmetics

Read this first. It records what was built on top of v2.6 (`MindaQuest-v2_6-graphics-detail.zip`), why, how it was verified, and what is NOT done.

> **Provenance note.** The brief referred to `MindaQuest-v2_7-cosmetics-foundation.zip` and "initial cosmetics-system code" from a previous session. Only the v2.6 zip was supplied, and it contains no cosmetics code and no v2.7 handoff documents (only `V2_4_STYLE_HANDOFF.md` and `V2_6_NOTES.md`). The cosmetics system here was therefore written from scratch against the real v2.6 source. If a v2.7 zip exists elsewhere, diff it against `src/game3d/cosmetics/` before merging.

## 1. The style (the permanent look of the hero)

Premium stylised 3D **chibi** fantasy RPG hero, ages 6–15. Measured from the shipped asset, not guessed:

| Property | Value |
|---|---|
| Proportion | about 2.1 heads tall (measured on the bind pose: the head, hair included, is 47–51% of the figure's height), big readable face, chunky hands and boots |
| Surface | flat, hand-painted colour atlases (no PBR realism), gentle rim light from `render/stylize.ts` (`withRim`) so the hero separates from the grass |
| Shading | the pack's baked-in light/dark palette stripes; recolouring preserves each pixel's lightness (`render/chibi/palette.ts`) |
| Scale | `CHIBI_SCALE = 0.57`: the kit is 2.19 units tall natively for the default ranger (2.31 for the knight), so about 1.25 m (1.32 m knight), matching the old hero's ~1.25 m so camera framing, doorways and collisions are unchanged |
| Face | painted into the head mesh; expressions are not animated (the old rig's face-swap system does not apply) |
| Rule for new items | must come from the shared kit skeleton, use one of the four colour atlases (or a code-made prop), and survive the recolour rules below |

## 2. What changed

* **Character**: `public/assets/chibi/chibi_kit.glb` (1.3 MB) — KayKit "Adventurers" (CC0). Four characters' heads, bodies, arms, legs, hats, helmet, capes, weapons and shields on ONE shared skeleton, with 45 clips. Built reproducibly by `tools/chibi-kit/build-chibi-kit.mjs`. Licence evidence: `ASSET-LICENSES.md`, `public/assets/chibi/LICENSE.txt`.
* **Rig**: `src/game3d/render/chibi/ChibiRig.ts` (parts, per-part recoloured materials, code-made props), `chibiAnim.ts` (clip driving), `chibiClips.ts` (weapon→clip tables, timing, locomotion), `palette.ts` (recolour maths).
* **Fallback chain** in `render/HeroModel.ts`: chibi kit → previous rigged hero (`hero_rig.glb` + code-built body) → simple procedural hero. The old code is untouched, so a failed load degrades instead of breaking.
* **Cosmetics**: `src/game3d/cosmetics/` — `catalog.ts` (46 items as data), `inventory.ts` (ownership, equip, persistence, migration), `loadout.ts` (what to show).
* **UI**: `ui/CosmeticsPanel.ts` replaces `WardrobePanel.ts` (deleted). New CSS block at the end of `ui/hud3d.css`. New EN/MS strings in `data/woodsText.ts` (`cosmetics`).
* **Game3D.ts**: cosmetics state, ownership from level + quest unlocks, preview zoom, "new things to wear" toast on level-up, re-validation on Start Over.

## 3. How customisation works

* **Slots**: hair (a whole head), clothes/armour, trousers, hats/helmets, capes, main-hand weapon, off hand (shield, spare weapon, book, lantern). **Shoes** are colour-only (see limits).
* **Colour**: the original eight swatch parts (hair+hood, tunic, trousers, boots, belt, skin, steel, eyes) still work and still save to `mindaquest.outfit.v1`, plus a cape tint and a hat tint. Swatch 0 means "the item's own colours". Each atlas pixel is classified into a slot by colour + mesh kind (skin = warm light low-saturation, leather = saturated brown, metal = very low saturation, eyes = dark blue-grey) and re-tinted keeping its lightness. Rules are in `palette.ts` and unit-tested against real palette colours.
* **Ownership**: free, hero level, quest reward, or `premium`. Free/level/quest ownership is *derived*, so it can never be lost. Premium items exist as data only and are never owned; nothing sells, charges or calls a server.
* **Compatibility rules**: a two-handed weapon (great sword, great axe, staff) hides the off-hand item; a one-handed weapon plus a spare weapon switches to the dual-wield attack; each weapon class picks its own attack clip and idle stance; the special move always uses the one-handed swing because the game already spins the body.
* **Persistence**: `mindquest.cosmetics.v2` = granted items, equipped ids, two tints. First run migrates `mindquest.equipment.v1` (head→hat, back→cape, hand→off hand). Legacy keys are never deleted, so a rollback to v2.6 still works.

## 4. Verified

See the final report in the chat for the exact commands and numbers. In short: 38 pre-existing test files / 362 tests still pass; 25 new tests; production build passes; the built game was run in headless Chromium (WebGL2 via SwiftShader) at desktop, phone portrait and phone landscape with zero console errors; persistence, legacy migration, start-over re-validation and equipping across all slots were exercised in that browser.

## 5. Known limits (honest)

* **Shoes are colour-only.** Boots are part of each leg mesh in the pack; splitting them reliably would leave seams. Shoe shape follows the trousers set.
* **Expressions are gone** on the chibi hero (faces are painted). The old rig's blink/hurt/happy faces remain only on the fallback.
* **Special-move body spin** reuses the old spin maths; the sword swoosh effect was kept. Walking speed vs foot planting: the clips are slow in-place cycles, so playback is sped up and capped (≤2.2× walk, ≤2.0× run); a little foot slide at sprint speed is accepted.
* **Item icons are emoji glyphs**, not 3D thumbnails.
* **Hair colour on pre-coloured heads** (hood, beard) recolours the whole non-skin area, which can look odd on the hooded head.
* **The Elder NPC and enemies are unchanged**; only the hero uses the kit.
* The headless browser here has no GPU: rendering was verified visually, but frame rate and phone performance were **not** measured on real devices.
* Clip durations and hit times in `chibiClips.ts` were measured once; if the GLB is rebuilt, re-run `node tools/chibi-kit/measure-clips.mjs` and the tests will tell you what drifted.

## 6. Rebuilding the asset

```
curl -L -o adv.zip https://codeload.github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/zip/refs/heads/main && unzip adv.zip
node tools/chibi-kit/build-chibi-kit.mjs <unzipped>/addons/kaykit_character_pack_adventures public/assets/chibi/chibi_kit.glb
node tools/chibi-kit/measure-clips.mjs
```

## 7. Not done / needs approval

* Real-money store, payments, accounts, server inventory: **not built, not approved**. `access: premium` items are placeholders.
* A shipped credits screen crediting Kay Lousberg (optional under CC0).
* More hairstyles/hats beyond the pack: needs new art or another vetted CC0/commercial pack.
