import { TILE } from './forestLayout';
import { isBridgeZone, isRiverCell } from './worldGeometry';

export type Surface = 'grass' | 'dirt' | 'wood';

/** What is under the hero's feet: bridge deck, the dirt trail, or meadow grass. */
export function surfaceAt(x: number, y: number, trail: ReadonlySet<string>, bridgeRepaired: boolean): Surface {
  if (bridgeRepaired && isBridgeZone(x, y) && isRiverCell(x, y)) return 'wood';
  return trail.has(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`) ? 'dirt' : 'grass';
}

/** Ground distance covered per footstep. At the walking speed this is a little over four steps a second. */
export const STRIDE = 38;
export type Foot = -1 | 1;

/** Turns distance walked into footsteps, alternating left and right. Stopping re-arms it so the next walk starts with a step. */
export class FootstepTracker {
  private travelled = STRIDE * 0.6;
  private foot: Foot = -1;

  /** Feet that landed during `distance` ground units of walking (usually none or one; capped for long frames). */
  advance(distance: number): Foot[] {
    if (distance <= 0) { this.travelled = STRIDE * 0.6; return []; }
    this.travelled += distance;
    const landed: Foot[] = [];
    while (this.travelled >= STRIDE && landed.length < 2) {
      this.travelled -= STRIDE;
      landed.push(this.foot);
      this.foot = this.foot === -1 ? 1 : -1;
    }
    if (this.travelled >= STRIDE) this.travelled = 0;
    return landed;
  }
}
