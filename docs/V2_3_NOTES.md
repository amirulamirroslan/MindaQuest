# v2.3 — 3D graphics quality upgrade

**Hero** (`src/game3d/render/hero/`): a code-modelled, skinned hero on the CC0 Universal Animation Library skeleton (`public/assets/hero/hero_rig.glb`). Face decal with four expressions, hair with a swaying tail, hood, tunic with trim, belt and pack, bracers, a real sword with a scabbard, and wardrobe extras (leaf crown, mossy cloak, glow lantern). Animation is scrubbed from the game's own combat timing so hits land on the logic frame. The old procedural hero stays as a fallback if the rig fails to load.

**Woods** (`src/game3d/render/env/`): painted terrain with baked ambient occlusion and a procedural grain; oak, pine and birch trees (detailed and light model each, instanced, wind sway, leaves dither away near the camera); wind-blown grass tufts that bend away from the hero; flowers, ferns, mushrooms, stumps, logs, mossy rocks; the Ancient Tree, a pond with lily pads and a glowing mushroom fairy ring; mountain layers and drifting clouds. Village, ruins and Moon Gate are rebuilt as merged vertex-coloured models.

**Light and quality**: a real sun shadow follows the hero (snapped to texels), rim light follows the time of day, quality tiers (`?q=low|medium|high`, chosen from the device and stepped down automatically when the frame rate is poor, before the resolution is reduced).

Debug helpers (`?debug`): `window.__mq3d.debugCam = {from:[x,y,z], to:[x,y,z]}` for a free camera.
