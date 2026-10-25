# MindQuest v2.30 — quality, combat readability and shore polish

An audit-and-fix pass on v2.29. No new map, no change to quest, save, XP or learning rules. Saves from v2.29 load unchanged.

## What was found and fixed (each one seen in the running game, headless Chromium)

| Area | Problem | Fix |
|---|---|---|
| Cosmetics | **Sea-glass Crown and Leaf Crown were invisible**: built inside the skull (head-bone y 0.5 / r 0.34; the skull is ~0.54 across, centred 0.45 up). | Shared `CROWN` placement (y 0.84, r 0.52) in `ChibiRig.ts`; taller shards. |
| Cosmetics | **Sailor Jacket / Trousers looked like the grey Silver Guard armour**: `variantTint` was only honoured for cape and headgear. | `tintOf` + `targetsFor` now apply `variantTint` to outfit (tunic) and legs (trousers). A wardrobe colour the child chose still wins. Tints retuned in `catalog.ts`. |
| Cosmetics | **Sailor Cap was the spiked Knight Helmet**, hair poking out. | New code-made `sailor-cap` prop (white crown, navy band, gold button, ribbon tails). Same id, slot and unlock. |
| Cosmetics | Crystal Hat tint (0x7fe3ff) came out grey-blue. | 0x35c8ff. |
| Cosmetics | Lighthouse Lantern tiny in the hand. | Scaled ×1.4 (still modest from the front). |
| Learning | "I give you a RM{a} note": RM3, 7, 13, 17 notes do not exist. | "You pay me RM{a}" (question, hint, concept; EN + MS). Arithmetic untouched. |
| Learning | "rings again 1 hours later". | `singularHour()` (English only; Malay unchanged). |
| Learning | Clock riddle had no clock; petals were drawn for hours. | `ui/clockFace.ts` SVG face (hour hand on the hour, minute hand on 12, numerals 12/3/6/9). Add = one face + "+N"; subtract = "now → lamp". Money questions draw coins. `DialogueQuestion.theme` is optional. |
| Shore | Tide readable only by colour/ground height. | Always-visible tide line in the quest card: wave glyph + arrow + words ("Low tide" / "High tide" / "Tide: still"). Hidden outside the shore. |
| Combat | Pebble Crab's recovery opening was only a pose and a few sparkles. | A pulsing amber ground ring (shared geometry) while the shell is open. |
| Malay | "Papan Air Pasang" (high-tide board) for a board that shows both tides. | "Papan Pasang Surut". **Needs a native speaker's review**, as does all new shore text. |

## Verified (software GL headless run, see `tools/browser-checks/v2_30`)
- Walking into the real shore-arch trigger switches areas; woods → hollow → shore → woods works.
- Quiz: a wrong answer leaves XP unchanged, explains, keeps the right answer clickable; the right answer resolves.
- Bells: ebb song → low tide (+15 XP), flood song → high tide (+35 XP), causeway opens; saved; survives a reload.
- Crab and gull drive through chase → telegraph → strike → recover with readable telegraphs (screenshots in `docs/v2_30-screenshots`).
- Cosmetics seen on the real hero from three angles: both crowns, Sailor set, Sailor Cap, Crystal Hat, Mossy Cloak, Warden Mantle, Lighthouse Lantern.
- Clock and money questions and the tide line fit at 844×390 and 390×844 without clipping.
- Game-logic CPU per frame ≈ 0.1–0.3 ms median in every area.

## NOT verified / still open
- **No physical-device testing of any kind.** Headless runs use software GL; frame rates from them mean nothing for phones.
- **Whispering Woods is the heaviest area** (≈246k triangles at the low preset, >1M at high, vs ≈33k Hollow, ≈16k Shore): a long tail of instanced meshes with `frustumCulled = false`. Chunking them would fix it but is an architecture change, left for measurement on a real phone.
- The hero HUD portrait is re-rendered on loadout/area change; it stalled one frame for 4.5 s in software GL. Real cost unknown.
- Heron phase transition / vulnerable preen and the gull's climb were not re-reviewed visually; no combat tuning, damage, XP or learning rule was changed.
- Tide change animation, bell/lamp/causeway feedback and sea-glass pickup effects were not altered or visually re-checked beyond the tide line.
- Portrait/landscape was checked at two sizes only (844×390, 390×844), not 360×640 or tablets.
- Sailor jacket keeps the knight's shoulder shapes; only the colours say "sailor".

## Tests
454 tests (442 in v2.29 + 12 new): clock-face geometry, no-banknote wording (EN/MS), tide strings, Malay board name, `singularHour`, Sailor/Crystal catalog changes. None removed. One self-comparing assertion I drafted was deleted before it was ever committed.
