# MindQuest v2.11 - phone character look + camera distance

**Phone showed a flatter character.** The chibi hero does load on phones (checked in emulated phone browsers). But phones start on the "low" graphics tier, and v2.10 turned the hero outline off on that tier, so the phone hero lost its dark outline and looked like an older, un-updated model. Now the outline is on in every tier (`quality.ts`); `?outline=0` still switches it off for frame-rate tests. The `?fps` meter also shows `hero chibi|simple|loading/old` so a wrong model is obvious.
**Stale model cache.** The kit URL now carries a build id (`chibi_kit.glb?v=<build>`; `__MQ_BUILD__` in `vite.config.ts`), so a phone that cached an older kit under the same file name fetches the new one after a new deploy.

**Camera too near.** Cause: when a bush, tree or wall was behind the hero, the camera was pulled in to as little as 1.6 m (giant head filling the screen). Now it never goes closer than 70 % of the layout distance (`MIN_CAMERA_RATIO`) and climbs steeply instead (`blockedCameraPitch`), looking down over the obstacle. Base distances are also larger: phone portrait 9.2 -> 11.2, phone landscape 5.9 -> 7.6, tablet 6.5 -> 7.3, desktop 6.3 -> 6.9.

Checks: 404 unit tests, `tsc -b`, production build; emulated phone portrait/landscape + desktop in headless Chromium, with the hero stood behind a tree (old build: camera 1.6 m; new: 5.1-7.8 m). Not measured on a real phone (frame rate with the outline on at low tier is untested; if a weak phone struggles, use `?outline=0`).
