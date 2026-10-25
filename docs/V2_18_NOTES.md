# v2.18 - production-readiness audit (built on the v2.16 project after the v2.17 removal of the 2D game)

Scope: logic, progression, riddles, input, performance and accessibility. The approved chibi hero, art direction, combat feel, quests, wardrobe and SVG icons were not touched.

## Fixed
- **Saves that could strand a child** (`sanitizeProgress`): a save whose numbers already finished its stage (all petals in "petals", all sprouts in "sprouts", boss done in "boss") waited for an event that would never come. They now move on. A finished quest always has its open gate and Mossy Cloak.
- **Sprout XP outside the sprouts stage** (`reduceQuest`): a sprout defeat paid and counted in any stage. Now only in its own stage (found by the new full-quest test).
- **Rune Stone, keyboard**: pressing 1/2/3 on an answer already faded as wrong counted another mistake.
- **Rune Stone, "reveal"**: `REVEAL_AFTER` was 3 but a riddle has only two wrong buttons, so the answer was never shown. It is now 2, and every finished riddle shows a short explanation (`explain()`, English and Malay): "3 + 4 = 7. Put them together and count!"
- **Combat**: a press buffered just before pausing, talking or fainting could fire afterwards (`PlayerCombat.clearBuffer`).
- **Mobile**: turning the phone could swallow the finger-up and leave the hero running; the stick is now released when the layout changes. The canvas is no longer resized when nothing changed (it was resized twice per window event).
- **Performance**: the frame-rate check used hit-stop-slowed time, so it over-read fps during fights; it now uses real time and ignores menu time. While a menu or riddle covers the game only every third frame is drawn (not the wardrobe or map).
- **Accessibility**: HUD tiles work with Enter/Space; toasts are announced (`role=status`); `<html lang>` follows the language switch.
- The "no WebGL" message no longer sends people to the removed 2D game.

## Tests added
`progression.test.ts` (whole quest start to reward, saved and reloaded after every step, XP and level totals, no pay for repeats, stranded saves), `combatRules.test.ts`, `riddleQuality.test.ts` (3600 generated riddles: one right answer, correct arithmetic and patterns, number ranges per tier, explanations in both languages).

## Not verified
No browser was available when this was written: layouts, touch controls and frame rates were **not** checked on a real screen or phone. Check on a phone: rotate during a stick drag, open and close the pause menu in a fight, finish a riddle by keyboard 1-2-3 and by tapping.
