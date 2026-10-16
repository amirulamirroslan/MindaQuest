# Third-party game art

## Free Top-Down RPG 32x32 Tile Set v1.7

- Creator: Mixel
- Source: [itch.io asset page](https://mixelslime.itch.io/free-top-down-rpg-32x32-tile-set)
- License: the pack's included `public/assets/mixel/LICENSE.txt` (Copyright (c) Mixel, 2025)
- Included art: terrain, water, trees, bushes, rocks, mushrooms, nature details, logs, and the four-direction animated player.
- Use: the license permits unmodified assets as part of commercial video games. It prohibits resale or redistribution as a separate asset pack/template. Keep the artwork files unchanged and ship them only as part of the compiled MindaQuest game.
- Attribution: appreciated by the creator but not required. This project credits Mixel here.
- The optional Adventurer font is not included or used.

The game's Phaser renderer selects regions from the source sheets at runtime and places those original pixels into the world. No third-party PNG artwork has been edited.

## Forest Isometric Pixel Art, 32×32

- Creator: Kipperfalcon (also credited as KipperFalcon in the included README).
- Source: [itch.io asset page](https://kipperfalcon.itch.io/2d-isometric-forest-pixel-art); the pack is also listed on [OpenGameArt](https://opengameart.org/content/free-forest-isometric-pixel-art).
- License: CC0 1.0 Universal, as stated in the pack README and the creator's itch.io page. The creator waives copyright and related rights to the artwork. The page separately asks users not to repackage, resell, or redistribute the raw art as a standalone asset pack; MindaQuest uses the selected unmodified PNGs as game artwork, not as a redistributable asset collection.
- Included local files: `public/assets/iso-forest/Tileset_Atlas.png` (320×320), `Rocks.png` (124×124), `Leaves.png` (128×128), `Tree_1.png` (48×80), `Tree_2.png` (64×70), and `Tree_3.png` (48×64). Original PNG pixels are unchanged.
- Runtime use: the terrain atlas, tree images, and rocks/leaves atlases are loaded locally by `BootScene.ts` and rendered in `WorldScene.ts`.
- Attribution is not required under CC0; the creator is credited here as a courtesy.
