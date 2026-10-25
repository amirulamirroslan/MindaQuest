# v2.13 – World style unification

Brings the world in line with the hand-painted chibi characters.

- `stylize.ts`: `withPaint()` material wrapper – banded soft light steps, cool tinted shadows (never dead black), saturation boost; `paintLook` uniforms tuned per world look in `WorldBuilder`.
- Applied to terrain, scenery, structures, camp and NPC/character materials.
- Cartoon outlines (`env/worldOutline.ts`) on landmarks only (houses, well, gate, lamp posts, tent) to protect phone performance.
- New day/morning/golden light palettes (`lighting3d.ts`); calmer ground noise/bump and lighter terrain AO.
- Pond: depth layer, foam ring, animated glints.
- New `Butterflies3D` ambient life (two-lobed wings, flapping).
- Not measured on a real phone; low-tier keeps the cheap path.
