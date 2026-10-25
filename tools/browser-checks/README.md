# Browser checks (optional)

Headless-Chromium scripts. They are not part of `npm test`. The old 2D-game scripts (verify, flow, measure, wardrobe, alive, feel, hero) were removed with the 2D game in v2.17.

```powershell
pip install playwright ; playwright install chromium
npm run build ; npm run preview -- --port 4173
```

- `audio.py` - renders the synthesised audio offline and checks it.
- `*.mjs` - the 3D / chibi hero checks and screenshot scripts; see `README-chibi.md`.

Headless runs are software-rendered, so frame rates from them are not representative of a phone.
