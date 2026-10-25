# v2.4 — Style target & HANDOFF (read this first)

Written 2026-10-20 so another AI/developer can continue without the chat history.

## Starting state (verified 2026-10-20)
- Project = MindaQuest v2.3 (`MindQuest-v2_3-graphics-upgrade.zip`), Vite + TypeScript + Phaser 3.90 + Three.js 0.180.
- `npm install` OK, `npm test` = 37 files / 347 tests pass, `npm run build` OK (chunk-size warning only).
- 2D game at `/` (Phaser) is unchanged and must keep working. 3D game at `/3d.html` (`src/game3d/`) is where the style work happens.
- Run: `npm install` → `npm run dev` → open `http://127.0.0.1:5173/3d.html` (`?debug` free camera, `?q=low|medium|high`).

## Goal
Make the 3D game's UI + graphics look like the reference screenshot the owner supplied (a mobile game ad, "Pixel Slayer Saga"): chibi stylized 3D, warm golden light, painterly saturated terrain, chunky gold-and-wood HUD.

## HARD RULES
1. Recreate the **style only**. Do NOT copy, trace, extract or import the reference game's sprites, characters, icons, logo, name or UI art (copyright). All art must be original/code-made, or CC0/properly licensed (Kenney, Quaternius, etc.) and recorded in `ASSET-LICENSES.md`.
2. Audience is children 6–10 (Malaysia): child-safe, no tracking, no paid APIs, no remote runtime art. EN + Bahasa Melayu text must keep working.
3. Keep gameplay logic, quest, Rune Stone puzzles, combat, save/outfit store and tests working. Add tests for new pure logic.
4. Keep mobile/touch controls and the quality tiers (low/medium/high) working; the style must degrade gracefully on phones.
5. After each stage: `npm test` + `npm run build`, then deliver the FULL project zip (no node_modules/dist/secrets; keep package-lock.json, README, ASSET-LICENSES.md).

## Reference style → what to change (and where)
| Reference feature | Change | Files |
|---|---|---|
| Steeper, closer top-down camera, hero large on screen | Raise pitch, reduce distance, keep wall/tree occlusion fade | `src/game3d/Game3D.ts`, `systems/movement3d.ts`, `systems/wardrobeCam.ts` |
| Chibi hero: big head (~2–2.5 heads tall), spiky oversized hair, big weapon, soft outline | Reproportion rig-skinned body/head, bigger hair + face decal, outline pass | `render/hero/HeroRig.ts`, `heroBody.ts`, `heroProps.ts`, `faceTextures.ts`, `render/stylize.ts`, `render/Characters.ts` (Lina/NPCs: same chibi proportions) |
| Warm golden sun, long soft shadows, slight vignette/colour grade | Warmer sun colour, lower sun angle, stronger shadow softness, grade/vignette | `systems/lighting3d.ts`, `Game3D.ts` |
| Saturated painted grass, cobble-textured dirt paths, rocky cliff walls ringing the area | Re-colour terrain, add path cobble texture, cliff/rock-wall ring | `render/env/terrain.ts`, `Scenery.ts`, `noise.ts`, `systems/worldShape.ts` |
| Props: red tent, campfire + log seat, wooden fences, ladder, twisted dead trees, stylized rocks, purple flowers/mushrooms | New merged low-poly models, placed in a camp area | `render/env/Structures.ts`, `plants.ts`, `treeGen.ts`, `systems/layout3d.ts` (+ update `layout3d.test.ts`, `colliders.ts`) |
| HUD: round hero portrait + health bar top-left; quest/menu buttons on right edge as rounded wood-and-gold tiles; bottom icon tab bar | Rebuild HUD in DOM/CSS with original SVG icons | `ui/Hud3D.ts`, `ui/hud3d.css`, `ui/WardrobePanel.ts`, `ui/PuzzlePanel.ts` |
| Bold white subtitles with coloured highlight words | Dialogue/quest caption style | `Hud3D.ts`, `hud3d.css`, `data/woodsText.ts` |

## UPDATE (same day, second pass): the 3D game is the main game
- `index.html` now opens the 3D game; the 2D Phaser game moved to `2d.html` (kept, nothing deleted); `3d.html` still works. `vite.config.ts` lists all three pages.
- Camera framed per device: phone portrait = 11.5 m distance, pitch 0.95 rad, fov 60 (about 6 m of ground across the screen; the earlier close framing showed ~3.5 m and made walking look far too fast); phone landscape / tablet / desktop 7.4-8.0 m. Walk 3.6 m/s and run 5.8 m/s are unchanged (`WALK_SPEED_3D`, `RUN_SPEED_3D`); if movement still feels wrong, tune these and `cameraPreset`.
- HUD compacts on phone landscape (tiles in a row, no labels) and no longer overlaps in portrait.
- Measured in headless Chromium (software GL, so NOT real fps): ~90-110 draw calls, ~140k triangles per frame at the `low` tier. Real-phone fps was not measured.
- The project owner's earlier "movement speed and performance" report was not available to the assistant that did this pass; re-test on a real phone and send the exact symptoms.

## UPDATE (third pass): graphics richness
- Ground shader (`render/env/terrain.ts`): bigger painted patches, blade-stroke streaks, meadow flower speckles; deeper, more saturated greens.
- Boulder ring at the world rim (64 big rocks, solid) so the glade reads as walled; gardens (bushes, flowers) around the village and camp, small rocks at the camp (`systems/layout3d.ts`, drawn after all earlier random draws so old placement is unchanged).
- Quality `low` (what most phones get) now has real small shadows (512 map) and more grass; vignette stronger; exposure 1.0.
- Still missing vs the reference: hand-painted textures, chibi characters, dense forest undergrowth, cliff faces (the ring is boulders), bloom/ambient occlusion post-processing, animated water/fire. These need original or CC0 art assets or a post-processing stack (cost on phones).

## STATUS after the first style pass (2026-10-20) — tests 347/347, `npm run build` OK
DONE (all three stages, first pass):
- HUD: wood-and-gold panels, round original SVG hero portrait + hearts + level/XP bar (top-left), right-edge tiles Menu / Outfit / Sound (original SVG icons), bold white subtitles with coloured highlight words (write `*word*` in dialogue text to highlight; not used in `woodsText.ts` yet), warm vignette overlay. Files: `ui/Hud3D.ts`, `ui/hud3d.css` (v2.4 block at the end).
- Camera: closer and steeper (`systems/movement3d.ts` `cameraPreset`, `CAMERA_DISTANCE_SCALE = 1.0` in `Game3D.ts`).
- Hero: bigger head (`HEAD_SCALE` 1.3 -> 1.85 in `render/hero/HeroRig.ts`).
- Light/terrain: warm golden day look (`systems/lighting3d.ts`, `WorldBuilder.ts`, exposure 1.1; `lighting3d.test.ts` updated), brighter grass, cobble-patterned trail, rocky grey rim (`render/env/terrain.ts`).
- Camp: red tent, campfire + log seat, fence, fire glow (`render/env/Camp.ts`, `CAMP_*` + colliders in `systems/layout3d.ts`, built from `WorldBuilder.ts`).

NOT DONE / TODO (first pass, checked only by two low-quality headless screenshots):
- No bottom icon tab bar (it would collide with the touch pad/joystick; design a layout first).
- Hero is still full-height with a big head, not a true chibi (legs/body not shortened); no outline pass.
- No cliff/rock-wall ring (only a grey terrain tint), no ladder, no twisted dead trees; the tent canvas shape needs refining.
- Needs a real-device check (phone portrait + landscape) of HUD overlap with the touch pad, dialogue and the Rune Stone panel; PuzzlePanel/WardrobePanel are not restyled yet.
- Night look was not re-tuned for the warmer palette (only DAY and MORNING keys changed).
- Add `*highlight*` markers to `data/woodsText.ts` strings.

## Original stage plan

1. **HUD** (original SVG icons, portrait + health bar, right-edge tiles, bottom tab bar, subtitles).
2. **Hero + camera** (chibi proportions, outline, camera pitch/distance).
3. **Terrain + lighting** (colour grade, golden light, cobble paths, cliff ring, camp props).

## Honest limits
Code-only art reaches roughly 70–80% of studio polish. The last 20–30% (hand-painted textures, hand-modelled characters) needs original artwork or licensed packs.

## Key paths
`src/game3d/Game3D.ts` (main loop, 38 KB) · `render/` (hero, env, Characters, Fx3D) · `ui/` (Hud3D, PuzzlePanel, WardrobePanel, hud3d.css) · `systems/` (layout3d, lighting3d, quality, combat, runePuzzle, woodsQuest) · `data/woodsText.ts` (EN/BM text) · `docs/V2_3_NOTES.md` (what v2.3 built).
