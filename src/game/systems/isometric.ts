export interface Point2D {
  x: number;
  y: number;
}

/** Maps the existing orthogonal gameplay plane into the scene's angled view. */
export function projectIsometricPoint(x: number, y: number, horizontalOffset = 640): Point2D {
  return { x: (x - y) * 0.5 + horizontalOffset, y: (x + y) * 0.25 };
}

/** Converts screen-plane input into the existing gameplay coordinate axes. */
export function screenDirectionToWorld(x: number, y: number): Point2D {
  return { x: x + 2 * y, y: -x + 2 * y };
}
