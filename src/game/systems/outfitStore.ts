import { defaultOutfit, sanitizeOutfit, type Outfit } from '../art/parts';

/** The hero's outfit is the one choice (besides mute) kept on the device. It is a handful of small numbers. */
export const OUTFIT_STORAGE_KEY = 'mindaquest.outfit.v1';

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

const browserStorage = (): Storage | undefined => {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
};

export function parseOutfit(text: string | null | undefined): Outfit {
  if (!text) return defaultOutfit();
  try { return sanitizeOutfit(JSON.parse(text)); } catch { return defaultOutfit(); }
}

export function loadOutfit(store: ReadStore | undefined = browserStorage()): Outfit {
  try { return parseOutfit(store?.getItem(OUTFIT_STORAGE_KEY)); } catch { return defaultOutfit(); }
}

/** Returns false when the browser refused (private mode, quota): the outfit still works for this session. */
export function saveOutfit(outfit: Outfit, store: WriteStore | undefined = browserStorage()): boolean {
  try { if (!store) return false; store.setItem(OUTFIT_STORAGE_KEY, JSON.stringify(sanitizeOutfit(outfit))); return true; } catch { return false; }
}
