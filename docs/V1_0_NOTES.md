# v1.0 notes: Adventurer hero and a world restyled to match

## What changed
- **Hero:** replaced the code-painted chibi with Antahonist's Top-Down Adventurer: 8 facings, 1 idle + 7 walk frames each. Facing comes from the on-screen movement vector with a small hysteresis band (no flicker when sliding along a bank); the walk frame follows the distance covered (`WALK_STRIDE_PX`), so feet do not skate and the cycle keeps its phase when you turn.
- **Collision is unchanged.** The invisible physics sprite keeps its 32x33 frame, scale 1.35 and 13x10 body. The hero is drawn standing on that footprint (`FOOT_WORLD_DY`), where before it was drawn about 18 px lower than where it collided.
- **Lina** is the same Adventurer art recoloured teal at boot (`recolourOchreToTeal` in `art/recolour.ts`).
- **Resolution:** the hero is ~134 px tall in a 204 px frame and is drawn at 0.33x. A half-size atlas is used when the hero is drawn at <= 0.5x device pixels (desktop at 1x), the full atlas on dense phones (`pickHeroLod`).
- **World:** every solid object (trees, pines, bushes, rocks, logs, stumps, posts) gets the same dark contour as the hero (`addOutline`), the greens and canopies are deeper, the trail has a darker rim and the river a dark bank line. Layout, collision and quest data are untouched.

## What this pack cannot do
Each frame is one flattened image. Shirts, trousers, boots, hats and weapons are **not** separate layers, so none of them can be changed independently with this art. Only whole-sprite recolours (as done for Lina) are possible. A modular wardrobe needs a layered body/outfit set drawn to one shared frame grid, or new layers authored for this sprite's 8 x 8 frames. That has not been started and nothing here claims it.

## Checks
- `npm test` (unit tests incl. facing, walk phase, LOD pick, recolour), `npm run build`.
- `tools/browser-checks/hero.py`: all 8 facings are shown while moving in that direction, walk frames cycle in every direction, correct atlas by device density, no page errors (desktop and phone sizes). Also `verify.py`, `flow.py`, `feel.py`, `alive.py` all pass.
- Not done: a physical phone (frame rate, memory), judging the art with children.
