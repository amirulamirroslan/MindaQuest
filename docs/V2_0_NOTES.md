# v2.0 notes: the playable 3D slice (Whispering Woods)

Open it with `npm run dev`, then go to `http://127.0.0.1:5173/3d.html`. The 2D game at `/` is unchanged. Add `?fps` for a frame-rate/draw-call meter, `?res=1` to force the render scale, `?touch` to show touch controls on a desktop, `?debug` to expose `window.__mq3d`.

## What you can play
Talk to Elder Tok Wan -> collect 6 glow petals (8 are hidden in the woods) -> calm 3 grumpy sprouts -> face the Old Mossback in the ruins -> return to the Elder -> walk through the Moonlit Gate. Reward: the Mossy Cloak (auto-equipped, changeable in the pause menu). Progress, XP, level, language, sound and equipment are saved on the device. Falling (0 hearts) never ends the game: you wake at the last checkpoint with full hearts.

## Controls
Keyboard/mouse: WASD or arrows (Shift = run), drag mouse or Q/R to look, Space/J/click attack, K dodge roll, L spin attack, E talk, Esc pause.
Touch: left half = floating thumb stick, right half = drag to turn the camera, round buttons for Attack, Dodge, Spin, and Talk (appears next to the Elder).

## Where things are (`src/game3d/`)
- `systems/` pure, unit-tested: movement + camera maths, combat timing, enemies and boss patterns, quest + save, wardrobe bridge (from the first 3D slice) plus new `colliders.ts` (circle collisions, camera ray pull-in), `worldShape.ts` (terrain height, trail), `layout3d.ts` (every tree, rock, pillar, petal, spawn; deterministic), `adaptiveRes.ts`.
- `data/woodsText.ts` all words in English and Bahasa Melayu (a test checks both languages have every string).
- `render/` Three.js only: `WorldBuilder` (terrain, instanced forest, village, ruins, gates, sky), `HeroModel` (procedural hero, wardrobe colours + 3 accessories), `Characters` (Elder, sprout, Mossback, ground warnings, petals), `EnemyManager`, `Fx3D` (particles), `common`.
- `input/Input3D.ts` keyboard, mouse and touch. `ui/Hud3D.ts` + `hud3d.css` DOM HUD, dialogue, pause, end card. `Sfx3D.ts` synthesised sounds (shares the 2D game's mute setting). `Game3D.ts` the loop that wires it all together.
- `3d.html` + `vite.config.ts`: a second page, so three.js (about 150 kB gzipped) is never downloaded by the 2D page.

## What was verified here, and what was not
Verified in this build: strict `tsc` clean, `npm test` (310 tests, 19 new for the 3D layer including a flood-fill proof that the hero can walk to every petal, sprout, the Elder, the gate and the arena), `vite build`, and a headless Chromium run (software WebGL) at desktop, phone portrait and phone landscape sizes with real keyboard and touch events: no console errors, the whole quest completed through the real code paths, saves written, both languages rendered, pause menu and end card shown.
NOT verified: speed on a real phone (the sandbox renders in software at about 5 fps, so its fps numbers mean nothing; it did report about 67 draw calls and 76k triangles per frame, which is light), how the controls feel in the hand, balance of the fights, and sound by ear. Please test on your phone with `?fps`; if it is slow, `?res=1` and the automatic resolution step-down help, and tell me the numbers.

## Known limits / next
(Update: the 3D wardrobe, music, day-night and the first learning content were added in v2.2, see `docs/V2_2_NOTES.md`.)
- The wardrobe still lives in the 2D game ("Change outfit" in the pause menu opens it); a 3D wardrobe preview is not built yet.
- No music, day-night cycle or wind sway in 3D yet (the maths modules exist from v0.9).
- The hero and enemies are procedural boxes and spheres; real models can replace them later without touching the systems layer.
- No learning content in this quest yet (the original goal): the natural next slice is a petal-counting / pattern puzzle at the ruins, using the same quest reducer.
- The camera pulls in near houses and ruin pillars (by design) and can feel close in the village corners.
