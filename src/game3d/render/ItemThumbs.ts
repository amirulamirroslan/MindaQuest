/**
 * v2.20: item pictures for the wardrobe and the Hero panel. Each item is shown worn by the real hero (in the player's own colours),
 * framed on the part of the body it belongs to, on a backdrop that carries the item's rarity colour. Pictures are taken a few per frame
 * while a menu is open (never during play), kept until the player's colours change, and a stale picture is shown until the new one is
 * ready, so the cards never flash empty.
 */
import { CATALOG, itemById, type CosmeticItem } from '../cosmetics/catalog';
import { defaultCosmetics } from '../cosmetics/inventory';
import { resolveLoadout, type Loadout } from '../cosmetics/loadout';
import { RARITY_BG, type ThumbSource } from '../ui/thumbs';
import { SLOT_FRAME, type HeroSnapshot } from './HeroSnapshot';

export const THUMB_PX = 160;
/** Hero turn per slot: a cape is shown from behind at a slight angle; weapons and shields are shown from the side so their length or face reads. */
const THUMB_YAW: Partial<Record<string, number>> = { cape: -0.35, weapon: 1.2, offhand: -1.2 };

/** What the hero wears in a picture of `item`: the starter look with this one item swapped in (a two-handed weapon drops the off hand). */
export function thumbLoadout(item: CosmeticItem): Loadout {
  const base = resolveLoadout(defaultCosmetics());
  const items = { ...base.items, [item.slot]: item };
  if (items.weapon?.twoHanded) delete items.offhand;
  return { items, capeSwatch: 0, hatSwatch: 0 };
}

export class ItemThumbs implements ThumbSource {
  private readonly done = new Map<string, { url: string; sig: string }>();
  private readonly queue: string[] = [];
  private readonly subs = new Set<(id: string) => void>();
  private sig = '';
  /** Pictures that failed once are not retried until the look changes (no endless loop on a device that cannot read the canvas back). */
  private readonly failed = new Set<string>();

  constructor(private readonly snap: HeroSnapshot, private readonly canMake: () => boolean) {}

  /** Tell it what the hero's colours are now; pictures made with other colours are refreshed when next asked for. */
  setLookSignature(sig: string): void { if (sig !== this.sig) { this.sig = sig; this.failed.clear(); } }

  url(item: CosmeticItem): string | null {
    const hit = this.done.get(item.id);
    if ((!hit || hit.sig !== this.sig) && !this.failed.has(item.id) && !this.queue.includes(item.id)) this.queue.push(item.id);
    return hit?.url ?? null;
  }
  subscribe(fn: (id: string) => void): () => void { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  get pending(): number { return this.queue.length; }

  /** Takes up to `n` queued pictures. Call once per frame while a menu that shows items is open. */
  pump(n = 2): void {
    if (!this.canMake()) return;
    for (let k = 0; k < n && this.queue.length; k++) {
      const id = this.queue.shift()!; const item = itemById(id); if (!item) continue;
      const c = this.snap.render({ frame: SLOT_FRAME[item.slot] ?? 'body', size: THUMB_PX, bg: RARITY_BG[item.rarity], loadout: thumbLoadout(item), yaw: THUMB_YAW[item.slot] ?? 0.42 });
      if (!c) { this.failed.add(id); continue; }
      let url = ''; try { url = c.toDataURL('image/webp', 0.92); } catch { this.failed.add(id); continue; }
      this.done.set(id, { url, sig: this.sig }); for (const f of this.subs) f(id);
    }
  }
  /** For tests and a "warm everything" button: queue every catalogue item. */
  queueAll(): void { for (const i of CATALOG) this.url(i); }
}
