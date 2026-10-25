# MindQuest v2.9 - polish pass

Character: `render/chibi/ChibiFace.ts` (glossy eyes + blush decals on the head bone), `ChibiOutline.ts` (inverted-hull cartoon outline, smoothed normals), head bone x1.1, ground light pool + larger shadow, lean/bank body language and a Cheer clip (petal, level up) in `HeroModel.ts`/`chibiAnim.ts`, run clip rate cap 2.0 -> 2.4.
Camera: closer presets (`movement3d.ts`), smoothed follow focus (`Game3D.ts`).
World: grass shortened near the hero (`aRise` attribute), fewer tall tufts, density 4.0 -> 3.4, crisper trail edge, fewer speckle flowers, flowers kept off the trail.
UI: `ui/icons.ts` SVG set replaces emoji; status card with level badge and XP number; foldable quest card; restyled tiles, touch buttons, pause card; wardrobe cards show Wearing / Lv n / Quest / Soon chips; landscape tab strip is one row. CSS block "v2.9" at the end of `hud3d.css`.
Not done in v2.9 (shoes, map and outline cost were picked up in v2.10): faces are not animated (no blink), no real-device frame-rate measurement. Screenshots: `node tools/browser-checks/polish-shots.mjs dist <out>` (VP=phone-portrait to run one viewport).
