import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** v2.15: interface icons are SVGs. This guards the 3D UI files and the strings against emoji or text-glyph icons creeping back in. */
const GLYPHS = /[←-⇿⌀-⏿■-➿⬀-⯿☀-⛿️\u{1F000}-\u{1FAFF}]/u;
const dir = join(process.cwd(), 'src/game3d/ui');
const files = [...readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(dir, f)), join(process.cwd(), 'src/game3d/data/woodsText.ts'), join(process.cwd(), 'src/game3d/Game3D.ts'), join(process.cwd(), 'src/game3d/systems/runePuzzle.ts'), join(process.cwd(), 'src/game3d/input/Input3D.ts')];

describe('no emoji interface icons', () => {
  for (const f of files) it(f.split('/').slice(-2).join('/'), () => {
    const bad = readFileSync(f, 'utf8').split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => GLYPHS.test(l));
    expect(bad.map(([n, l]) => `${n}: ${l.trim().slice(0, 80)}`)).toEqual([]);
  });
});
