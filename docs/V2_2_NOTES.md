# v2.2 notes: Rune Stone riddles, 3D wardrobe, day-night and music in 3D

Open `http://127.0.0.1:5173/3d.html` after `npm run dev`. The 2D game at `/` is unchanged.

## 1. Learning content: the Rune Stone (new quest stage)
Quest is now: Elder -> 6 petals -> 3 sprouts -> **Rune Stone (3 riddles)** -> Old Mossback -> Elder -> Moonlit Gate.
The Rune Stone stands beside the end of the trail, just outside the ruins. Answering its riddles wakes the Mossback (it no longer
spawns before that). A riddle run is: **count the petals**, **finish a pattern**, **add or take away** (`systems/runePuzzle.ts`).
- Three difficulty tiers. Tier 1: counting 3-6, picture pattern of two (ABAB), sums within 6. Tier 2: counting 6-10, AAB/ABB/ABC, within 10.
  Tier 3: counting 9-14, number patterns (steps of 2, 3, 5, 10, up or down), within 20.
- Difficulty adapts between runs: at most 1 mistake -> next run one tier up; 5 or more -> one tier down. Saved as `runeTier`.
- Never a fail state. A wrong answer fades that button and gives a hint (counting riddles count the petals out loud, one by one).
  After 3 slips the answer is shown and the quest still moves on. Tapping petals counts them (numbers appear).
- XP: 10 per riddle, +5 for first try. After the quest part the stone is for **practice** (no XP, new riddles every time, adapts tier).
- All text in English and Bahasa Melayu (`data/woodsText.ts`, with `{a}`/`{b}` placeholders; a test checks both languages).
- Old saves: anyone already at the boss/return/complete stage counts the riddles as solved (nobody is sent back).
- Mistake counts per run are kept only for the tier decision. No per-skill analytics yet (a natural hook for the parent dashboard).

## 2. 3D wardrobe
Pause menu -> **Change outfit** now opens a 3D wardrobe (it no longer jumps to the 2D game). The camera swings to the front of the real hero,
in the real woods (it picks the direction with the most room), and the picture slides clear of the panel (side panel on wide screens, bottom
panel on phones in portrait). Eight parts x their swatches (the same ones and the same saved outfit as the 2D wardrobe), the extras (crown,
cloak, lantern; these moved here from the pause menu), Surprise me, Original look, Stand/Walk/Slash/Spin, drag or left/right arrows to turn.

## 3. Day-night and music in 3D
- A 5-minute day (same clock and key times as 2D): the game opens in plain daylight, then golden hour, pink dusk, a readable blue night, dawn
  (`systems/lighting3d.ts`). Lights, fog, sky, lamp and window glow change; fireflies drift near you after dark. The clock only runs while you play.
- Music and ambience reuse the 2D engine (`GameAudio`): slow generative tune, wind that follows gusts, birdsong by day, crickets and an owl at night.
  Music ducks while a menu/riddle is open. The pause-menu Sound switch mutes everything (shared with 2D).
- Switches: `?tod=day|golden|dusk|night|dawn|0..1` freezes the time; `?off=daynight,fireflies,music,ambience,sound` as in 2D.

## Verified here / not verified
Verified: strict `tsc`, `npm test` (337 tests, 27 new), `vite build`, headless Chromium (software WebGL): whole riddle run in English and Malay at desktop,
phone portrait and phone landscape with real clicks/keys, quest advancing to the Mossback, wardrobe recolour saved to `mindaquest.outfit.v1`,
day/golden/night screenshots, audio engine producing sound, no console errors.
NOT verified: speed on a real phone (please check `?fps` at night: lights/fireflies are cheap but unmeasured), how the music sounds by ear,
whether the riddle difficulty suits real 6-10 year olds (the tiers are my estimate, please test with a child), Malay wording by a native reader.

## Next
Parent-dashboard hooks for riddle results, more riddle kinds (shapes, time, money in RM), footstep sounds in 3D, real models.
