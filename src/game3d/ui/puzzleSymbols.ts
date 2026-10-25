/**
 * v2.16: the picture-pattern symbols of the Rune Stone riddles, drawn as original SVGs (they were emoji, which look different on every
 * device). Eight pictures that differ in SHAPE as well as colour, so no riddle depends on colour alone. Same 24 grid, dark-brown outline
 * and warm palette as the other hand-drawn icons.
 */
export const SYMBOL_IDS = ['blossom', 'leaf', 'mushroom', 'star', 'moon', 'butterfly', 'ladybug', 'apple'] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];
export const isSymbolId = (s: string): s is SymbolId => (SYMBOL_IDS as readonly string[]).includes(s);

const O = '#3b2414', S = `stroke="${O}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
const ART: Record<SymbolId, string> = {
  blossom: `<g ${S} fill="#ff9fc4"><circle cx="12" cy="5.800" r="3.600"/><circle cx="18.200" cy="10.300" r="3.600"/><circle cx="15.800" cy="17.500" r="3.600"/><circle cx="8.200" cy="17.500" r="3.600"/><circle cx="5.800" cy="10.300" r="3.600"/></g><circle cx="12" cy="12.200" r="3.200" fill="#ffd24a" ${S}/>`,
  leaf: `<path d="M4 20C3.500 11 8.500 4.500 20.500 3.500c.8 11-5 17.500-13 16.500z" fill="#6cc07a" ${S}/><path d="M4 20C8.500 14.500 12.500 10.500 17 7.500M10.500 13.500l.2-4M13 11.500l3.600.2" fill="none" stroke="${O}" stroke-width="1.400" stroke-linecap="round"/>`,
  mushroom: `<path d="M3.500 12.500C3.500 7 7.300 3.500 12 3.500s8.500 3.500 8.500 9z" fill="#ee5a4a" ${S}/><path d="M9 12.500v5.200c0 2 1.400 3 3 3s3-1 3-3v-5.200" fill="#fff4d6" ${S}/><circle cx="8.300" cy="9" r="1.500" fill="#fff"/><circle cx="14.200" cy="7.500" r="1.800" fill="#fff"/><circle cx="16.800" cy="10.800" r="1.100" fill="#fff"/>`,
  star: `<path d="M12 2.800l2.700 5.600 6.100.8-4.500 4.200 1.100 6.100L12 16.600 6.600 19.500l1.100-6.100L3.200 9.200l6.100-.8z" fill="#ffd24a" ${S}/>`,
  moon: `<path d="M19.500 14.800A8.500 8.500 0 1 1 9.200 4.500a7 7 0 0 0 10.300 10.300z" fill="#9ec5ff" ${S}/><circle cx="15" cy="15.500" r="1.200" fill="#6d98e0"/>`,
  butterfly: `<path d="M12 11.500C10 5 4.500 3.500 3.500 6.500s1.500 6.500 8.500 5z" fill="#b184f0" ${S}/><path d="M12 11.500C14 5 19.500 3.500 20.500 6.500s-1.500 6.500-8.500 5z" fill="#b184f0" ${S}/><path d="M12 12.500C9.500 13 5.500 14.500 6.500 18s4.500 2 5.500-5.500z" fill="#d7b8ff" ${S}/><path d="M12 12.500c2.500.5 6.500 2 5.500 5.500s-4.500 2-5.500-5.500z" fill="#d7b8ff" ${S}/><path d="M12 8v9.500" stroke="${O}" stroke-width="2" stroke-linecap="round"/><path d="M12 8c-.5-2-1.500-3-2.500-3.500M12 8c.5-2 1.500-3 2.500-3.500" fill="none" stroke="${O}" stroke-width="1.200" stroke-linecap="round"/>`,
  ladybug: `<circle cx="12" cy="6" r="3" fill="${O}"/><ellipse cx="12" cy="14" rx="7.500" ry="7" fill="#ee5a4a" ${S}/><path d="M12 7.500v13" stroke="${O}" stroke-width="1.500"/><circle cx="8.500" cy="12" r="1.500" fill="${O}"/><circle cx="15.500" cy="12" r="1.500" fill="${O}"/><circle cx="9" cy="16.800" r="1.200" fill="${O}"/><circle cx="15" cy="16.800" r="1.200" fill="${O}"/>`,
  apple: `<path d="M12 7.500C9.500 5.800 4 6.500 4 12.500c0 4.800 3.200 8.700 5.800 8.700 1 0 1.500-.6 2.200-.6s1.200.6 2.200.6c2.600 0 5.800-3.900 5.800-8.700 0-6-5.500-6.700-8-5z" fill="#ee5a4a" ${S}/><path d="M12 7.500c0-2 .5-3.200 1.800-4.200" fill="none" ${S}/><path d="M13.500 5.500c1.200-1.800 3.200-2.200 4.800-1.800-.5 1.800-2.500 2.800-4.800 1.800z" fill="#6cc07a" ${S}/><path d="M7.200 12c.2-1.300.9-2.100 1.900-2.400" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.500" stroke-linecap="round"/>`,
};
/** The picture as an inline svg (decorative: the parent button carries the accessible name). */
export const symbolSvg = (id: SymbolId, size = 30): string => `<svg class="mq-i mq-sym" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${ART[id]}</svg>`;
