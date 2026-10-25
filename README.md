# MindaQuest — Whispering Woods (3D)

A browser-first 3D adventure for children aged 6-10. three.js + TypeScript + Vite. No accounts, tracking, payments, paid APIs or remote runtime art.

**v2.17: the original 2D isometric Phaser game was removed.** The 3D game is the only game. `index.html` is the game; `3d.html` is the old address and opens the same game. Phaser is no longer a dependency.

## Run in Windows PowerShell
```powershell
npm install
npm test
npm run build
npm run dev
```
Open the URL Vite prints (normally `http://127.0.0.1:5173/`).

## Where things live
- `src/game3d/` - the game: world, hero (chibi rig), quests, Rune Stone puzzles, HUD, cosmetics, input, effects.
- `src/game/` - small shared modules the 3D game still uses (outfit parts and storage, day-night maths, synthesised audio, wind, touch stick, world geometry). It no longer holds any game scene or Phaser code.
- `public/assets/hero`, `public/assets/chibi` - the 3D hero skeleton and chibi kit (licences in `ASSET-LICENSES.md`).
- `docs/` - version notes (latest: `V2_28_NOTES.md`, Crystal Hollow completed; older: `V2_22_NOTES.md`). Notes older than v2.17 describe the 2D game and are kept as history. Start with `docs/V2_4_STYLE_HANDOFF.md` and the latest `V2_*_NOTES.md`.
- `tools/` - the chibi-kit build scripts and optional browser checks.

## v2.29 — Moonwake Shore
The third area (reached through the driftwood arch in the woods once the Heartstone is touched): ring the bell-buoys to turn the tide, cross the Moon
Causeway, calm the Tidecaller Heron and light the lamp. See `docs/V2_29_NOTES.md`.
