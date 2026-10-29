/** Words for the Crystal Hollow (v2.22), English and Bahasa Melayu. The same-shape test in hollowText.test.ts checks both languages. */
import type { Lang } from './woodsText';
import { ECHO_ORDER, type EchoColor } from '../systems/hollowLayout';
import { SHARDLING_COUNT, SHARD_COUNT, TABLET_COUNT, type HollowState } from '../systems/hollowQuest';

export interface HollowStrings {
  name: string;
  colour: Record<EchoColor, string>;
  /** Objective card lines. `{order}` is the colours in order, `{n}` and `{total}` are numbers. */
  objective: { findMural: string; strike: string; warden: string; heart: string; shards: string; peace: string; gate: string; shardlings: string; glimReport: string; tablets: string };
  toast: {
    enter: string; muralRead: string; shard: string; allShards: string; echoRight: string; echoWrong: string; doorOpen: string; glowcap: string; secretOpen: string;
    heartDone: string; back: string;
    shardling: string; allShardlings: string; wardenWakes: string; weakSpot: string; wardenDown: string; heartGuarded: string; glimMet: string; glimDone: string; tablet: string; allTablets: string;
  };
  ui: { use: string; touchHeart: string; strike: string };
  /** v2.28: the Hollow Warden's health bar name. */
  boss: string;
  /** v2.28: Glim the lantern sprite. `ask` is the sum he sets once every Shardling is calm (`{a}` and `{b}`). */
  glim: { name: string; intro: string[]; waiting: string[]; report: string[]; ask: { add: string; subtract: string }; thanks: string[] };
  /** v2.28: the three Moon Tablets: a name and lines each (they teach the Warden's moves). */
  tablet: { name: string; lines: [string[], string[], string[]] };
  /** Names on the Hollow map. */
  labels: Record<'gate' | 'prism' | 'grotto' | 'pool' | 'door' | 'heart' | 'pink' | 'nook' | 'mural' | 'glim', string>;
  mapTitle: string;
  /** Elder Tok Wan's two lines once the woods quest is complete (replacing the old gate lines). */
  elderComplete: string[];
  elderAfter: string[];
}

export const HOLLOW_TEXT: Record<Lang, HollowStrings> = {
  en: {
    name: 'Crystal Hollow',
    colour: { gold: 'Gold', blue: 'Blue', pink: 'Pink' },
    objective: {
      findMural: 'Read the Echo mural in the Lantern Cavern',
      strike: 'Strike the Echo Crystals: {order} ({n}/{total})',
      warden: 'The Heart Door is open! Face the Hollow Warden',
      heart: 'The Warden is calm. Touch the Heartstone',
      shards: 'Find the hidden Moon Shards ({n}/{total})',
      peace: 'The Crystal Hollow shines. Explore as you like!',
      gate: 'Step through the Moonlit Gate into the Crystal Hollow',
      shardlings: 'Calm the Shardlings for Glim ({n}/{total})',
      glimReport: 'Tell Glim the Shardlings are calm',
      tablets: 'Find the hidden Moon Tablets ({n}/{total})',
    },
    toast: {
      enter: 'Welcome to the Crystal Hollow! Something here has gone dark.',
      muralRead: 'The mural shows the order: {order}.',
      shard: 'Moon Shard {n}/{total}',
      allShards: 'All the Moon Shards! The Hollow sparkles for you.',
      echoRight: 'The crystal sings!',
      echoWrong: 'Not that one. The crystals fade. Try the mural order again!',
      doorOpen: 'The Heart Door opens! Go north.',
      glowcap: 'A glowcap lights up ({n}/{total})',
      secretOpen: 'A crystal wall shatters. A secret nook!',
      heartDone: 'The Heartstone glows! The Hollow is bright again.',
      back: 'Back in the Whispering Woods.',
      shardling: 'Shardling calmed ({n}/{total})',
      allShardlings: 'Every Shardling is calm! Go and tell Glim.',
      wardenWakes: 'The Hollow Warden wakes! Watch the glowing shapes.',
      weakSpot: 'Its heart is showing! Strike now: blows count double.',
      wardenDown: 'The Warden is calm. The Heartstone is free!',
      heartGuarded: 'The Warden guards the Heartstone.',
      glimMet: 'Glim has asked for your help.',
      glimDone: 'Glim is happy! His lantern glows.',
      tablet: 'Moon Tablet {n}/{total}',
      allTablets: 'All the Moon Tablets! You know the cave\'s secrets.',
    },
    ui: { use: 'Use', touchHeart: 'Touch the Heartstone', strike: 'Strike' },
    boss: 'Hollow Warden',
    glim: {
      name: 'Glim',
      intro: ['Oh! A visitor! I am Glim, a lantern sprite. My light went dim when the Heartstone went dark.', 'Now the little Shardlings roll about the cave, grumpy and sparkly. They guard the roads to the far crystals.', 'Calm all six of them, and come back to me. Dodge their rolls, then tap them with your sword. You will be fine!'],
      waiting: ['Six Shardlings are grumpy, and you have calmed {n}. They nest by the east and west roads, in the Echo Pool and in the Glowcap Grotto.', 'Watch for the glowing line on the floor. When it fills, they roll!'],
      report: ['You did it! Every Shardling is calm! My lantern is warming up.', 'Now let me count my light-seeds, and you can count with me.'],
      ask: { add: 'I had {a} light-seeds, and found {b} more. How many are there now?', subtract: 'I had {a} light-seeds, and {b} rolled away. How many are left?' },
      thanks: ['Thank you, hero! My lantern glows bright again.', 'There are three Moon Tablets hidden in the cave. They hold secrets about the Warden. Look in the quiet corners!'],
    },
    tablet: {
      name: 'Moon Tablet',
      lines: [
        ['Carved long ago: \'When the Warden spreads its light in a ring, run beyond the edge, or roll through it as it lands.\''],
        ['Carved long ago: \'Crystals fall where you stand, so keep moving. The long beam is slow to aim, so step to the side.\''],
        ['Carved long ago: \'When the Warden grows tired, its dimmed heart shows. Strike then, and every blow counts double.\''],
      ],
    },
    labels: { gate: 'Way out', prism: 'Moon Prism', grotto: 'Glowcap Grotto', pool: 'Echo Pool', door: 'Heart Door', heart: 'Heartstone', pink: 'Pink nook', nook: 'Secret nook', mural: 'Mural', glim: 'Glim' },
    mapTitle: 'Crystal Hollow map',
    elderComplete: ['The Moonlit Gate shines for you, hero. Beyond it lies the Crystal Hollow, a cave that has been dark for a hundred years.', 'Wear the Mossy Cloak if you like, and step through when you are ready!'],
    elderAfter: ['The Crystal Hollow is glowing again. You did that, hero!', 'The Moonlit Gate is always open for you. Moon Shards still hide in the cave, if you want to hunt for them.'],
  },
  ms: {
    name: 'Gua Hablur',
    colour: { gold: 'Emas', blue: 'Biru', pink: 'Merah jambu' },
    objective: {
      findMural: 'Baca mural Gema di Gua Tanglung',
      strike: 'Ketuk Hablur Gema: {order} ({n}/{total})',
      warden: 'Pintu Hati sudah terbuka! Hadapi Penjaga Gua',
      heart: 'Penjaga sudah tenang. Sentuh Batu Hati',
      shards: 'Cari Serpihan Bulan yang tersembunyi ({n}/{total})',
      peace: 'Gua Hablur bersinar. Jelajahlah sesuka hati!',
      gate: 'Masuk melalui Pintu Cahaya Bulan ke Gua Hablur',
      shardlings: 'Tenangkan Si Serpih untuk Glim ({n}/{total})',
      glimReport: 'Beritahu Glim bahawa Si Serpih sudah tenang',
      tablets: 'Cari Papan Bulan yang tersembunyi ({n}/{total})',
    },
    toast: {
      enter: 'Selamat datang ke Gua Hablur! Sesuatu di sini sudah menjadi gelap.',
      muralRead: 'Mural menunjukkan susunan: {order}.',
      shard: 'Serpihan Bulan {n}/{total}',
      allShards: 'Semua Serpihan Bulan! Gua ini berkilauan untuk kamu.',
      echoRight: 'Hablur itu menyanyi!',
      echoWrong: 'Bukan yang itu. Hablur malap semula. Cuba ikut susunan mural!',
      doorOpen: 'Pintu Hati terbuka! Pergi ke utara.',
      glowcap: 'Satu cendawan menyala ({n}/{total})',
      secretOpen: 'Dinding hablur pecah. Ada ruang rahsia!',
      heartDone: 'Batu Hati bersinar! Gua ini terang semula.',
      back: 'Kembali ke Hutan Berbisik.',
      shardling: 'Satu Si Serpih sudah tenang ({n}/{total})',
      allShardlings: 'Semua Si Serpih sudah tenang! Pergi beritahu Glim.',
      wardenWakes: 'Penjaga Gua sudah bangun! Perhatikan bentuk yang bercahaya.',
      weakSpot: 'Hatinya kelihatan! Serang sekarang: setiap pukulan dikira dua kali.',
      wardenDown: 'Penjaga sudah tenang. Batu Hati sudah bebas!',
      heartGuarded: 'Penjaga Gua mengawal Batu Hati.',
      glimMet: 'Glim meminta bantuan kamu.',
      glimDone: 'Glim gembira! Tanglungnya menyala.',
      tablet: 'Papan Bulan {n}/{total}',
      allTablets: 'Semua Papan Bulan! Kamu tahu rahsia gua ini.',
    },
    ui: { use: 'Guna', touchHeart: 'Sentuh Batu Hati', strike: 'Ketuk' },
    boss: 'Penjaga Gua',
    glim: {
      name: 'Glim',
      intro: ['Oh! Ada tetamu! Saya Glim, pari-pari tanglung. Cahaya saya malap apabila Batu Hati menjadi gelap.', 'Kini Si Serpih yang kecil bergolek di dalam gua, merajuk dan berkilauan. Mereka menjaga jalan ke hablur yang jauh.', 'Tenangkan keenam-enamnya, kemudian kembali kepada saya. Elak golekan mereka, kemudian ketuk dengan pedang kamu. Kamu pasti boleh!'],
      waiting: ['Enam Si Serpih sedang merajuk, dan kamu sudah menenangkan {n}. Mereka bersarang di jalan timur dan barat, di Kolam Gema dan di Gua Cendawan.', 'Perhatikan garisan bercahaya di lantai. Apabila ia penuh, mereka akan bergolek!'],
      report: ['Kamu berjaya! Semua Si Serpih sudah tenang! Tanglung saya mula hangat.', 'Sekarang biar saya kira biji cahaya saya, dan kamu boleh mengira bersama saya.'],
      ask: { add: 'Saya ada {a} biji cahaya, dan jumpa {b} lagi. Berapakah jumlahnya sekarang?', subtract: 'Saya ada {a} biji cahaya, dan {b} bergolek pergi. Berapakah yang tinggal?' },
      thanks: ['Terima kasih, wira! Tanglung saya bersinar terang semula.', 'Ada tiga Papan Bulan yang tersembunyi di dalam gua. Ia menyimpan rahsia tentang Penjaga. Carilah di sudut yang sunyi!'],
    },
    tablet: {
      name: 'Papan Bulan',
      lines: [
        ['Diukir lama dahulu: \'Apabila Penjaga menebarkan cahaya berbentuk cincin, berlarilah melepasi tepinya, atau bergulinglah melaluinya ketika ia mendarat.\''],
        ['Diukir lama dahulu: \'Hablur jatuh di tempat kamu berdiri, jadi terus bergerak. Pancaran panjang lambat disasarkan, jadi melangkahlah ke tepi.\''],
        ['Diukir lama dahulu: \'Apabila Penjaga letih, hatinya yang malap kelihatan. Seranglah ketika itu, dan setiap pukulan dikira dua kali.\''],
      ],
    },
    labels: { gate: 'Jalan keluar', prism: 'Prisma Bulan', grotto: 'Gua Cendawan', pool: 'Kolam Gema', door: 'Pintu Hati', heart: 'Batu Hati', pink: 'Ruang merah jambu', nook: 'Ruang rahsia', mural: 'Mural', glim: 'Glim' },
    mapTitle: 'Peta Gua Hablur',
    elderComplete: ['Pintu Cahaya Bulan bersinar untuk kamu, wira. Di sebaliknya ada Gua Hablur, gua yang sudah gelap seratus tahun.', 'Pakailah Jubah Berlumut jika mahu, dan masuklah apabila kamu sudah bersedia!'],
    elderAfter: ['Gua Hablur bercahaya semula. Kamulah yang melakukannya, wira!', 'Pintu Cahaya Bulan sentiasa terbuka untuk kamu. Serpihan Bulan masih tersembunyi di dalam gua, jika kamu mahu mencarinya.'],
  },
};

const fill = (t: string, v: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
export const hollowFill = fill;

/** "Gold, Blue, Pink" in the mural's order. */
export const orderText = (lang: Lang): string => ECHO_ORDER.map(c => HOLLOW_TEXT[lang].colour[c]).join(', ');

/**
 * The quest card while the hero is in the Hollow, or (`inside` false) in the woods with the Hollow still unfinished. `step` is how many Echo
 * Crystals have been struck right in this attempt and `muralSeen` whether the hero has read the mural this visit (the colours are only
 * written on the card once they have: the mural, not the card, is how the order is learned).
 */
export function hollowObjective(lang: Lang, h: HollowState, o: { inside: boolean; step: number; muralSeen: boolean }): string {
  const t = HOLLOW_TEXT[lang].objective;
  if (!o.inside) return h.heartDone ? '' : t.gate;
  if (!h.doorOpen) return o.muralSeen ? fill(t.strike, { order: orderText(lang), n: o.step, total: ECHO_ORDER.length }) : t.findMural;
  if (!h.wardenDefeated && !h.heartDone) return t.warden;
  if (!h.heartDone) return t.heart;
  // the story is done: the optional jobs, Glim's request first (only if he has been met), then shards, then tablets
  if (h.glim === 1) return h.shardlings.length < SHARDLING_COUNT ? fill(t.shardlings, { n: h.shardlings.length, total: SHARDLING_COUNT }) : t.glimReport;
  if (h.shards.length < SHARD_COUNT) return fill(t.shards, { n: h.shards.length, total: SHARD_COUNT });
  if (h.tablets.length < TABLET_COUNT) return fill(t.tablets, { n: h.tablets.length, total: TABLET_COUNT });
  return t.peace;
}
