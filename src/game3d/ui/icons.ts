/**
 * One consistent icon set for the whole 3D game UI (v2.9). Replaces the emoji glyphs, which looked different on every device and could
 * not be styled. Every icon is drawn in the same style: a 24 x 24 grid, a warm cream or gold fill, and a dark-brown outline, so they sit
 * together on the wood-and-gold panels. Pure strings (no DOM), unit-tested for shape.
 */
import {
  ArrowUpRight, Backpack, Crown, Footprints, Palette, Scissors, Shield, Shirt, Trophy, Ban, BookOpen, Check, ChevronDown, ChevronRight, Dices, Flag, Flower2, Gem, Gift, Heart, Lock, Map as MapIcon, MessageCircle, Minus, Moon,
  Pause, Plus, RotateCcw, RotateCw, Sparkles, Sprout, Star, Sword as SwordIcon, UserRound, Volume2, VolumeX, Wind, X,
} from 'lucide';
import type { IconNode } from 'lucide';
import type { CosmeticItem, CosmeticSlot, WeaponClass } from '../cosmetics/catalog';

const OUT = '#3b2414', CREAM = '#fff4d6', GOLD = '#ffd24a', GOLD_D = '#d9961c', STEEL = '#d8dde2', STEEL_D = '#8e98a3', WOOD = '#a8703c', RED = '#ee5a4a', GREEN = '#6cc07a', BLUE = '#5aa9ee', PURPLE = '#a982e8';
const stroke = `stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;

/** Wraps path markup in a 24 x 24 svg. `size` is the CSS pixel size. */
export const svg = (inner: string, size = 24, cls = 'mq-i'): string => `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${inner}</svg>`;

const P = {
  heart: `<path d="M12 21C5 15.6 2.5 12.2 2.5 8.6 2.5 5.9 4.6 4 7 4c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 2.4 0 4.5 1.9 4.5 4.6 0 3.6-2.5 7-9.5 12.4z" fill="${RED}" ${stroke}/><path d="M6.2 7.6c.5-1 1.4-1.5 2.4-1.4" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/>`,
  heartFull: `<path d="M12 21.2C5 15.8 2.2 12.3 2.2 8.5 2.2 5.6 4.4 3.6 7 3.6c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 2.6 0 4.8 2 4.8 4.9 0 3.800-2.800 7.300-9.800 12.700z" fill="url(#mq-g-heart)" stroke="#5a1410" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.600 8.200c.4-1.700 1.800-2.500 3.200-2.300" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.800" stroke-linecap="round"/><circle cx="7.300" cy="10.600" r=".9" fill="#fff" fill-opacity=".55"/>`,
  heartHollow: `<path d="M12 21.2C5 15.8 2.2 12.3 2.2 8.5 2.2 5.6 4.4 3.6 7 3.6c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 2.6 0 4.8 2 4.8 4.9 0 3.800-2.800 7.300-9.800 12.700z" fill="#2a1a10" fill-opacity=".75" stroke="#8a6a4a" stroke-opacity=".8" stroke-width="1.500" stroke-linejoin="round"/>`,
  heartEmpty: `<path d="M12 21C5 15.6 2.5 12.2 2.5 8.6 2.5 5.9 4.6 4 7 4c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 2.4 0 4.5 1.9 4.5 4.6 0 3.6-2.5 7-9.5 12.4z" fill="#5b4a3d" fill-opacity=".55" stroke="${OUT}" stroke-opacity=".7" stroke-width="1.6" stroke-linejoin="round"/>`,
  star: `<path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6 6.6 19.5l1.1-6.1L3.2 9.2l6.1-.8z" fill="${GOLD}" ${stroke}/>`,
  map: `<path d="M3.5 6.2 9 4l6 2.2L20.5 4v13.8L15 20l-6-2.2-5.5 2.2z" fill="${CREAM}" ${stroke}/><path d="M9 4v13.8M15 6.2V20" fill="none" ${stroke}/><circle cx="12" cy="11.6" r="1.7" fill="${RED}" stroke="${OUT}" stroke-width="1.2"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round"/>`,
  pause: `<rect x="6" y="4.5" width="4.2" height="15" rx="1.6" fill="${CREAM}" ${stroke}/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.6" fill="${CREAM}" ${stroke}/>`,
  shirt: `<path d="M8.5 3.5L2.5 7l2.4 4 2.6-1.3V20.5h9V9.7l2.6 1.3 2.4-4-6-3.5c-.6 1.2-1.9 2-3.5 2s-2.9-.8-3.5-2z" fill="${GOLD}" ${stroke}/>`,
  soundOn: `<path d="M3.5 9.5h4l5-4v13l-5-4h-4z" fill="${CREAM}" ${stroke}/><path d="M16 9c1.5 1.7 1.5 4.3 0 6M18.7 6.5c3 3.2 3 7.8 0 11" fill="none" stroke="${CREAM}" stroke-width="1.8" stroke-linecap="round"/>`,
  soundOff: `<path d="M3.5 9.5h4l5-4v13l-5-4h-4z" fill="${CREAM}" ${stroke}/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="${RED}" stroke-width="2" stroke-linecap="round"/>`,
  scroll: `<path d="M7 3.5h10.500a2.500 2.500 0 0 1 2.500 2.500v12a2.500 2.500 0 0 1-2.500 2.500H7a2.500 2.500 0 0 1-2.500-2.500V6A2.500 2.500 0 0 1 7 3.500z" fill="#f6e3b4" ${stroke}/><path d="M8 8.500h8M8 12h8M8 15.500h5" stroke="${OUT}" stroke-width="1.700" stroke-linecap="round"/><path d="M15.500 14.500l1.800 1.800 3-3.500" fill="none" stroke="#2f9a4a" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1.500 1)"/>`,
  chevron: `<path d="M6 9l6 6 6-6" fill="none" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="${GOLD}" ${stroke}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" ${stroke}/><circle cx="12" cy="15.5" r="1.4" fill="${OUT}"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  gift: `<rect x="3.5" y="9" width="17" height="11" rx="2" fill="${PURPLE}" ${stroke}/><rect x="2.5" y="6.5" width="19" height="4" rx="1.5" fill="#c4a6f2" ${stroke}/><path d="M12 6.5V20" stroke="${OUT}" stroke-width="1.6"/><path d="M12 6.5C10 2.5 6 3.5 7.4 6c.7 1.1 2.7.6 4.6.5zM12 6.5c2-4 6-3 4.6-.5-.7 1.1-2.7.6-4.6.5z" fill="${GOLD}" ${stroke}/>`,
  sword: `<path d="M19.5 3.5l1 4-9.2 9.2-2.4-2.4z" fill="${STEEL}" ${stroke}/><path d="M7.2 12.6l4.2 4.2" stroke="${OUT}" stroke-width="1.6"/><path d="M5.2 14.8l4 4" stroke="${GOLD_D}" stroke-width="3" stroke-linecap="round"/><path d="M4.6 19.4l-1.6 1.6" stroke="${WOOD}" stroke-width="2.6" stroke-linecap="round"/>`,
  dagger: `<path d="M18.5 4.5l1 3.2-6.6 6.6-2.2-2.2z" fill="${STEEL}" ${stroke}/><path d="M7.5 12l4.5 4.5" stroke="${GOLD_D}" stroke-width="3" stroke-linecap="round"/><path d="M6.6 17.4l-2.2 2.2" stroke="${WOOD}" stroke-width="2.6" stroke-linecap="round"/>`,
  axe: `<path d="M12.5 5.5l6 6" stroke="${WOOD}" stroke-width="2.8" stroke-linecap="round"/><path d="M5 20l9-9" stroke="${WOOD}" stroke-width="2.8" stroke-linecap="round"/><path d="M9 4.5c3-1.6 7.6-.8 10 1.5 2.3 2.4 3 7 1.5 10l-3.2-3.2c.5-1.5.2-3.200-.9-4.300S12.200 7.800 10.800 7.800z" fill="${STEEL}" ${stroke}/>`,
  wand: `<path d="M4 20L15 9" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/><path d="M17.5 2.5l1.1 2.6 2.7 1.1-2.700 1.100-1.100 2.700-1.100-2.700-2.700-1.100 2.700-1.100z" fill="${GOLD}" ${stroke}/>`,
  staff: `<path d="M6 21L16 8" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="6.5" r="3.6" fill="${BLUE}" ${stroke}/><circle cx="15.800" cy="5.300" r="1" fill="#fff" opacity=".8"/>`,
  shield: `<path d="M12 2.8l7.5 2.5v6c0 5-3.200 8.300-7.500 10-4.300-1.700-7.500-5-7.500-10v-6z" fill="${BLUE}" ${stroke}/><path d="M12 5.800v13.500M7 10.500h10" stroke="#fff" stroke-opacity=".55" stroke-width="1.600" stroke-linecap="round"/>`,
  book: `<path d="M4 5.500c3-1.500 5.500-1.300 8 .5 2.500-1.800 5-2 8-.5v13c-3-1.500-5.500-1.300-8 .5-2.500-1.800-5-2-8-.5z" fill="${PURPLE}" ${stroke}/><path d="M12 6v13" stroke="${OUT}" stroke-width="1.500"/>`,
  lantern: `<path d="M9 5.500c0-2 6-2 6 0" fill="none" ${stroke}/><rect x="7" y="5.500" width="10" height="2.500" rx="1" fill="#5b4a3d" ${stroke}/><rect x="8" y="8" width="8" height="10" rx="2" fill="#ffe08a" ${stroke}/><rect x="7" y="18" width="10" height="2.500" rx="1" fill="#5b4a3d" ${stroke}/>`,
  hair: `<path d="M12 3C7 3 4.500 6.800 4.500 11.500c0 3.500.8 6 2.500 8.500l1.500-4.500c1.500.8 2.500 1 3.500 1s2-.2 3.500-1L17 20c1.700-2.500 2.500-5 2.500-8.500C19.500 6.800 17 3 12 3z" fill="#b5703a" ${stroke}/><path d="M8 11c3 0 6.500-1.500 8.500-4" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.600" stroke-linecap="round"/>`,
  legs: `<path d="M6.500 3.500h11l1 17h-5.500l-1-10-1 10H5.500z" fill="#7a63c2" ${stroke}/><path d="M6.500 6.500h11" stroke="${OUT}" stroke-width="1.400" opacity=".6"/>`,
  boots: `<path d="M7 3.500h7v8c0 1.200 1 2 2.500 2.500 2 .6 3 1.600 3 3.200V19.500H4.500V3.500z" fill="${WOOD}" ${stroke}/><path d="M4.500 16.500h15" stroke="${OUT}" stroke-width="1.500" opacity=".6"/>`,
  hat: `<path d="M12 2.500l4.500 12.500H7.500z" fill="${PURPLE}" ${stroke}/><ellipse cx="12" cy="16" rx="9" ry="3.200" fill="#8a64d0" ${stroke}/><path d="M8.500 13.500h7" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>`,
  helm: `<path d="M4.500 13.500C4.500 8 8 4.500 12 4.500s7.500 3.500 7.500 9v6h-15z" fill="${STEEL}" ${stroke}/><path d="M12 4.500v15M8 12.500h8" stroke="${STEEL_D}" stroke-width="1.800" stroke-linecap="round"/>`,
  crown: `<path d="M3.500 18.500l-1-10 5 4 4.500-7 4.500 7 5-4-1 10z" fill="${GREEN}" ${stroke}/><circle cx="12" cy="14.500" r="1.500" fill="#aaf4ea" stroke="${OUT}" stroke-width="1.100"/>`,
  cape: `<path d="M8 3.500h8l3 2.500-2 14.500c-2 1-3.500 1-5 .2-1.500.8-3 .8-5-.2L5 6z" fill="${RED}" ${stroke}/><path d="M8 3.500c1 2 7 2 8 0" fill="none" ${stroke}/><circle cx="12" cy="5.500" r="1.300" fill="${GOLD}" stroke="${OUT}" stroke-width="1"/>`,
  palette: `<path d="M12 3C6.500 3 2.500 7 2.500 12s4 9 8.500 9c2 0 2.500-1.500 1.500-2.700-1-1.300 0-2.800 1.700-2.800H17c2.600 0 4.500-1.600 4.500-4.300C21.500 6.600 17.500 3 12 3z" fill="#f3d8a8" ${stroke}/><circle cx="7.500" cy="11" r="1.600" fill="${RED}"/><circle cx="10.500" cy="7.200" r="1.600" fill="${GOLD}"/><circle cx="15.300" cy="7.500" r="1.600" fill="${GREEN}"/><circle cx="17.500" cy="11.500" r="1.600" fill="${BLUE}"/>`,
  trophy: `<path d="M7 3.500h10v5.500c0 3-2.200 5-5 5s-5-2-5-5z" fill="${GOLD}" ${stroke}/><path d="M7 5.500H3.500c0 3 1.500 4.500 3.800 4.800M17 5.500h3.500c0 3-1.500 4.500-3.800 4.800" fill="none" ${stroke}/><path d="M12 14v4M8 20.500h8" stroke="${OUT}" stroke-width="2.200" stroke-linecap="round"/>`,
  none: `<circle cx="12" cy="12" r="8" fill="none" stroke="${OUT}" stroke-width="1.800" stroke-dasharray="3 2.600" opacity=".7"/><path d="M6.500 17.500l11-11" stroke="${OUT}" stroke-width="1.800" stroke-linecap="round" opacity=".7"/>`,
  dodge: `<path d="M3 8h9M2 12.500h7M4 17h9" stroke="${CREAM}" stroke-width="2.200" stroke-linecap="round" opacity=".85"/><path d="M13 5.500c4.500-.5 8 1.600 8 5s-3 5-6 5-4.500-1.200-4.500-3 1.700-3 3.200-3" fill="none" stroke="${CREAM}" stroke-width="2.400" stroke-linecap="round"/>`,
  spin: `<path d="M12 4.500a7.500 7.500 0 1 0 7.500 7.500" fill="none" stroke="${CREAM}" stroke-width="2.600" stroke-linecap="round"/><path d="M19.800 4.500l.3 5.600-5.600-.6z" fill="${CREAM}" ${stroke}/><circle cx="12" cy="12" r="2.200" fill="${GOLD}" ${stroke}/>`,
  talk: `<path d="M4.500 5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.500 3.500V17H4.500a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="#eafff0" ${stroke}/><circle cx="8" cy="11" r="1.200" fill="${OUT}"/><circle cx="12" cy="11" r="1.200" fill="${OUT}"/><circle cx="16" cy="11" r="1.200" fill="${OUT}"/>`,
  attack: `<path d="M20.500 3.500l.5 5.500-11.500 11.500-3.500-3.500z" fill="${STEEL}" ${stroke}/><path d="M6.500 12.500l5 5" stroke="${OUT}" stroke-width="1.600"/><path d="M4.500 14.500l5 5" stroke="${GOLD_D}" stroke-width="3.400" stroke-linecap="round"/><path d="M4 20l-1.500 1.500" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/>`,
  dice: `<rect x="3.500" y="3.500" width="17" height="17" rx="4" fill="${CREAM}" ${stroke}/><circle cx="8.500" cy="8.500" r="1.500" fill="${OUT}"/><circle cx="15.500" cy="8.500" r="1.500" fill="${OUT}"/><circle cx="12" cy="12" r="1.500" fill="${OUT}"/><circle cx="8.500" cy="15.500" r="1.500" fill="${OUT}"/><circle cx="15.500" cy="15.500" r="1.500" fill="${OUT}"/>`,
  rotL: `<path d="M19 12a7 7 0 1 1-2.2-5.100" fill="none" stroke="${OUT}" stroke-width="2.400" stroke-linecap="round"/><path d="M19.500 3.500v5h-5" fill="none" stroke="${OUT}" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 .5)"/>`,
  rotR: `<path d="M5 12a7 7 0 1 0 2.200-5.100" fill="none" stroke="${OUT}" stroke-width="2.400" stroke-linecap="round"/><path d="M4.500 3.500v5h5" fill="none" stroke="${OUT}" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 .5)"/>`,
  plus: `<path d="M12 5v14M5 12h14" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`,
  minus: `<path d="M5 12h14" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`,
  bag: `<path d="M8.5 6.5C8.5 3.800 15.500 3.800 15.500 6.500" fill="none" ${stroke}/><path d="M7 6.500h10c2.200 2.200 3.500 5.500 3.500 9 0 3-1.500 5-4 5h-9c-2.500 0-4-2-4-5 0-3.500 1.300-6.800 3.500-9z" fill="${WOOD}" ${stroke}/><path d="M7.500 12.500c3 1.600 6 1.600 9 0" fill="none" stroke="${OUT}" stroke-width="1.500" opacity=".6"/><rect x="10" y="12" width="4" height="3.600" rx="1" fill="${GOLD}" ${stroke}/>`,
  hero: `<circle cx="12" cy="8" r="4.200" fill="#ffd9b0" ${stroke}/><path d="M4.500 21c0-4.700 3.300-7.500 7.500-7.500s7.500 2.800 7.500 7.500z" fill="${GREEN}" ${stroke}/><path d="M7.600 7.200c.6-3 7-3.800 8.800 0-2.200-.9-6.200-.9-8.800 0z" fill="#e0643a" ${stroke}/>`,
  petal: `<path d="M12 3c4.500 2.500 6.800 6 5.500 10-1 3.200-3.500 5.200-5.500 8-2-2.800-4.500-4.800-5.500-8C5.200 9 7.500 5.500 12 3z" fill="#ff9fe0" ${stroke}/><path d="M12 6.500v11" stroke="#fff" stroke-opacity=".7" stroke-width="1.400" stroke-linecap="round"/>`,
  sprout: `<path d="M12 21v-8" stroke="${OUT}" stroke-width="2.400" stroke-linecap="round"/><path d="M12 13C12 8 8.500 5.500 4 6c0 4.500 3 7.500 8 7z" fill="${GREEN}" ${stroke}/><path d="M12 11.500c0-4 3-6.500 8-6.500 0 4.500-3.200 7-8 6.500z" fill="#8fdc8a" ${stroke}/>`,
  rune: `<path d="M12 2.800l7.500 3v7.700c0 4.200-3 7-7.500 8.700-4.500-1.700-7.500-4.500-7.500-8.700V5.800z" fill="#c6ccd2" ${stroke}/><path d="M9 8.500l3 3.500-3 4M15 8.500v8" fill="none" stroke="#5a8f9a" stroke-width="1.900" stroke-linecap="round" stroke-linejoin="round"/>`,
  flag: `<path d="M6 21V4" stroke="${OUT}" stroke-width="2.400" stroke-linecap="round"/><path d="M6.500 4.500h12l-2.500 4 2.500 4h-12z" fill="${RED}" ${stroke}/>`,
  reset: `<path d="M5.500 12a6.500 6.500 0 1 0 2-4.700" fill="none" stroke="${OUT}" stroke-width="2.600" stroke-linecap="round"/><path d="M4 3.500v5.500h5.500" fill="none" stroke="${OUT}" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/>`,
} as const;


/**
 * v2.15: interface icons (navigation, actions, status, feedback) are Lucide outline icons (ISC licence), bundled through the build
 * (no runtime requests): one 24 grid, one stroke width, `currentColor` so a button's CSS colour sets active/disabled/selected looks.
 * Health and level are the two filled ones (red heart, gold star) for emphasis. The hand-drawn coloured set below stays for the
 * ITEM pictures (weapons, hair, clothes, capes...) that Lucide has no equivalent for, so item art and interface icons do not compete.
 */
const LU_STROKE = 2.2;
const LUCIDE: Partial<Record<string, { node: IconNode; fill?: string; stroke?: string }>> = {
  heart: { node: Heart, fill: RED, stroke: OUT }, heartEmpty: { node: Heart, fill: '#5b4a3d', stroke: OUT }, star: { node: Star, fill: GOLD, stroke: OUT },
  map: { node: MapIcon }, close: { node: X }, pause: { node: Pause }, soundOn: { node: Volume2 }, soundOff: { node: VolumeX }, scroll: { node: BookOpen },
  chevron: { node: ChevronDown }, chevronRight: { node: ChevronRight }, lock: { node: Lock }, check: { node: Check }, gift: { node: Gift }, plus: { node: Plus }, minus: { node: Minus },
  reset: { node: RotateCcw }, rotL: { node: RotateCcw }, rotR: { node: RotateCw }, talk: { node: MessageCircle }, attack: { node: SwordIcon }, spin: { node: RotateCw }, dodge: { node: Wind },
  dice: { node: Dices }, flag: { node: Flag }, bag: { node: Backpack }, hero: { node: UserRound }, petal: { node: Flower2 }, sprout: { node: Sprout }, rune: { node: Gem },
  tabHair: { node: Scissors }, tabShirt: { node: Shirt }, tabShoes: { node: Footprints }, tabHat: { node: Crown }, tabCape: { node: Flag }, tabShield: { node: Shield }, tabPalette: { node: Palette }, tabTrophy: { node: Trophy },
  moon: { node: Moon }, sparkles: { node: Sparkles }, arrowUpRight: { node: ArrowUpRight }, ban: { node: Ban },
};
const attrs = (a: Record<string, string | number>): string => Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('');
function luSvg(def: { node: IconNode; fill?: string; stroke?: string }, size: number, cls: string): string {
  const inner = def.node.map(([tag, a]) => `<${tag}${attrs(a as Record<string, string | number>)}/>`).join('');
  return `<svg class="${cls} mq-lu" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${def.fill ?? 'none'}" stroke="${def.stroke ?? 'currentColor'}" stroke-width="${LU_STROKE}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

export type IconName = keyof typeof P | 'tabHair' | 'tabShirt' | 'tabShoes' | 'tabHat' | 'tabCape' | 'tabShield' | 'tabPalette' | 'tabTrophy' | 'moon' | 'sparkles' | 'chevronRight' | 'arrowUpRight' | 'ban';
export const ICON_NAMES = [...new Set([...Object.keys(P), ...Object.keys(LUCIDE)])] as IconName[];
export const icon = (name: IconName, size = 24, cls = 'mq-i'): string => { const lu = LUCIDE[name]; return lu ? luSvg(lu, size, cls) : svg((P as Record<string, string>)[name], size, cls); };

const WEAPON_ICON: Record<WeaponClass, IconName> = { sword1h: 'sword', sword2h: 'sword', axe1h: 'axe', axe2h: 'axe', dagger: 'dagger', wand: 'wand', staff: 'staff' };
const SLOT_ICON: Record<CosmeticSlot | 'colours' | 'collections', IconName> = {
  hair: 'tabHair', outfit: 'tabShirt', legs: 'legs', shoes: 'tabShoes', headgear: 'tabHat', cape: 'tabCape', weapon: 'attack', offhand: 'tabShield', colours: 'tabPalette', collections: 'tabTrophy',
};
export const tabIcon = (id: CosmeticSlot | 'colours' | 'collections'): IconName => SLOT_ICON[id];

/** The icon for one cosmetic item: by weapon class, off-hand kind, or helmet vs hat. */
export function itemIcon(i: CosmeticItem): IconName {
  switch (i.slot) {
    case 'weapon': return i.weapon ? WEAPON_ICON[i.weapon] : 'sword';
    case 'offhand': return i.offhand === 'book' ? 'book' : i.offhand === 'lantern' ? 'lantern' : i.offhand === 'weapon' ? (i.id.includes('dagger') ? 'dagger' : i.id.includes('axe') ? 'axe' : 'sword') : 'shield';
    case 'headgear': return i.proc === 'leaf-crown' ? 'crown' : i.id.startsWith('helm') ? 'helm' : 'hat';
    case 'outfit': return i.collection === 'silver-guard' ? 'shield' : 'shirt';
    default: return SLOT_ICON[i.slot];
  }
}
