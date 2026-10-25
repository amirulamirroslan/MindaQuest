/**
 * Named sub-rectangles [x, y, width, height] for the bundled sprite sheets. The sheets are irregular, so
 * the old fixed 32x32 slicing cut some rocks in half and pointed at empty cells (invisible obstacles).
 */
export type Rect = readonly [number, number, number, number];

export const LOG_FRAMES = {
  'stump-big': [0, 0, 64, 64],
  'stump-fork': [65, 5, 62, 53],
  'log-long': [127, 2, 63, 26],
  'log-branch': [127, 31, 62, 29],
  'log-post': [194, 5, 27, 57],
  'stump-s1': [323, 7, 25, 23],
  'stump-s2': [324, 35, 26, 28],
  'stump-s3': [353, 3, 30, 22],
  'stump-s4': [354, 37, 27, 26],
} as const satisfies Record<string, Rect>;

export const ROCK_FRAMES = {
  'rock-a': [4, 6, 21, 22],
  'rock-wide': [34, 6, 45, 25],
  'rock-tall': [0, 37, 16, 25],
} as const satisfies Record<string, Rect>;

export const LEAF_FRAMES = {
  'tuft-1': [3, 3, 9, 12],
  'tuft-2': [21, 5, 7, 7],
  'tuft-3': [3, 19, 9, 12],
  'tuft-4': [2, 35, 11, 11],
  'tuft-5': [21, 35, 7, 10],
  'tuft-6': [2, 51, 11, 11],
  'tuft-7': [3, 67, 11, 11],
  'tuft-8': [2, 83, 11, 11],
  'tuft-9': [34, 83, 12, 12],
} as const satisfies Record<string, Rect>;

export const BUSH_FRAMES = {
  'bush-big': [1, 7, 62, 57],
  'bush-wide-1': [195, 3, 55, 27],
  'bush-wide-2': [195, 33, 55, 29],
  'bush-small-1': [257, 3, 28, 29],
  'bush-small-2': [259, 38, 28, 23],
  'bush-small-3': [289, 36, 31, 26],
  'bush-tiny': [359, 42, 18, 15],
} as const satisfies Record<string, Rect>;

export type LogFrame = keyof typeof LOG_FRAMES;
export type RockFrame = keyof typeof ROCK_FRAMES;
export type LeafFrame = keyof typeof LEAF_FRAMES;
export type BushFrame = keyof typeof BUSH_FRAMES;

export const ROCK_FRAME_NAMES = Object.keys(ROCK_FRAMES) as RockFrame[];
export const LEAF_FRAME_NAMES = Object.keys(LEAF_FRAMES) as LeafFrame[];
export const BUSH_FRAME_NAMES = Object.keys(BUSH_FRAMES) as BushFrame[];

/**
 * The bush sheet repeats every bush four more times with white, yellow, blue and red flowers (64 px apart).
 * Overlay frames are named "<bush>:1".."<bush>:4" and drawn on top of the matching bush.
 */
export const FLOWER_VARIANTS = 4;
export const BUSH_FLOWER_FRAMES: Record<string, Rect> = Object.fromEntries(
  Object.entries(BUSH_FRAMES).flatMap(([name, [x, y, w, h]]) =>
    Array.from({ length: FLOWER_VARIANTS }, (_, k) => [`${name}:${k + 1}`, [x, y + 64 * (k + 1), w, h] as Rect]),
  ),
);
