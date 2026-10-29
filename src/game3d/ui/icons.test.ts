import { describe, expect, it } from 'vitest';
import { CATALOG } from '../cosmetics/catalog';
import { ICON_NAMES, icon, itemIcon, tabIcon } from './icons';

describe('icons (v2.9)', () => {
  it('every icon is a well-formed 24x24 svg', () => {
    for (const n of ICON_NAMES) { const s = icon(n); expect(s.startsWith('<svg'), n).toBe(true); expect(s).toContain('viewBox="0 0 24 24"'); expect(s.endsWith('</svg>'), n).toBe(true); expect(s).not.toMatch(/NaN|undefined/); }
  });
  it('every catalogue item and tab has an icon', () => {
    for (const i of CATALOG) expect(ICON_NAMES).toContain(itemIcon(i));
    for (const t of ['hair', 'outfit', 'legs', 'shoes', 'headgear', 'cape', 'weapon', 'offhand', 'colours', 'collections'] as const) expect(ICON_NAMES).toContain(tabIcon(t));
  });
});

import { SYMBOL_IDS, symbolSvg } from './puzzleSymbols';
import { PATTERN_SYMBOLS } from '../systems/runePuzzle';
describe('puzzle symbols (v2.16)', () => {
  it('every riddle symbol has a drawing and a name in both languages', async () => {
    expect([...SYMBOL_IDS]).toEqual([...PATTERN_SYMBOLS]);
    const { TEXT } = await import('../data/woodsText');
    for (const id of SYMBOL_IDS) { const s = symbolSvg(id); expect(s.startsWith('<svg')).toBe(true); expect(s).not.toMatch(/NaN|undefined/); expect(TEXT.en.puzzle.symbol[id]).toBeTruthy(); expect(TEXT.ms.puzzle.symbol[id]).toBeTruthy(); }
  });
});
