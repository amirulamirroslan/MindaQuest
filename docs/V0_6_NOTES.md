# v0.6 notes: mobile layout, movement, performance

## Root causes found
| Symptom | Cause (in the v0.5 code) |
|---|---|
| Phone shows the desktop layout with big empty bands | `Scale.FIT` on a canvas whose logical size was fixed at load (600 px tall, width clamped to 4:3 .. 2.2:1). A 390x844 portrait phone got an 800x600 game shown at 390x293 CSS px, so the world was tiny (displayScale 2.05) and ~65% of the screen was empty. |
| Movement feels like The Flash | Not a double delta-time multiply (checked: velocity goes to Arcade once; `loop.delta` was only used for a collision look-ahead). Contributing causes: (1) a single 185 px/s on-screen speed = ~4 hero heights per second, a run not a walk; (2) the screen-to-ground conversion left ground speed direction-dependent, so up/down travelled 2x as far per second as sideways; (3) Arcade stepped at a fixed 60 Hz while the camera lerped per rendered frame (0.085), so on 90/120 Hz phones or uneven frames the hero advanced 0/1/2 steps per frame while the camera moved every frame, and the camera trailed further when frames were slow; (4) no clamp on large frame times. |
| Lag / stutter | The fixed-step/per-frame-camera mismatch above (judder); 454 vector Shape objects (Rectangles/Ellipses/Arcs), ~150 of them static ground shadows re-tessellated every frame; 72 river colliders plus 67 invisible blocker rectangles in the display list; `Pill.setLabel` rebuilt a Graphics object every frame whenever a prompt was visible; the vignette (9 stroked rects) re-tessellated every frame; 199 endless tweens; ~5,000 individual `drawFrame` calls (each flushing the renderer) to paint the terrain. |

## Measured effects (headless Chromium, same machine, before -> after)
| | v0.5 | v0.6 phone | v0.6 desktop |
|---|---|---|---|
| Display objects | 697 | 424 | 507 |
| Vector Shapes | 454 | 114 | 197 |
| Arcade colliders / static bodies | 74 / 139 | 2 / 67 | 2 / 67 |
| Endless tweens | 199 | 116 | 199 |
| World build, software WebGL | ~212 s | ~14 s | |
| Update+physics+tweens CPU per frame | 0.43-0.6 ms | 0.42-0.45 ms | 0.4-0.6 ms |

The per-frame CPU figure barely moves on a desktop-class CPU: update logic was never the bottleneck. The wins are fewer objects to draw and tessellate per frame (what a phone GPU/CPU pays for), and the motion/camera fixes that remove judder. Headless frame rates are software-rendered and are **not** phone frame rates, so no FPS gain is claimed.

## Behaviour (automated, `tools/browser-checks/verify.py`, 18 checks)
Ground distance after 1 s is the same (within 3%) at 30/60/90/120/144 fps; ~167-170 u/s; identical in all 8 directions; a single 5,000 ms frame cannot move the hero more than one clamped step; feet never enter the river (30/60/144 fps); the broken bridge blocks; a lost touch (no pointerup) stops the hero; hiding the page pauses and releases input; the canvas and both cameras exactly fill 844x390, 390x844, 360x740, 740x360, 1280x720, 768x1024 and 320x568 with no page overflow.

## Tuning
- Walking pace: `WALK_SPEED` in `src/game/systems/movement.ts` (170 ground units/s = ~120 screen px/s sideways, ~60 up/down, ~95 along tile axes).
- How close the camera is: `PHONE_WORLD_SPAN` / `DESKTOP_WORLD_SPAN` in `src/game/systems/viewport.ts`.
- Render sharpness vs speed: `MAX_RENDER_SCALE` (2) in the same file, or `?res=1` to test.
- Decorative effects: `src/game/systems/performance.ts`.

## Not done / to check on a real phone
- Everything above ran in headless desktop Chromium with emulated phone sizes and touch; nothing was run on a physical phone or a real mobile GPU.
- Safe-area insets (notch / home indicator) are read from `env(safe-area-inset-*)` and unit-tested, but headless Chromium reports zeros, so the real-device values are unverified.
- Landscape phones show ~340 world px vertically; at the start position Lina is partly at the bottom edge until the hero walks toward her. If you prefer more vertical room, raise `PHONE_WORLD_SPAN`.
- Walk-animation timing (`walkAnimationScale`) and pace are tuned by arithmetic; please judge the feel by hand and adjust the constants above.
- The Canvas fallback ignores tints (Lina is not green there), as before.
