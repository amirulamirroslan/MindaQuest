# MindQuest v2.28 — Crystal Hollow, completed

The archive was v2.27 (Whispering Woods boss fight), not v2.26. Crystal Hollow already existed with its layout, puzzles, quest reducer, map and save
data, but it had **no enemies, no NPC, no boss, and no reason to leave the main path**. This release completes it; nothing was rebuilt.

## Audit (what was already there, left alone)
Layout/colliders/reachability (`hollowLayout`), puzzle + reward rules (`hollowQuest`), map, EN/MS text, the cave renderer, Echo Crystals, Heart Door,
Heartstone, Moon Shards, Glowcaps, the secret nook, the Crystal Hat. The enemy state machine (`systems/enemies.ts`), `EnemyView` (recoil, hurt flash,
cues, outlines, defeat timing), `TelegraphMarker`, hit-stop, camera punch and boss bar were reused and generalised, not duplicated.

## What was added
**Enemies — `enemies.ts` is now data-driven.** New per-kind fields (`strikeTime`, `reach`, `lockAim`, `dash`, `phaseAt`/`attacks2`, `weakWhileRecover`,
`interruptible`, `returnsHome`, `boss`) replace the hard-coded Mossback checks. Sprout and Mossback numbers are unchanged (their tests pass untouched).
- **Shardling** (4 HP): a lumpy violet rock critter with a crystal crest (cyan / pink / violet per creature). Skitters at you, curls into a ball
  (0.8 s wind-up, line telegraph), rolls along the warned line, dizzy afterwards. A hit during the wind-up interrupts it. Defeat: crest shatters into
  sparkles (no gore). It walks home when you leave.
- **Hollow Warden** (boss, 30 HP): chibi crystal guardian with floating stone fists and the dimmed Heartstone light as its heart. Three telegraphed
  attacks: *crystal rain* (circle where you are **standing**), *prism beam* (long thin line, aim locks), *light ring* (circle round itself). Phase 2 at
  half health: faster, rain twice per cycle. **One rule to learn:** while it recovers its heart is exposed (gold glow + pulsing ring) and blows count
  **double**. It cannot leave its chamber. Defeat: the heart tears free as a rising column of light.
- Preserved player rules: hearts, damage, dodge i-frames, cooldowns untouched. Boss damage is 1 heart per hit like every other enemy.

**Quest / exploration (all reuse the existing XP, quest, dialogue, learning and save systems)**
- **Glim**, a lantern sprite by the cave entrance. Asks you to calm the six Shardlings; when you return he sets a **sum** (the existing add/subtract
  riddle engine with free hints and no failure state, adapted to the child's learning profile) and thanks you.
- **Three hidden Moon Tablets** (pink nook, back of the pool room, the secret nook). Each is a Warden tip (ring / rain+beam / weak spot) so exploring is
  rewarded with knowledge, not just XP.
- The Heartstone is now guarded: **Echo puzzle → Heart Door → Warden → Heartstone**.
- New reward: **Warden's Mantle** (violet Moon Cape, uses the same cape-tint path as the Mossy Cloak).

**XP economy** (Hollow total 210 → **386**; a woods-complete hero ends at level 9, was 7)
| Source | XP | Notes |
|---|---|---|
| Shardling ×6 | 6 each | id saved; never re-paid |
| Glim's report | 30 | once, only after all six calm |
| Moon Tablets ×3 | 5 each + 15 | once each |
| Hollow Warden | 80 + Mantle | once |
Everything else unchanged (shards 90, door 20, Heartstone 100).

**Anti-farming / persistence.** Every prize is keyed by id in the save and tested to pay exactly once. A calmed Shardling is never respawned; the
Warden exists only from door-open until it is beaten; fainting resets whatever is still owed to full health (same as the woods boss).
Knocked out beyond the Heart Door? You restart just inside it, not at the cave mouth.

**Save compatibility.** Old Hollow saves load with defaults. A finished Heartstone is treated as "Warden already beaten"; a save with the door open
but the Heartstone untouched will meet the Warden. Corrupt/hostile values are clamped (tested).

**EN + BM** for every new string (objective card, toasts, Glim, tablets, boss bar, map label, reward name).

## Verification — read this
This build environment had **no network**, so `three`, `vite`, `vitest`, `@gltf-transform` and `lucide` could **not** be installed.
**Not run here:** `npm test`, `npm run build` (tsc -b + vite), any browser session, any touch/mobile session, any frame-rate measurement.
What *was* run:
- A stand-in for vitest executed the **299 pure-logic tests** (266 pre-existing + 33 new); all pass. 8 test files that import three / gltf-transform /
  lucide could not load (same 8 as before my changes).
- `tsc` with generated loose stubs for the missing packages: **zero new diagnostics** versus the pre-change baseline. Calls into three.js itself are
  therefore *not* type-checked.
- A runtime smoke test with a permissive `three` mock executed the real `ShardlingView`, `WardenView`, `GlimModel` through every state, both phases,
  weak-spot hits and defeat: no exceptions. This proves the code paths run, **not** that they look right.
- A scripted-player simulation: a hero who steps out of every warning beats the Warden in ~17 s with 0 hits (Mossback: ~13 s); one who just stands
  and swings is hit repeatedly. Every telegraph is escapable at 75 % of run speed.
- Cosmetic item checked by hand against the real GLB (node exists, ids unique, names in both languages).

**Please run before shipping:** `npm ci && npx tsc -b && npm test && npm run build`, then play: Woods → Gate → Hollow → fight Shardlings → Glim →
tablets → Echo puzzle → Warden → Heartstone → save/reload → back to Woods, once with keyboard and once on a phone (Use/Talk button, dodge during telegraphs,
quality = low).

## Known risks / unfinished
- **Visuals are unseen.** Proportions, colours, outline thickness and animation timing of the Shardling, Warden and Glim were written against the
  existing Sprout/Mossback/Elder code but never rendered. Expect a tuning pass (Warden is ~3.6 m tall; cheek/crown crystals may need resizing).
- The Warden's beam is an additive cylinder; check it on the lowest quality tier. Sounds reuse existing effects (no new audio).
- No new chamber/secret route was added: the existing layout already has a nook that now pays off; another room would not have improved it.
- Level-9 hero: nothing yet gates on level >5, so the extra XP has few new spends (a Map 3 job).

## Proposal: Map 3 — "Moonwake Shore" (not started)
**Hook.** The Heartstone's light, freed by the Warden, flows out of the cave and down the river. The Elder sends the hero after it to the coast, where the
tide has stopped and the lighthouse is dark.
**Layout (small, linear-with-loops like the Hollow).** Hub = fishing village on stilts. West: Tidepool Flats (low tide pools to cross). East: Driftwood
Wreck (ship graveyard). North: a lighthouse on a rock, reached by a causeway that is **underwater until the tide puzzle is solved**. Hidden: a sea cave
under the lighthouse (the Hollow's "secret nook" idea, bigger).
**Mechanic (new, one only): the Tide.** A day/tide clock the hero can *nudge* by ringing three bell-buoys in the right order (reuses the Echo
sequence rules in `hollowQuest`). Low tide opens flats; high tide floats a ferry. Teaches *ordering and patterns* / simple time and measurement.
**Enemies (reuse the new data-driven defs):** *Pebble Crab* (side-step dash, shell blocks the front: hit from behind or after its recover),
*Gloom Gull* (swoops along a line, i.e. the Shardling roll with an air telegraph). **Boss: Tidecaller Heron** — three telegraphs (water-spout circle on
your position, wing-sweep line, tidal ring) plus the same "exposed while it preens" weak-spot rule so the lesson transfers.
**NPCs / learning:** Harbour-master Mak Long (money & change sums using the existing add/subtract engine with a unit twist), a lighthouse keeper (read-the-clock
riddle). Optional: collect 8 sea-glass for a cosmetic; three message-in-bottle tablets (lore + boss tips, same pattern as Moon Tablets).
**Rewards:** Lighthouse Lantern off-hand, Sailor outfit set, level-gated sea-glass crown at level 10.
**Engineering plan:** `shoreLayout` / `shoreQuest` / `shoreText` mirroring the Hollow files (pure, tested first), `ShoreWorld` renderer, generalise
`setArea` to N areas (the Hollow code is the template), and add a tide value to the existing lighting `SkyLook`.
