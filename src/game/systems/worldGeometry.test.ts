import { describe, expect, it } from 'vitest';
import { canOccupyWorldPoint, hasReachedEastBank, isBlockedByBrokenBridge, isBlockedByRiver, isBridgeZone, isRiverCell, riverCenterX } from './worldGeometry';

describe('Emerald Wilds river collision', () => {
  it('blocks the river surface away from the crossing', () => {
    const center = riverCenterX(560);
    expect(isRiverCell(center, 560)).toBe(true);
    expect(isBlockedByRiver(center, 560)).toBe(true);
  });

  it('allows the player to cross on the timber bridge', () => {
    const center = riverCenterX(800);
    expect(isRiverCell(center, 800)).toBe(true);
    expect(isBridgeZone(center, 800)).toBe(true);
    expect(isBlockedByRiver(center, 800)).toBe(false);
  });

  it('keeps water solid immediately beyond the bridge deck', () => {
    const center = riverCenterX(800);
    expect(isBlockedByRiver(center, 700)).toBe(true);
    expect(isBlockedByRiver(center, 900)).toBe(true);
  });

  it('recognizes the far bank only after clearing the river edge', () => {
    const center = riverCenterX(800);
    expect(hasReachedEastBank(center + 80, 800)).toBe(false);
    expect(hasReachedEastBank(center + 100, 800)).toBe(true);
  });

  it('blocks the broken bridge deck while leaving the repaired crossing open', () => {
    const center = riverCenterX(800);
    expect(isBlockedByBrokenBridge(center, 800, false)).toBe(true);
    expect(canOccupyWorldPoint(center, 800, false)).toBe(false);
    expect(isBlockedByBrokenBridge(center, 800, true)).toBe(false);
    expect(canOccupyWorldPoint(center, 800, true)).toBe(true);
  });
});
