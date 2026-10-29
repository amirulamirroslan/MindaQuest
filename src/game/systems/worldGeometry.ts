export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1280;
export const RIVER_HALF_WIDTH = 84;

export function riverCenterX(y: number) {
  return 960 + Math.sin((y - 800) / 180) * 70 + Math.sin(y / 97) * 20;
}

export function isRiverCell(x: number, y: number) {
  if (y < -20 || y > WORLD_HEIGHT + 20) return false;
  const halfWidth = RIVER_HALF_WIDTH + Math.sin(y / 122) * 8;
  return Math.abs(x - riverCenterX(y)) <= halfWidth;
}

export function isBridgeZone(x: number, y: number) {
  if (y < 23 * 32 || y > 27 * 32) return false;
  return Math.abs(x - riverCenterX(800)) <= 158;
}

export function isBlockedByRiver(x: number, y: number) {
  return isRiverCell(x, y) && !isBridgeZone(x, y);
}

export function isBlockedByBrokenBridge(x: number, y: number, repaired: boolean) {
  if (repaired) return false;
  return Math.abs(x - riverCenterX(800)) <= 100 && Math.abs(y - 800) <= 66;
}

export function canOccupyWorldPoint(x: number, y: number, bridgeRepaired: boolean) {
  return !isBlockedByRiver(x, y) && !isBlockedByBrokenBridge(x, y, bridgeRepaired);
}

export function hasReachedEastBank(x: number, y: number) {
  return x > riverCenterX(y) + RIVER_HALF_WIDTH + 8;
}
