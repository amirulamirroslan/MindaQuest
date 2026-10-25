/**
 * Labels every pixel of the Adventurer atlas with the outfit part it belongs to (pure, unit-tested).
 *
 * The pack is flattened, but its palette is disciplined, so colour alone separates most parts. Two parts share
 * a colour and are split by where they sit in the frame instead: the hood/hair and the tunic are the same ochre
 * (head above `HOOD_SPLIT`, body below), and boots are the same leather as the pack and belt (feet below
 * `BOOT_SPLIT`). The mask is computed at boot from the atlas pixels; no derived image file is stored or shipped.
 */
import { NO_PART, PART_ID, type Region } from './parts';
import { rgbToHsv } from './recolour';

/** Fraction of the figure's height, from its top, where hood/hair ends and the tunic begins. */
export const HOOD_SPLIT = 0.41;
/** Fraction of the figure's height below which leather is a boot rather than the pack, belt or straps. */
export const BOOT_SPLIT = 0.8;

type Hsv3 = [number, number, number];

/** The part for one pixel. `inHead` / `inFeet` say where in the figure it sits. Outline pixels are `NO_PART`. */
export function classifyPixel([h, s, v]: Hsv3, inHead: boolean, inFeet: boolean): number {
  if (v < 0.12) return NO_PART;
  if (h >= 0.03 && h <= 0.11 && s >= 0.15 && s <= 0.52 && v >= 0.5) return PART_ID.skin;
  if (s < 0.18 && v >= 0.2) return PART_ID.steel;
  if (h >= 0.085 && h <= 0.145 && s > 0.55) return inHead ? PART_ID.hood : PART_ID.tunic;
  if ((h < 0.085 || h > 0.97) && s > 0.45) return inFeet ? PART_ID.boots : PART_ID.gear;
  if (h >= 0.5 && h <= 0.66 && s > 0.3) return inHead ? PART_ID.eyes : PART_ID.trousers;
  return NO_PART;
}

/** Fills `mask` (one byte per pixel of the whole atlas) for the frame at `frame`. */
export function classifyFrame(data: Uint8ClampedArray, mask: Uint8Array, width: number, frame: Region) {
  let top = Infinity, bottom = -Infinity;
  for (let y = frame.y; y < frame.y + frame.h; y++) {
    for (let x = frame.x; x < frame.x + frame.w; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (top > bottom) return;
  const height = bottom - top + 1;
  const headEnd = top + HOOD_SPLIT * height, feetStart = top + BOOT_SPLIT * height;
  for (let y = top; y <= bottom; y++) {
    for (let x = frame.x; x < frame.x + frame.w; x++) {
      const p = y * width + x, i = p * 4;
      if (data[i + 3] === 0) continue;
      mask[p] = classifyPixel(rgbToHsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255), y < headEnd, y >= feetStart);
    }
  }
}

export function buildPartMask(data: Uint8ClampedArray, width: number, frames: readonly Region[]): Uint8Array {
  const mask = new Uint8Array(data.length / 4);
  for (const frame of frames) classifyFrame(data, mask, width, frame);
  return mask;
}
