# v2.19 - Phase 2: the educational experience

Built on v2.18. The approved chibi hero, world, combat, wardrobe, SVG icons and all XP values are unchanged.

## Learning system (`src/game3d/learning/`)
- `skills.ts` - subjects and skills (counting, patterns, adding, subtracting, multistep), which riddle kind belongs to which skill, tier names (Foundation, Developing, Challenge) and the reward (the same `RUNE_XP` and `RUNE_STAR_XP` for every skill).
- `session.ts` - `ChallengeSession`: one challenge being answered. Hints are free, a wrong answer fades that button, two slips show the answer. "First try" means no wrong answer (a hint does not take it away). Used by the Rune Stone card and by the Elder's question.
- `profile.ts` - the practice log (`mindquest.learning.v1`, counters and recent riddle signatures only) and the difficulty rules.
- Riddles are made in `systems/runePuzzle.ts`; words are in `data/woodsText.ts` (the tests fail until both languages have them).

To add a skill or subject: add it to `skills.ts`, add its riddle kind and maker, add the words in English and Malay. Nothing in the quest changes.

## Difficulty (per skill, from what the child did)
Each finished riddle is clean (no slip, no hint), steady (a hint, or one slip, then right) or struggled (answer shown). The last four at the skill's current tier are the evidence. Two clean in a row: up one tier. A struggle right after another slip, or two struggles in the last three: down one. Hints and single stumbles never move it. A tier change starts the evidence afresh. The quest tier is only the starting point for a skill with no history.
- Foundation: counting (to 6), number words ("five" -> 5), picture patterns (ab), adding and taking away within 6 with petals to count.
- Developing: counting to 10, longer picture patterns, adding and taking away within 10.
- Challenge: numbers to 20, number patterns, and (only when adding and taking away are both at Challenge) two-step problems. Two-step rests while it is hard.
The third riddle goes to the maths skill practised least, so adding and taking away stay balanced.

## Learning in the adventure
- Rune Stone: free Hint button; a wrong answer explains the idea in simple words; every finished riddle ends with a one-line explanation.
- The Elder's lanterns: before the Moonlit Gate opens, the Elder asks a small adding or taking-away question inside the conversation (no full-screen card). It cannot be failed (the answer is shown after two slips), it pays no extra XP and it feeds the practice log.
- No riddle repeats until the other riddles of its kind have been seen (last 24 remembered).
- Journal tab: "Rune practice" - level pips, first tries and hints per skill, and a gentle "fun to practise more" line.

## Saving
`mindquest.learning.v1` on this device only. Start over keeps it (the child keeps their level). No names, ages or other personal details. Not synchronised between devices.

## Not verified
No browser was available: the new card layout, the Elder's question and the Journal list were not seen on a real screen or phone, and the DOM code (card, conversation question, journal) has no automated test (the rules behind them do).

## v2.19.1 - wardrobe selection fix
The colour swatches for hair, outfit, trousers and boots, and "Surprise me", changed the hero and saved, but the panel was not redrawn, so the selection ring stayed on the old swatch ("applied, but not selected"). `Game3D` now redraws the wardrobe after every outfit change, and also after an equip that changes nothing (so the tapped card still shows as picked). Cape and hat tints, items, tabs, poses and Reset already redrew. Not checked on a real screen.
