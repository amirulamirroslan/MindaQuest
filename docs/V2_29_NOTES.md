# MindaQuest v2.29 — Map 3: Moonwake Shore

The archive was v2.28 (Crystal Hollow, completed). This release adds the third area from the proposal: **Moonwake Shore**, a stilt-village coast where
the tide has stopped and the lighthouse is dark. The woods, the Hollow, the saves, the hero, combat, wardrobe and learning engine are untouched
(all 385 earlier tests pass unchanged apart from one that is explained below).

## The shape of the map (`systems/shoreLayout.ts`)
Arrival beach (south) -> **Stilt village hub** (Mak Long, Tide Board, three bell piers) with the **Tidepool Flats** to the west, the **Shipwreck
Graveyard** to the east and the **lighthouse island** to the north (Moon Causeway), with a **sea cave** under it. The ground depends on the tide:

| Ground | Open when |
|---|---|
| Tidepool Flats | LOW tide |
| Ferry to the wrecks | HIGH tide |
| Moon Causeway | both tide songs rung once (puzzle solved), then for good |
| Sea cave | LOW tide (and you must be on the island) |

Everything else (village, piers, beach, island, wreck island) is always there. A BFS test proves every goal is reachable with exactly the gates it
needs and that the way back to the beach is never cut off. A hero can never be trapped by a tide change because the bells are on always-open ground.

## The new mechanic: bell-buoys and tide songs (`systems/shoreQuest.ts`)
Three bell-buoys (Shell, Wave, Star; each carries a picture, never only a colour). **Ebb song** = Wave, Shell, Star -> low tide. **Flood song** = Star,
Shell, Wave (the ebb song backwards) -> high tide. Same forgiving rules as the Echo Crystals: a wrong bell just starts again, no penalty. The Tide Board
in the village draws both songs; the quest card only names the bells once the child has read the board. The sword or the Use button rings a bell.
First time each song is rung pays 15 XP; having rung both pays 20 more and lifts the causeway (and wakes the Heron).

## Creatures (`systems/enemies.ts`, `render/ShoreViews.ts`)
- **Pebble Crab** (4 HP): scuttles along a warned line, then is dizzy. **New engine feature `frontGuard`**: a normal blow from the front arc is blocked
  (clink + one-time hint) unless the crab is recovering (shell pops open, visibly); side/back blows land; the spin ignores the shell. `turnRate` makes it
  turn slowly so circling to its back is possible (every older creature has no turn limit, so they are unchanged).
- **Gloom Gull** (3 HP): circles, climbs, then swoops along a longer warned line. A hit in the wind-up interrupts it.
- **Tidecaller Heron** (boss, 32 HP): water spout where you STAND, long wing-sweep line, tidal ring round itself; phase 2 at half health (spout twice).
  Same lesson as the Warden: while it **preens** (recovers) its chest pearl blazes and blows count double. Stays on its island. The test suite includes
  a scripted hero who dodges every warning and beats it taking zero hits.

## Learning
- **Harbour-master Mak Long**: money-and-change sums (ringgit only, whole numbers, <= 20) via the existing add/subtract engine; shore-specific hints.
- **Keeper Salleh**: clock riddle in whole hours on a 12-hour face (tier capped at 2 so totals never pass 12).
Both reuse hints, the free answer after two slips, the learning profile and explanations; there is no failure state.

## Rewards and economy (462 XP total, `SHORE_TOTAL_XP`)
Songs 30+20, sea-glass 8x5+20, crabs 5x6, gulls 4x8, bottles 3x5+15, Mak 30, keeper 30, Heron 100, lamp 100. Cosmetics (new collection "Moonwake Shore"):
**Sailor set** (jacket, trousers, cap; kit meshes in sea colours) from Mak for all eight pieces of sea-glass; **Lighthouse Lantern** (new code-made prop)
for lighting the lamp; **Sea-glass Crown** (new code-made prop) at level 10. Level 10 needs woods + Hollow + shore (the old "quest alone reaches max
level" test now says so explicitly).

## Where it hooks in
- Woods: after the Heartstone, a driftwood arch appears at (7.4, 19), the one clear patch left in the crowded woods. Elder lines send you there.
- `Game3D`: `area` is now `'woods' | 'hollow' | 'shore'`; shore save key `mindquest.shore.v1` (older saves load fine; a damaged save can never claim more
  than it earned); map, objective card, checkpoint on the island, day-night lamps, sea ambience, start-over reset all extended.
- New files: `shoreLayout/Quest/Encounters/Map/Riddles` (pure, tested), `shoreText` (EN + MS), `render/ShoreWorld.ts`, `render/ShoreViews.ts`.

## Verified
440 tests pass; production build passes; a headless-Chromium run (software GL) walked: woods arch -> shore, bells -> low/high tide, flats, ferry,
wrecks, causeway, island, Heron wake-up, crab shell block/back hit, Mak and keeper dialogues, lamp lighting, shore map, wardrobe lantern, saving.
No console errors.

## Not verified / known gaps (please check on a real device)
- Phone frame rate and touch layout on the shore were not measured (software GL only).
- **Sea-glass Crown not seen on the hero**: equip worked, but my screenshot angle did not show the head. Check it in the wardrobe.
- Sailor jacket/trousers/cap tints were not viewed; they use the same `variantTint` mechanism as the Mossy Cloak and Crystal Hat.
- Malay text is mine, not a native review (Hutan Berbisik / Gua Hablur style kept); please have a Malay speaker read `data/shoreText.ts`.
- Sounds reuse the existing synth (bell = the petal chime); no bespoke sea or gull sounds. The ocean ambience is the existing water-noise bed.
- No ferry *riding* animation: the ferry is a walkable raft that floats up at high tide.
- Caves have no extra darkness shader; the cave is distinguished by rock, a teal glow and sparkle.
- The clock riddle is text only (no drawn clock face yet).
