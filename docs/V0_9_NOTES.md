# v0.9 notes: living world, game feel, sound

## Design rules followed
- Cosmetic only. Nothing here is read by collision, movement or the quest.
- No new files to ship: textures are drawn at boot (`art/effects.ts`), sound is synthesised at runtime.
- Cheap when off screen: plants outside the view are skipped; creatures are small fixed pools; particles use one pooled emitter per kind.
- The world keeps living during dialogue and the bridge repair (`updateAlive` runs before the early returns in `WorldScene.update`).
- `?perf=lite` (default on touch) thins leaves, butterflies, fireflies, fish, birds and particle counts; it never removes an effect.

## Where things live
| Thing | File |
|---|---|
| Day-night colours, `?tod=` parsing | `systems/dayNight.ts`, `effects/DayNightCycle.ts` |
| Wind (sway, leaves, wind sound) | `systems/wind.ts` |
| Leaf / bird / butterfly / fish motion rules | `systems/ambientLife.ts` (pure, tested) |
| Creature sprites, sway, fireflies | `effects/AmbientLife.ts` |
| Dust, sparkles, splashes | `effects/Fx.ts` |
| Footstep stride and surface | `systems/footsteps.ts` |
| Music plan, pitches, mix curves | `systems/audioMath.ts` |
| Web Audio synth engine | `audio/GameAudio.ts` |
| Textures for all of the above | `art/effects.ts` |

## Things worth knowing
- Colours are baked into the leaf, butterfly, dust, spark and glow textures because the Canvas fallback ignores tints.
- Sound envelopes must start at silence (`gain.value = 0.0001`): a GainNode defaults to 1, which let the first sample of a noise burst through as an occasional click. `tools/browser-checks/audio.py` has a regression check.
- Phaser 3.90 game objects have no skew, so sway is a small rotation about the base.
- Music: I-vi-IV-V in C, melody from C major pentatonic so no note can clash; every eighth bar is a rest for the melody.
- Mute is stored as `mindaquest.sound` in localStorage (the only thing the game stores).

## Checks
- `npm test` (unit tests for all pure logic).
- `tools/browser-checks/alive.py` (creatures, audio running, mute, time-of-day screenshots), `feel.py` (walk, pickup, bridge repair), `audio.py` (offline render: peaks, loudness, silence, click regression).
- Not yet done: judging the sound by ear, and a physical-phone test of night.

## Phone performance (v0.9.1)
- Reported: laggy on a phone. A CPU profile of the running game showed the new JavaScript is about 1% of frame time, so the cost is on the GPU/audio side and could not be pinned down without a device. Trims made: butterflies keep a fixed depth (a per-frame depth change forces a full scene re-sort), lite tier has fewer leaves/butterflies/fireflies/fish/birds, and lite audio uses about a third of the oscillators (single-oscillator pads, no echo or stereo-panner copies, one noise layer per grass step).
- To find the real cause on a device: open the game with `?fps` and then try `?fps&off=daynight`, `&off=sway`, `&off=music,ambience`, `&off=sound`, `&off=all` and compare the frame rate.
