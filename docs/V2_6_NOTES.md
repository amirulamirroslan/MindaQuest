# v2.6 — detail pass on trees, grass and scenery

Owner request after v2.5: "put more details, especially on the tree, grass, others". Style rules from `V2_4_STYLE_HANDOFF.md` still apply (original code-made art only; no new image files; kids-safe; EN + BM unchanged). Gameplay, quest, combat, puzzles and save data are untouched.

## What changed
**Trees** (`render/env/treeGen.ts`)
- Foliage is now clumps *plus a skin of small pointed leaf tufts* (2 leaves per tuft, coloured dark at the base and bright at the tip, some accent-coloured) so crowns have a leafy, ragged silhouette. Clumps are painted in quantised colour patches.
- Trunks: ridged bark, bark plates, knot-holes, moss on the shady side, buttress roots, forked branches with twigs. Birch has the dark horizontal scars. Pines have 9 jagged tiers with hanging needle fringes.
- New species: pink **blossom** trees (some of the old oaks switch to this by hue, no layout change), a few **golden autumn** oaks (tint only), and **twisted dead trees** (14+2 new solid landmarks, see `deadTrees` in `systems/layout3d.ts`, drawn after every earlier random draw so the old layout is identical).
- The Ancient Tree has roots, bark plates and leaf tufts too.
- Only the detailed model has tufts/plates; the far model is as light as before.

**Grass and ground** (`render/env/plants.ts`, `terrain.ts`, `Scenery.ts`)
- Five tuft kinds: short lawn, tall, tall with golden seed heads, clover patches (some with blossoms), dandelions (yellow or white puffball). Narrower curved blades, dry/lush colour patches, dark roots and bright tips.
- Grass quality tiers now draw whole tufts only (`userData.ends`), and `low`/`medium` grass density went 0.3→0.4 / 0.4→0.5.
- Ground shader: pebbles and grit on dirt, tussock shadows, sun-bleached fleck patches, finer blade strokes up close, and a derivative-based bump so the low golden sun catches ridges and stones (fades with distance, no extra textures).
- Leaf litter / needle carpet / bare earth baked under trees; fallen leaves (instanced), pebbles along the trail and small stones around rocks.

**Other**
- Rocks: flat facets, banded strata, dark cracks, lichen speckles, moss in crevices.
- Bushes: 3 kinds (plain, berry, flowering) with leaf tufts and berries/blossoms.
- Ferns with leaflet pairs; toadstool clusters and ferns at tree feet; tall flower spikes (foxglove/lavender); cattails and reeds round the pond.

## Measured (headless Chromium, software GL: triangle counts are real, frame rates are not)
| tier | v2.5 | v2.6 |
|---|---|---|
| low (phones) | ~200–225k tris/frame | ~240–300k |
| high (desktop) | ~600–690k | ~1.05–1.25M |
If a phone is slower than before, tell me the model and tier; first levers are `detailRadius` and the leaf-tuft counts in `treeGen.ts`, then grass density in `quality.ts`.

## Tests
`npm test`: 38 files / 362 tests (new: `render/env/detail.test.ts` — geometry validity and triangle budgets per tree kind, blossom colour, grass tuft prefix list, rock strata; `layout3d.test.ts` — dead trees solid, clear of quest spots, old layout unchanged). `npm run build` OK.

## Not done / ideas
- Hanging vines/ivy on trunks, snow or rain variants, wind-blown falling leaves (particles), hand-painted bark/leaf textures (needs art assets).
- Real-phone fps was not measured.
