Headless-browser checks used for v2.8 (Node, no Playwright download needed):

    npm i --no-save puppeteer-core @sparticuz/chromium    # the browser binary ships inside the npm tarball
    npm run build
    node tools/browser-checks/chibi-check.mjs dist /tmp/shots

Loads the built game at desktop / phone-portrait / phone-landscape, checks the chibi rig is active, opens the customisation panel,
checks tab count, panel-in-viewport and tap-target size, and saves screenshots. SwiftShader (software WebGL) is slow: expect minutes.
