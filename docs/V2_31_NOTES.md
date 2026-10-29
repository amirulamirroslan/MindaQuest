# v2.31 - Wider Woods (world map expansion)

## Audit (before any change)
- The game is **Three.js 3D** (src/game3d), not Phaser/2D isometric: the brief's "2D isometric Phaser" wording does not match the code. The old Phaser code was removed earlier. The woods are ONE generated scene (no tilemap, no chunked scenes): a height function (`systems/worldShape.ts`), a seeded generator (`systems/layout3d.ts`) that scatters trees/rocks/plants and circle colliders, a collider grid, an instanced `Scenery`, and one terrain mesh.
- Old dimensions: world radius 46 m, walkable radius 41 m (82 m across, 5,281 m2). Landmarks: village (0,25) r11, ruins/arena (0,-27) r11, pond (19,17), Ancient Tree (-26,-8), fairy ring (-18,14), camp (-14,21), Rune Stone, Moonlit Gate (-10.5,26), Shore arch (7.4,19). Rim = 7 m hill wall + 64 boulders + dense trees.
- Camera/boundary: hero clamped to PLAY_RADIUS; camera is a follow camera with a collider ray. Saves: localStorage, one key per system (`progress`, `hollow`, `shore`); each sanitised on load.

## What changed
| | v2.30 | v2.31 |
|---|---|---|
| World radius / walkable radius | 46 m / 41 m | 102 m / 96 m |
| Walkable diameter | 82 m | 192 m |
| Walkable area (circle) | 5,281 m2 | 28,953 m2 (5.5x) |
| Trees / rocks / colliders | 405 / 94 / 553 | ~1,180 / ~300 / ~1,670 |

- **Ridge ring**: the old glade keeps its wall (hills + boulders + dense trees, now a ridge at r 37-56) and **six passes** are cut through it by new paths (south, east, west, north through the ruins' arch, north-east, north-west), each marked with an arch/lantern and a signpost. Obstacles of the original glade are removed ONLY where a new path strip crosses them (94 trees/rocks); everything else is byte-for-byte the v2.30 layout (proved by a fingerprint test).
- **12 regions** (`systems/expansion.ts`): Orchard Lane, Hearthfield Farm (lower village: 3 houses, barn, windmill landmark, well, stall, fields, scarecrow), Kite Meadow, Lookout Hill (5.5 m hill, watchtower), Mirror Pond (wade-able lake, island, obelisk, stepping stones), Mossbark Thicket (dense forest, winding path), the Heartwood (giant glowing tree), Hidden Grove, Whisper Cave (roofless grotto), the Old Steps (colonnade, Moon Dial, tablets, vault, sealed door), Moon Circle (standing stones), Mistfall Gate.
- **Optional content**: 14 Fairy Acorns, 7 treasure chests, 3 tablets (hints that lead to the hidden places), 3 people with errands (Pak Tani: 4 pumpkins + a sum; Kak Lumut: 3 wisp lanterns, opens the thorn shortcut; Pak Din: 4 pearls + a clock sum), 3 hidden regions, 1 secret shortcut (thorn barrier). Total possible XP: see `WILDS_TOTAL_XP` (all one-time).
- **Future regions**: `REGIONS` table. Crystal Hollow (the "Crystal Caverns" of the brief) and Moonwake Shore are built; **Mistfall Highlands** has a real gate at the end of the Mist Road (sealed by a mist wall, sign + dialogue); a second reserved door (The Undercroft) closes the Old Steps. Nothing is implemented behind them.
- **Map**: same MapPanel; extent now 104 m, new trails/lake, fog of war (5 m squares, saved), new landmarks appear when seen (hidden ones when found), chests show on seen ground, "Places found n/12".
- **Saves**: new key `mindquest.wilds.v1` (never touches old keys, so every old save loads; the glade shows as explored for old saves). XP goes through the normal reducer (`{kind:'wilds'}`), capped per event.
- **Performance**: terrain is 32 m chunks built on demand (frustum-culled, seamless normals from the height function); grass of the new area is built lazily (2 cells/frame); rocks are distance-culled; static structures are merged Kit meshes in per-region groups hidden beyond 120 m; `heightAt` was re-optimised (path grid, cheap rejects) so start-up is back to the v2.30 level in a headless run.

## Verification (headless - see HANDOVER for what was NOT checked)
- 505 tests (was 454); production build passes.
- Flood-fill at 0.5 m over the whole 96 m circle: every spawn->place route exists (with and without the thorn barrier); >99% of clear ground reachable; every path walkable end to end; passes open; Mistfall gate/Undercroft door sealed.
- Terrain chunk seams, saves/sanitising, fog of war, map visibility, EN/MS text shape, whole WildsWorld built headlessly (149 meshes, ~41k triangles in total, only nearby zones drawn).
