# v2.21 - Woods patrol (post-quest progression)
Finding: one full playthrough gives at most 330 XP (level 4), yet three wardrobe rewards need level 5 (the Hero panel even advertises the Moon Hat as "Next reward - Lv 5"), and after the Moonlit Gate nothing paid XP. Free roam was a dead end.
Change: after the quest, calmed sprouts keep returning (max 2 at a time, one every 9 s, only where the hero is at least 9 m away). Each pays 8 XP from a bonus pool of 120 XP (BONUS_XP_CAP), saved as `bonusXp`. 330 + 120 = 450 = level 5. Pool used up: patrol stops, toast + quest card say the woods are peaceful. Quest XP, riddle XP and Rune Stone practice (still no XP) are unchanged.
Files: systems/woodsQuest.ts, Game3D.ts (updatePatrol, toast), data/woodsText.ts (EN + MS), systems/progression.test.ts, data/woodsText.test.ts.
Not verified: feel of the patrol pace on a real phone; headless run only (sprout spawned, paid 8 XP, saved, respawned, no errors).
