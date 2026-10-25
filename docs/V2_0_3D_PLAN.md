# v2.0 plan: MindQuest becomes a full 3D adventure

## Assessment (what the code is today)
Phaser 3.90 + TypeScript + Vite, 2D isometric pixel art, ~7,100 lines, 262 unit tests. No 3D engine, no models, no skeleton animation, no combat.

## Keep / adapt / replace
| Area | Decision | Why |
|---|---|---|
| Vite + TypeScript + Vitest tooling, strict tsconfig, test style | **Keep** | Engine independent |
| Wardrobe data: `art/parts.ts`, `art/recolour.ts`, `systems/outfitStore.ts` (`mindaquest.outfit.v1`) | **Keep unchanged** | Saved outfits carry over; `systems/outfit3d.ts` maps the same eight swatch indices to 3D mesh-group colours |
| `WardrobeScene` UI | **Adapt** | Re-skin to preview the 3D hero (render-to-canvas) instead of the 2D sprite; the swatch UI and layout tests stay |
| Mobile viewport/safe-area/touch-stick maths (`viewport.ts`, `uiLayout.ts`, `touchStick.ts`, `responsive.ts`) | **Keep, extend** | DOM/screen maths; add attack/dodge/special buttons |
| HUD/DialogueBox/theme, audio engine, day-night maths, wind maths | **Adapt** | Draw as DOM/Three overlays; audio and time-of-day maths are engine free |
| Quest pattern (`forestQuest.ts`) | **Replace with `woodsQuest.ts`** | New quest; same pure-reducer style |
| Phaser scenes, Arcade physics, isometric.ts, painter.ts, 2D sprite atlas (`art/hero.ts`, `partMask.ts`) | **Replace** (kept in repo until the 3D slice is playable, then retired) | 2D-specific; do not fit a 3D scene |
| Renderer | **New: Three.js** (WebGL2), loaded only by the 3D entry | Smallest mainstream 3D engine, glTF support, good on phones, no editor lock-in |

## Assets that do not exist and what to do
- **3D hero model/rig/animations:** none. The Adventurer pack is flat 2D. Plan: a procedural low-poly "chibi" hero built from named mesh groups (hair, hood, tunic, trousers, boots, belt, pack, skin, blade, eyes) with code-driven animation (idle bob, walk/run limb swing, jump, slash, roll, spin) so the slice is playable with no downloads. Real glTF characters (CC0, e.g. Quaternius/Kenney) can replace it later: name meshes after `MeshGroup` and the wardrobe works unchanged.
- **World:** procedural low-poly terrain, trees, rocks, ruins, village gate, cave mouth, gate arch; no files.
- **New equipment shapes** (hats, capes, swords): a few procedural accessories first (`ACCESSORY_CATALOG`); real art later.

## Status (updated)
Playable slice done: Three.js scene, procedural hero, woods/village/ruins, follow camera with pull-in, keyboard/mouse/touch input, HUD, English + Bahasa Melayu text, enemies, boss, Moonlit Gate, saves. See `docs/V2_0_NOTES.md` for how to run it and what was and was not verified. Dependencies installed and pinned (`three@0.180.0`, `@types/three@0.180.0`).
Not done: 3D wardrobe preview, music/day-night in 3D, real models, learning puzzles, real-phone performance check.
