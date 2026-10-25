# v2.20 HUD revamp
- HUD portrait = real snapshot of the 3D hero's head (render/HeroSnapshot.ts); retaken 0.3 s after any look/loadout change.
- Wardrobe cards, Hero panel slots, next reward and rewards use 3D item pictures (render/ItemThumbs.ts, ui/thumbs.ts), rarity-coloured backdrops, cached.
- Skeleton is re-posed when the hero is lifted into the snapshot scene (three.js refreshes skeletons once per frame).
- New glossy hearts, level badge, XP bar, quest card, tiles (hud3d.css v2.20 block).
- Not done: wardrobe tab icons still hand-drawn; verified only in headless software WebGL.
- Wardrobe tabs show the worn item's 3D picture; Lucide outline icons (scissors, shirt, footprints, crown, flag, shield, palette, trophy) for empty slots.
