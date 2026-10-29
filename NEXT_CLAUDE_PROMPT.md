# Prompt for the next Claude session

Continue MindaQuest (v2.31). Read `HANDOVER.md` and `docs/V2_31_NOTES.md` first. It is a Three.js game, not Phaser.

First job: **look at it.** Run `npm run dev`, open the woods at desktop and a phone-sized viewport, and walk every path (Orchard Lane, Pond Road, Mossbark Trail, Old Steps Road, Mist Road, Fern Trail, Lookout Trail, Meadow Path, Heartwood shortcut). Check: structure art (windmill, tower, colonnade, Moon Circle, cave, grove, Mistfall Gate), lighting/fog, water, pickups, chests, NPC facing and markers, map fog/labels, touch use-button, Low-quality frame rate. Fix what looks wrong; keep the approved chibi hero, combat, quests and wardrobe untouched.

Then, if asked: (1) build Mistfall Highlands behind the gate at (62,-66) following the Shore/Hollow pattern (own world, save, text, map); (2) the Undercroft door; (3) native-speaker review of `data/wildsText.ts` Malay; (4) tune wilds XP.

Rules: no new dependencies, no framework migration, keep every existing save loading (new state goes in its own storage key), run `npx vitest run` and `npm run build` before reporting, update HANDOVER.md.
