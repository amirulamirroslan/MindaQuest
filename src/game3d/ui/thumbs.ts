/**
 * v2.20: where the interface gets item and portrait pictures. The pictures are real snapshots of the 3D hero (see
 * `render/HeroSnapshot.ts`); the interface only knows this tiny interface, so it stays free of three.js and easy to test.
 */
import type { CosmeticItem, Rarity } from '../cosmetics/catalog';
import { icon, itemIcon } from './icons';

export interface ThumbSource {
  /** The picture for an item as an image URL, or null while it is still being taken (a stale picture is returned until the new one is ready). */
  url(item: CosmeticItem): string | null;
  /** Called with the item id whenever a picture is ready; returns an unsubscribe function. */
  subscribe(fn: (id: string) => void): () => void;
}

/** Backdrop colours behind an item picture, by rarity (top, bottom): the same colour language as the card borders. */
export const RARITY_BG: Readonly<Record<Rarity, readonly [string, string]>> = {
  common: ['#f7ecd0', '#dcc592'],
  uncommon: ['#dcf3c8', '#93cc80'],
  rare: ['#d6e9ff', '#86b4ee'],
  epic: ['#eadbff', '#ab88e8'],
  legendary: ['#fff3bd', '#f4bb40'],
};

/**
 * The art window of an item card: the 3D picture when there is one, the drawn icon until it arrives (and when the picture cannot be
 * made, for example on a device with no WebGL read-back). Pictures are found again later by `data-thumb`, so a ready picture can be
 * swapped in without redrawing the whole panel.
 */
export function artHtml(item: CosmeticItem, src: ThumbSource | null, size: number): string {
  const url = src?.url(item) ?? null;
  const fallback = icon(itemIcon(item), Math.round(size * 0.55));
  return `<span class="mq-art mq-art-${item.rarity}" data-thumb="${item.id}" style="width:${size}px;height:${size}px">${url ? `<img src="${url}" alt="" draggable="false" width="${size}" height="${size}">` : `<span class="mq-art-ph">${fallback}</span>`}</span>`;
}

/** Swaps a ready picture into every art window for that item under `root`. */
export function applyThumb(root: ParentNode, item: CosmeticItem, url: string): void {
  root.querySelectorAll<HTMLElement>(`[data-thumb="${item.id}"]`).forEach(a => {
    let img = a.querySelector('img');
    if (!img) { a.textContent = ''; img = document.createElement('img'); img.alt = ''; img.draggable = false; a.appendChild(img); }
    img.width = img.height = a.clientWidth || 64; img.src = url;
  });
}
