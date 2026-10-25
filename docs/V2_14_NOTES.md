# v2.14 – Gameplay HUD and Hero panel

Inspection found a working HUD already (portrait + level badge, hearts, XP bar, quest card, Menu/Map/Outfit/Sound tiles, touch pad with cooldown rings,
boss bar, toasts, dialogue, pause, wardrobe, map). Nothing was rebuilt. Added:

- **Hero panel** (`ui/HeroPanel.ts`): Hero tab (level, XP to next level, hearts, equipped item per slot, next level reward, Change outfit),
  Bag tab (petals, sprouts, riddles, Mossback, rewards earned), Journal tab (quest checklist). All read live from `Progress`, vitals and cosmetics.
- **HUD**: Bag and Hero tiles (replace the Outfit tile; outfit is in the Hero tab and pause menu), quest progress bar for counted goals,
  tile bounce when a petal is collected or a level/reward is earned. Keys: `I` bag, `C` hero, Esc closes.
- `systems/hudData.ts` (+ tests): pure view-model helpers. New icons: bag, hero, petal, sprout, rune, flag. English + Bahasa Melayu strings.
- Layouts tested at 1100x650, 390x844, 844x390, 360x640.

## Not implemented yet (integration points)
- General inventory items (loot, consumables, shop): the Bag shows quest collectibles only; add item data next to `bagCounts`.
- Equipment stats / attack power: equipment is cosmetic today.
- Player max HP / stat growth with level: hearts fixed at 5.
- Real-device performance not measured.
