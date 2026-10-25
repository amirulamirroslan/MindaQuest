# v2.30 headless checks

Needs `playwright` and `sharp` (global or local) plus a Chromium. From the project root:

    npm run build && npx vite preview --port 4173 &
    cd tools/browser-checks/v2_30
    NODE_PATH=$(npm root -g) node flow.cjs      # arch trigger, quiz wrong/right, tide songs, XP, save + reload
    NODE_PATH=$(npm root -g) node shore.cjs     # shore HUD, tide line, clock/coin questions at phone sizes
    NODE_PATH=$(npm root -g) node combat.cjs    # drives crab/gull to telegraph and recover, screenshots them
    NODE_PATH=$(npm root -g) node cosm4.cjs     # cosmetics on the real hero (head/full body, 3 angles)
    NODE_PATH=$(npm root -g) node perf.cjs      # draw calls / triangles per area and quality

Set `MQ_CHROMIUM` to a Chromium binary and `MQ_URL` if the defaults do not fit. They create `shots/` in the working folder.
These run on software GL: they check behaviour and counts, never real frame rate. Scripts use the `?debug` hook (`window.__mq3d`).
