/**
 * The cosmetics catalogue: every wearable item as DATA (pure, unit-tested; no three.js, no DOM).
 *
 * An item is a shape taken from the chibi kit (`public/assets/chibi/chibi_kit.glb`, see `render/chibi/ChibiRig.ts`) or a small
 * code-made prop. Colours are separate: the eight swatch parts of the old wardrobe (`game/art/parts.ts`) plus a cape and a hat tint.
 *
 * Access is how an item becomes owned: free, a hero level, a quest reward, or `premium`. Premium items are DATA ONLY: nothing in
 * this project sells anything, takes payment or contacts a server. They show as locked ("coming soon") until a payment system is
 * approved and built.
 */

export type CosmeticSlot = 'hair' | 'outfit' | 'legs' | 'shoes' | 'headgear' | 'cape' | 'weapon' | 'offhand';
export const COSMETIC_SLOTS: readonly CosmeticSlot[] = ['hair', 'outfit', 'legs', 'shoes', 'headgear', 'cape', 'weapon', 'offhand'];
/** Slots that may be empty. Hair, outfit, legs and shoes always hold an item. */
export const OPTIONAL_SLOTS: readonly CosmeticSlot[] = ['headgear', 'cape', 'weapon', 'offhand'];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export type CollectionId = 'starter' | 'silver-guard' | 'highland' | 'moon-mages' | 'rangers' | 'woods' | 'hollow' | 'shore';
export interface Collection { id: CollectionId; name: { en: string; ms: string } }
export const COLLECTIONS: readonly Collection[] = [
  { id: 'starter', name: { en: 'Glade Heroes', ms: 'Wira Lembah' } },
  { id: 'silver-guard', name: { en: 'Silver Guard', ms: 'Pengawal Perak' } },
  { id: 'highland', name: { en: 'Highland Clan', ms: 'Puak Tanah Tinggi' } },
  { id: 'moon-mages', name: { en: 'Moon Mages', ms: 'Ahli Sihir Bulan' } },
  { id: 'rangers', name: { en: 'Shadow Rangers', ms: 'Renjer Bayang' } },
  { id: 'woods', name: { en: 'Whispering Woods', ms: 'Hutan Berbisik' } },
  { id: 'hollow', name: { en: 'Crystal Hollow', ms: 'Gua Hablur' } },
  { id: 'shore', name: { en: 'Moonwake Shore', ms: 'Pantai Moonwake' } },
];

export type Access =
  | { type: 'free' }
  | { type: 'level'; level: number }
  | { type: 'quest'; unlock: string }
  /** Reserved for a future, approved store. Never grantable by anything in this build. */
  | { type: 'premium'; sku: string };

export type WeaponClass = 'sword1h' | 'axe1h' | 'dagger' | 'sword2h' | 'axe2h' | 'staff' | 'wand';
export type OffhandKind = 'shield' | 'weapon' | 'book' | 'lantern';
export type ShoeProp = 'shoe-trail' | 'shoe-cuff' | 'shoe-fur' | 'shoe-leaf' | 'shoe-guard' | 'shoe-moon';
export type ProcProp = 'leaf-crown' | 'lantern' | 'sea-crown' | 'lighthouse-lantern' | ShoeProp;

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: { en: string; ms: string };
  rarity: Rarity;
  collection: CollectionId;
  access: Access;
  /** Kit mesh names this item shows. hair: [head]; outfit: [body, armL, armR]; legs: [legL, legR]; others: [node]. Empty for procedural props. */
  kit: readonly string[];
  /** Hex colour multiplied into the item after any wardrobe tint (makes a recoloured variant of a shared mesh). */
  variantTint?: number;
  proc?: ProcProp;
  weapon?: WeaponClass;
  offhand?: OffhandKind;
  /** A main-hand weapon held in both hands (blocks the off hand). */
  twoHanded?: boolean;
  /** The item is a spare 1-handed weapon in the off hand (dual wield). */
  offhandWeapon?: boolean;
}

const n = (en: string, ms: string) => ({ en, ms });
const free: Access = { type: 'free' };
const lvl = (level: number): Access => ({ type: 'level', level });

const set = (c: string, slotParts: readonly string[]) => slotParts.map(p => `${c}_${p}`);
const BODY = ['Body', 'ArmLeft', 'ArmRight'], LEGS = ['LegLeft', 'LegRight'];

export const CATALOG: readonly CosmeticItem[] = [
  // ---- hairstyles (each is a full head: face + hair)
  { id: 'hair-ranger', slot: 'hair', name: n('Ranger Ponytail', 'Tocang Renjer'), rarity: 'common', collection: 'starter', access: free, kit: ['Rogue_Head'] },
  { id: 'hair-crop', slot: 'hair', name: n('Brave Crop', 'Potongan Berani'), rarity: 'common', collection: 'starter', access: free, kit: ['Knight_Head'] },
  { id: 'hair-moon', slot: 'hair', name: n('Moon Bob', 'Bob Bulan'), rarity: 'common', collection: 'starter', access: free, kit: ['Mage_Head'] },
  { id: 'hair-clan', slot: 'hair', name: n('Clan Beard', 'Janggut Puak'), rarity: 'uncommon', collection: 'highland', access: lvl(2), kit: ['Barbarian_Head'] },
  { id: 'hair-hood', slot: 'hair', name: n('Ranger Hood', 'Tudung Renjer'), rarity: 'uncommon', collection: 'rangers', access: lvl(3), kit: ['Rogue_Head_Hooded'] },
  // ---- clothing and armour
  { id: 'outfit-ranger', slot: 'outfit', name: n('Ranger Tunic', 'Tunik Renjer'), rarity: 'common', collection: 'starter', access: free, kit: set('Rogue', BODY) },
  { id: 'outfit-moon', slot: 'outfit', name: n('Moon Robe', 'Jubah Bulan'), rarity: 'common', collection: 'moon-mages', access: free, kit: set('Mage', BODY) },
  { id: 'outfit-clan', slot: 'outfit', name: n('Clan Furs', 'Bulu Puak'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: set('Barbarian', BODY) },
  { id: 'sailor-jacket', slot: 'outfit', name: n('Sailor Jacket', 'Jaket Pelaut'), rarity: 'rare', collection: 'shore', access: { type: 'quest', unlock: 'sailor-jacket' }, kit: set('Knight', BODY), variantTint: 0x5c8fd0 },
  { id: 'outfit-guard', slot: 'outfit', name: n('Silver Guard Armour', 'Perisai Pengawal Perak'), rarity: 'rare', collection: 'silver-guard', access: lvl(4), kit: set('Knight', BODY) },
  // ---- trousers (the kit boots come with them; boot colour and shoe shape are the separate Shoes tab)
  { id: 'legs-ranger', slot: 'legs', name: n('Ranger Trousers', 'Seluar Renjer'), rarity: 'common', collection: 'starter', access: free, kit: set('Rogue', LEGS) },
  { id: 'legs-moon', slot: 'legs', name: n('Moon Trousers', 'Seluar Bulan'), rarity: 'common', collection: 'moon-mages', access: free, kit: set('Mage', LEGS) },
  { id: 'legs-clan', slot: 'legs', name: n('Clan Trousers', 'Seluar Puak'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: set('Barbarian', LEGS) },
  { id: 'sailor-trousers', slot: 'legs', name: n('Sailor Trousers', 'Seluar Pelaut'), rarity: 'rare', collection: 'shore', access: { type: 'quest', unlock: 'sailor-trousers' }, kit: set('Knight', LEGS), variantTint: 0xd4e4f8 },
  { id: 'legs-guard', slot: 'legs', name: n('Silver Greaves', 'Pelindung Kaki Perak'), rarity: 'rare', collection: 'silver-guard', access: lvl(4), kit: set('Knight', LEGS) },
  // ---- shoe shapes (v2.10): code-made pieces added to the kit boot; the boot colour is picked in the same tab
  { id: 'shoes-trail', slot: 'shoes', name: n('Trail Boots', 'But Denai'), rarity: 'common', collection: 'starter', access: free, kit: [], proc: 'shoe-trail' },
  { id: 'shoes-cuff', slot: 'shoes', name: n('Cuffed Boots', 'But Berlipat'), rarity: 'common', collection: 'rangers', access: free, kit: [], proc: 'shoe-cuff' },
  { id: 'shoes-leaf', slot: 'shoes', name: n('Leaf Wraps', 'Balut Daun'), rarity: 'common', collection: 'woods', access: free, kit: [], proc: 'shoe-leaf' },
  { id: 'shoes-fur', slot: 'shoes', name: n('Fur Boots', 'But Berbulu'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: [], proc: 'shoe-fur' },
  { id: 'shoes-moon', slot: 'shoes', name: n('Moon Slippers', 'Selipar Bulan'), rarity: 'rare', collection: 'moon-mages', access: lvl(4), kit: [], proc: 'shoe-moon' },
  { id: 'shoes-guard', slot: 'shoes', name: n('Silver Toe-caps', 'Penutup Jari Perak'), rarity: 'rare', collection: 'silver-guard', access: lvl(4), kit: [], proc: 'shoe-guard' },
  // ---- hats and helmets
  { id: 'leaf-crown', slot: 'headgear', name: n('Leaf crown', 'Mahkota daun'), rarity: 'common', collection: 'woods', access: free, kit: [], proc: 'leaf-crown' },
  { id: 'helm-guard', slot: 'headgear', name: n('Silver Helm', 'Topi Keledar Perak'), rarity: 'rare', collection: 'silver-guard', access: lvl(4), kit: ['Knight_Helmet'] },
  { id: 'hat-bear', slot: 'headgear', name: n('Bear Hood', 'Tudung Beruang'), rarity: 'rare', collection: 'highland', access: lvl(4), kit: ['Barbarian_Hat'] },
  { id: 'hat-moon', slot: 'headgear', name: n('Moon Hat', 'Topi Bulan'), rarity: 'epic', collection: 'moon-mages', access: lvl(5), kit: ['Mage_Hat'] },
  { id: 'hat-sun', slot: 'headgear', name: n('Sunlit Wizard Hat', 'Topi Ahli Sihir Mentari'), rarity: 'legendary', collection: 'moon-mages', access: { type: 'premium', sku: 'hat-sun' }, kit: ['Mage_Hat'], variantTint: 0xffc83a },
  // ---- Crystal Hollow reward (v2.22): the Moon Hat shape in glacier blue, earned by touching the Heartstone
  { id: 'crystal-hat', slot: 'headgear', name: n('Crystal Hat', 'Topi Hablur'), rarity: 'legendary', collection: 'hollow', access: { type: 'quest', unlock: 'crystal-hat' }, kit: ['Mage_Hat'], variantTint: 0x7fe3ff },
  // ---- Moonwake Shore (v2.29)
  { id: 'sea-crown', slot: 'headgear', name: n('Sea-glass Crown', 'Mahkota Kaca Laut'), rarity: 'epic', collection: 'shore', access: lvl(10), kit: [], proc: 'sea-crown' },
  { id: 'sailor-cap', slot: 'headgear', name: n('Sailor Cap', 'Topi Pelaut'), rarity: 'rare', collection: 'shore', access: { type: 'quest', unlock: 'sailor-cap' }, kit: ['Knight_Helmet'], variantTint: 0xe6efff },
  // ---- capes and backs
  { id: 'cape-ranger', slot: 'cape', name: n('Ranger Cape', 'Jubah Renjer'), rarity: 'common', collection: 'rangers', access: free, kit: ['Rogue_Cape'] },
  { id: 'cape-guard', slot: 'cape', name: n('Guard Cape', 'Jubah Pengawal'), rarity: 'uncommon', collection: 'silver-guard', access: lvl(3), kit: ['Knight_Cape'] },
  { id: 'cape-fur', slot: 'cape', name: n('Clan Cloak', 'Jubah Puak'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: ['Barbarian_Cape'] },
  { id: 'cape-moon', slot: 'cape', name: n('Moon Cape', 'Jubah Bulan'), rarity: 'rare', collection: 'moon-mages', access: lvl(4), kit: ['Mage_Cape'] },
  { id: 'mossy-cloak', slot: 'cape', name: n('Mossy cloak', 'Jubah berlumut'), rarity: 'epic', collection: 'woods', access: { type: 'quest', unlock: 'mossy-cloak' }, kit: ['Rogue_Cape'], variantTint: 0xb4d46a },
  // ---- Crystal Hollow reward (v2.28): the Moon Cape shape in violet crystal, earned by calming the Hollow Warden (a cape tint, the same proven mechanism as the Mossy Cloak)
  { id: 'warden-mantle', slot: 'cape', name: n('Warden\'s Mantle', 'Jubah Penjaga'), rarity: 'epic', collection: 'hollow', access: { type: 'quest', unlock: 'warden-mantle' }, kit: ['Mage_Cape'], variantTint: 0xc59bff },
  // ---- main-hand weapons
  { id: 'sword-hero', slot: 'weapon', name: n('Hero Sword', 'Pedang Wira'), rarity: 'common', collection: 'starter', access: free, kit: ['1H_Sword'], weapon: 'sword1h' },
  { id: 'dagger-ranger', slot: 'weapon', name: n('Ranger Dagger', 'Keris Renjer'), rarity: 'common', collection: 'rangers', access: free, kit: ['Knife'], weapon: 'dagger' },
  { id: 'wand-moon', slot: 'weapon', name: n('Moon Wand', 'Tongkat Bulan'), rarity: 'common', collection: 'moon-mages', access: free, kit: ['1H_Wand'], weapon: 'wand' },
  { id: 'axe-clan', slot: 'weapon', name: n('Clan Axe', 'Kapak Puak'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: ['1H_Axe'], weapon: 'axe1h' },
  { id: 'sword-great', slot: 'weapon', name: n('Great Sword', 'Pedang Agung'), rarity: 'rare', collection: 'silver-guard', access: lvl(4), kit: ['2H_Sword'], weapon: 'sword2h', twoHanded: true },
  { id: 'axe-great', slot: 'weapon', name: n('Great Axe', 'Kapak Agung'), rarity: 'rare', collection: 'highland', access: lvl(5), kit: ['2H_Axe'], weapon: 'axe2h', twoHanded: true },
  { id: 'staff-moon', slot: 'weapon', name: n('Moon Staff', 'Tongkat Panjang Bulan'), rarity: 'epic', collection: 'moon-mages', access: lvl(5), kit: ['2H_Staff'], weapon: 'staff', twoHanded: true },
  // ---- off hand: shields, spare weapons, a book, a lantern
  { id: 'shield-round', slot: 'offhand', name: n('Round Shield', 'Perisai Bulat'), rarity: 'common', collection: 'silver-guard', access: free, kit: ['Round_Shield'], offhand: 'shield' },
  { id: 'shield-badge', slot: 'offhand', name: n('Badge Shield', 'Perisai Lencana'), rarity: 'uncommon', collection: 'silver-guard', access: lvl(2), kit: ['Badge_Shield'], offhand: 'shield' },
  { id: 'shield-square', slot: 'offhand', name: n('Tower Shield', 'Perisai Menara'), rarity: 'uncommon', collection: 'silver-guard', access: lvl(3), kit: ['Rectangle_Shield'], offhand: 'shield' },
  { id: 'shield-clan', slot: 'offhand', name: n('Clan Shield', 'Perisai Puak'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: ['Barbarian_Round_Shield'], offhand: 'shield' },
  { id: 'shield-spike', slot: 'offhand', name: n('Spiked Shield', 'Perisai Berduri'), rarity: 'rare', collection: 'silver-guard', access: lvl(4), kit: ['Spike_Shield'], offhand: 'shield' },
  { id: 'book-spell', slot: 'offhand', name: n('Spellbook', 'Buku Sihir'), rarity: 'rare', collection: 'moon-mages', access: lvl(3), kit: ['Spellbook'], offhand: 'book' },
  { id: 'sword-spare', slot: 'offhand', name: n('Spare Sword', 'Pedang Kedua'), rarity: 'uncommon', collection: 'starter', access: lvl(2), kit: ['1H_Sword_Offhand'], offhand: 'weapon', offhandWeapon: true },
  { id: 'axe-spare', slot: 'offhand', name: n('Spare Axe', 'Kapak Kedua'), rarity: 'uncommon', collection: 'highland', access: lvl(3), kit: ['1H_Axe_Offhand'], offhand: 'weapon', offhandWeapon: true },
  { id: 'dagger-spare', slot: 'offhand', name: n('Spare Dagger', 'Keris Kedua'), rarity: 'uncommon', collection: 'rangers', access: lvl(2), kit: ['Knife_Offhand'], offhand: 'weapon', offhandWeapon: true },
  // ---- Moonwake Shore rewards (v2.29): the Sailor set (outfit, trousers, cap: shared kit meshes in sea colours) and the Lighthouse Lantern (a code-made prop); the Sea-glass Crown is a level prize
  { id: 'lighthouse-lantern', slot: 'offhand', name: n('Lighthouse Lantern', 'Tanglung Rumah Api'), rarity: 'epic', collection: 'shore', access: { type: 'quest', unlock: 'lighthouse-lantern' }, kit: [], proc: 'lighthouse-lantern', offhand: 'lantern' },
  { id: 'glow-lantern', slot: 'offhand', name: n('Glow lantern', 'Tanglung bercahaya'), rarity: 'common', collection: 'woods', access: free, kit: [], proc: 'lantern', offhand: 'lantern' },
];

const BY_ID = new Map(CATALOG.map(i => [i.id, i]));
export const itemById = (id: string): CosmeticItem | undefined => BY_ID.get(id);
export const itemsInSlot = (slot: CosmeticSlot): CosmeticItem[] => CATALOG.filter(i => i.slot === slot);
export const rarityRank = (r: Rarity): number => RARITIES.indexOf(r);

/** What a new player wears. */
export const DEFAULT_EQUIPPED: Readonly<Record<CosmeticSlot, string | null>> = {
  hair: 'hair-ranger', outfit: 'outfit-ranger', legs: 'legs-ranger', shoes: 'shoes-trail', headgear: null, cape: null, weapon: 'sword-hero', offhand: null,
};
