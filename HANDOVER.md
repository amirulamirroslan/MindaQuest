# HANDOVER - MindaQuest (v2.31, Wider Woods)

Read `docs/V2_31_NOTES.md` for the audit, dimensions and design. Older notes: `docs/V2_*_NOTES.md`.

## State
- Three.js/TypeScript/Vite game. `npm ci && npx vitest run && npm run build` -> 505 tests green, build green.
- v2.31 expanded Whispering Woods from radius 41 m to 96 m (see notes). New files: `systems/expansionShape.ts` (paths, clearings, hills, water), `systems/expansion.ts` (zones, spots, people, REGIONS), `systems/expansionLayout.ts` (generator, runs after the legacy generator with its own RNG), `systems/wildsQuest.ts` (+test; save key `mindquest.wilds.v1`, fog of war), `systems/wildsMap.ts`, `data/wildsText.ts` (EN + MS), `render/WildsWorld.ts` (all structures/interactables), terrain chunking in `render/env/terrain.ts`, lazy grass + rock culling in `render/env/Scenery.ts`, integration block "v2.31 the wider woods" in `Game3D.ts`, fog/landmarks in `ui/MapPanel.ts`.
- Two old tests changed on purpose: rim-hill test (a pass is now cut at x=0,z=44) and `onMap` bound.

## NOT verified (no browser or device was available in the build container)
- Nothing was looked at on screen: art of the new structures, lighting/fog at 96 m, the water, pickups' glow, NPC placement/facing, map readability (legacy labels are smaller on a 104 m map), dialogue flow, and the Moon Circle / cave look are untested visually.
- Touch controls/mobile layout: code paths were not changed (the use button reuses the existing talk button and label), but no phone test was done. Frame rate on phones is unmeasured; the world is bigger so check Low quality first.
- The Malay text is a first draft and needs a native speaker.
- Wilds XP counts at any stage, so exploring early can raise the level (and level-gated wardrobe items) sooner. Decide if that is wanted.

## Known limits / ideas
- Whisper Cave is a roofless grotto (camera-friendly), not an enclosed cave scene. Mirror Pond is wade-able (no swimming rules).
- Hidden zones are found by walking in; tablets only hint in words.
- Future: Mistfall Highlands = replace the mist wall (colliders in `expansionLayout.ts`, sprites in `buildMistGate`) with a portal trigger like the Shore arch; add a scene like `ShoreWorld`. Undercroft door likewise.

## v2.31.1 "what next" after the Crystal Hollow
Players got lost between map 2 (Hollow) and map 3 (Moonwake Shore). While Heartstone is done, the woods quest is complete and the shore has not been visited: the objective line says to go to the glowing arch (east side of the village), the map shows a gold star on the arch, a light beam pulses above it every 2 s, and a long toast appears 3 s after returning from the Hollow. See `shoreNext()` in Game3D.ts, strings in `data/wildsText.ts` (`next`).
