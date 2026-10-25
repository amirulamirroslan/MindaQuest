# v2.15 – Emoji interface icons replaced with SVG

Audit: the project is vanilla TypeScript + DOM (no React), so `lucide-react` does not apply; the framework-free `lucide` package (ISC) was added instead,
bundled by Vite (no runtime requests). Only used icons are imported (tree-shaken).

Replaced (all in 3D UI): level-up / reward / new-outfit toasts, dialogue next/done arrows, end-screen moon, map goal star, Rune Stone title, close,
count-again, "flown away" mark, results sparkles/moon, result stars, wardrobe "original colour" swatch.
`ui/icons.ts` is the single mapping: Lucide outline icons for navigation/actions/status (`currentColor`, one stroke width, drop-shadow for legibility;
filled red heart and gold star for emphasis). The hand-drawn coloured set stays for ITEM pictures (hair, clothes, capes, weapons...) that Lucide lacks.
`ui/noEmoji.test.ts` guards against regressions.

Intentionally left (not interface icons):
- 2D Phaser game welcome banner ornament (`src/game/scenes/MainMenuScene.ts`), canvas text decoration in the legacy 2D mode.

## Follow-up (v2.16 content)
The Rune Stone pattern pictures are now eight original SVG drawings (`ui/puzzleSymbols.ts`: flower, leaf, mushroom, star, moon, butterfly, ladybird, apple), distinct by shape as well as colour, with English and Malay accessible names. `PATTERN_SYMBOLS` holds ids instead of emoji; riddle logic is unchanged.
