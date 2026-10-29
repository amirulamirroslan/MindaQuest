/** Words for Moonwake Shore (v2.29), English and Bahasa Melayu. The same-shape test in shoreText.test.ts checks both languages. */
import type { Lang } from './woodsText';
import { EBB_SONG, FLOOD_SONG, type BuoyId } from '../systems/shoreLayout';
import { BOTTLE_COUNT, CRAB_COUNT, GLASS_COUNT, GULL_COUNT, causewayOpen, type ShoreState } from '../systems/shoreQuest';

export interface ShoreStrings {
  name: string;
  /** Names of the three bell-buoys (a picture of a shell, a wave and a star is on each, so the name never depends on colour). */
  buoy: Record<BuoyId, string>;
  /** Objective card lines. `{order}` is the bells in order, `{n}` and `{total}` are numbers. */
  objective: {
    gate: string; findMak: string; readBoard: string; ringFirst: string; ringOther: string; heron: string; lamp: string; glass: string; glassReport: string; keeperReport: string;
    crabs: string; bottles: string; peace: string;
  };
  toast: {
    enter: string; boardRead: string; bellRight: string; bellWrong: string; ebb: string; flood: string; sameLow: string; sameHigh: string; solved: string;
    glass: string; allGlass: string; crab: string; gull: string; shellBlocks: string; heronWakes: string; weakSpot: string; heronDown: string; lampGuarded: string;
    lampDone: string; makMet: string; makDone: string; keeperMet: string; keeperDone: string; bottle: string; allBottles: string; back: string;
  };
  ui: { ring: string };
  /** The Tidecaller Heron's health bar name. */
  boss: string;
  /** Harbour-master Mak Long. `ask` is the money sum he sets once every piece of sea-glass is found (`{a}` and `{b}`, in ringgit). */
  mak: { name: string; intro: string[]; waiting: string[]; report: string[]; ask: { add: string; subtract: string }; thanks: string[] };
  /** The lighthouse keeper. `ask` is the clock riddle (`{a}` and `{b}` are hours on the clock). */
  keeper: { name: string; intro: string[]; waiting: string[]; report: string[]; ask: { add: string; subtract: string }; thanks: string[] };
  /** Hints for the two sums (the generic riddle hints talk about petals, so the shore says its own): a hint line and a "how to think about it" line for each. */
  sums: Record<'money' | 'clock', { hint: { add: string; subtract: string }; concept: { add: string; subtract: string } }>;
  /** The three message bottles: a name and lines each (they teach the Heron's moves). */
  bottle: { name: string; lines: string[][] };
  /** The Tide Board: the title and one line per song (`{order}` is the bells in order). */
  board: { title: string; ebb: string; flood: string; hint: string };
  /** v2.30: the always-visible tide line in the quest card (text and an arrow, so the tide never depends on colour). */
  tide: Record<'low' | 'high' | 'still', string>;
  /** Names on the shore map. */
  labels: Record<'beach' | 'village' | 'flats' | 'wreck' | 'island' | 'cave' | 'cove' | 'tern' | 'beacon', string>;
  mapTitle: string;
  /** Elder Tok Wan's lines once the Heartstone is touched: sending the hero to the coast, then after the lamp is lit. */
  elderToShore: string[];
  elderShoreDone: string[];
}

export const SHORE_TEXT: Record<Lang, ShoreStrings> = {
  en: {
    name: 'Moonwake Shore',
    buoy: { shell: 'Shell bell', wave: 'Wave bell', star: 'Star bell' },
    objective: {
      gate: 'Follow the Heartstone\u2019s light to Moonwake Shore',
      findMak: 'Speak to Harbour-master Mak Long',
      readBoard: 'Read the Tide Board in the village',
      ringFirst: 'Ring the bell-buoys: {order} ({n}/{total})',
      ringOther: 'Now ring the other tide song: {order} ({n}/{total})',
      heron: 'The Moon Causeway is up! Face the Tidecaller Heron',
      lamp: 'The Heron is calm. Light the lamp at the lighthouse',
      glass: 'Find sea-glass for Mak Long ({n}/{total})',
      glassReport: 'Show Mak Long your sea-glass',
      keeperReport: 'Tell the keeper the Heron is calm',
      crabs: 'Calm the Pebble Crabs and Gloom Gulls ({n}/{total})',
      bottles: 'Find the message bottles ({n}/{total})',
      peace: 'Moonwake Shore shines. Explore as you like!',
    },
    toast: {
      enter: 'Welcome to Moonwake Shore! The tide has stopped.',
      boardRead: 'The Tide Board shows two songs. Ebb (low tide): {ebb}. Flood (high tide): the same bells backwards, {flood}.',
      bellRight: 'The bell rings true!',
      bellWrong: 'Not that bell. The sound fades. Try again with the Tide Board\u2019s order!',
      ebb: 'The ebb song! The water drains away. Low tide: the flats are open!',
      flood: 'The flood song! The water rises. High tide: a ferry floats to the wrecks!',
      sameLow: 'The tide is already low.',
      sameHigh: 'The tide is already high.',
      solved: 'Both tide songs rung! The Moon Causeway rises from the sea!',
      glass: 'Sea-glass {n}/{total}',
      allGlass: 'All the sea-glass! Take it to Mak Long.',
      crab: 'Pebble Crab calmed ({n}/{total})',
      gull: 'Gloom Gull calmed ({n}/{total})',
      shellBlocks: 'Its shell blocks the front! Step round to its side or back, or strike while it is dizzy.',
      heronWakes: 'The Tidecaller Heron wakes! Watch the glowing shapes.',
      weakSpot: 'Its chest is showing! Strike now: blows count double.',
      heronDown: 'The Heron is calm. The lamp is free!',
      lampGuarded: 'The Heron guards the lamp.',
      lampDone: 'The lamp shines! Moonwake Shore is bright again.',
      makMet: 'Mak Long has asked for your help.',
      makDone: 'Mak Long is happy! He gives you a sailor\u2019s outfit.',
      keeperMet: 'The keeper has told you about the Heron.',
      keeperDone: 'The keeper is happy! His clock runs true.',
      bottle: 'Message bottle {n}/{total}',
      allBottles: 'All the message bottles! You know the Heron\u2019s secrets.',
      back: 'Back in the Whispering Woods.',
    },
    ui: { ring: 'Ring' },
    boss: 'Tidecaller Heron',
    mak: {
      name: 'Mak Long',
      intro: [
        'Ahoy! I am Mak Long, harbour-master of Moonwake Shore. Look at my poor harbour: the tide has stopped, and the lighthouse is dark.',
        'Three bell-buoys float by the piers. Ring them in the right order and the sea will move again. The Tide Board in the village shows the songs.',
        'While you are here, please hunt for sea-glass on the beaches. I need eight pieces for my lantern windows, and I will pay you!',
      ],
      waiting: [
        'You have found {n} pieces of sea-glass so far. I need eight.',
        'If a path is under water, the tide is wrong for it. The flats are dry at low tide. The ferry floats at high tide.',
      ],
      report: ['Eight pieces! Look how they shine!', 'Let me count out your pay, and you can count with me.'],
      ask: {
        add: 'The glass is worth RM{a}, and the shells are worth RM{b}. How many ringgit is that altogether?',
        subtract: 'You pay me RM{a}. The rope costs RM{b}. How many ringgit change do I give back?',
      },
      thanks: ['Thank you, hero! Here is a sailor\u2019s outfit from my sea chest.', 'Open your wardrobe to wear it. Fair winds!'],
    },
    keeper: {
      name: 'Keeper Salleh',
      intro: [
        'Oh! Somebody crossed the Moon Causeway! I am Salleh, the lighthouse keeper.',
        'A great grey heron, the Tidecaller, stopped the tide and sits by my lamp. It splashes the water where you stand, sweeps its wings in a long line, and sends out a ring.',
        'When it stops to preen its feathers, its chest is open. Strike then! I will wait right here.',
      ],
      waiting: ['The Heron is still by the lamp. Watch the glowing shapes, and strike when it preens!'],
      report: ['The Heron is calm! I can feel the sea breathing again.', 'Now a riddle about the clock, for my lamp must keep good time.'],
      ask: {
        add: 'The big bell rang at {a} o\u2019clock. It rings again {b} hours later. What o\u2019clock will it be?',
        subtract: 'The lamp must be lit at {a} o\u2019clock. It is {b} o\u2019clock now. How many hours must I wait?',
      },
      thanks: ['Thank you, hero! My clock runs true again.', 'Touch the lamp to light the lighthouse. It is your light now, more than mine.'],
    },
    sums: {
      money: { hint: { add: 'Put the two amounts together and count the ringgit.', subtract: 'Take the price away from the money you paid. What is left is the change.' },
        concept: { add: 'Adding money: start at the first amount and count on the second.', subtract: 'Change is what is left after you pay. Count back from the money you paid.' } },
      clock: { hint: { add: 'Count on the hours round the clock face, one at a time.', subtract: 'Count the hours from now up to the time on the lamp.' },
        concept: { add: 'Later in the day: start at the first hour and count on.', subtract: 'The wait is the gap between the two hours. Count it on your fingers.' } },
    },
    bottle: {
      name: 'Message bottle',
      lines: [
        ['A note in a bottle: \u2018The Heron splashes the water where you stand. Keep moving and the splash will miss you.\u2019'],
        ['A note in a bottle: \u2018Its wing-sweep is a long line, but slow to aim. Step to the side, or roll through it.\u2019'],
        ['A note in a bottle: \u2018When the Heron preens, its chest shows. Strike then, and every blow counts double. Its ring only reaches so far: run beyond the edge.\u2019'],
        ['A note in a bottle: \u2018The pearls in this cove are only the sea’s old tears. Gather them gently and the tide will remember you.\u2019'],
        ['A note in a bottle: \u2018Tern Rock is a rock only when the sea is high. Come at high water and the terns will share their view.\u2019'],
        ['A note in a bottle: \u2018From Beacon Rock the lighthouse looks small. Every light the keeper ever lit began as a spark like yours.\u2019'],
      ],
    },
    tide: { low: 'Low tide', high: 'High tide', still: 'Tide: still' },
    board: { title: 'Tide Board', ebb: 'Ebb song, low tide: {order}', flood: 'Flood song, high tide: {order} (the ebb song backwards)', hint: 'Ring the bells in order. A wrong bell only starts again.' },
    labels: { beach: 'Way out', village: 'Stilt village', flats: 'Tidepool Flats', wreck: 'Shipwrecks', island: 'Lighthouse', cave: 'Sea cave', cove: 'Pearl Cove', tern: 'Tern Rock', beacon: 'Beacon Rock' },
    mapTitle: 'Moonwake Shore map',
    elderToShore: ['The Heartstone\u2019s light flowed down the river to the sea, hero. Far along the coast, the tide has stopped and the lighthouse is dark.', 'Take the river path by the east side of the village. Moonwake Shore needs you!'],
    elderShoreDone: ['Moonwake Shore is shining again. You did that, hero!', 'The river path is always open for you. Sea-glass and message bottles still hide along the coast.'],
  },
  ms: {
    name: 'Pantai Moonwake',
    buoy: { shell: 'Loceng Kerang', wave: 'Loceng Ombak', star: 'Loceng Bintang' },
    objective: {
      gate: 'Ikut cahaya Batu Hati ke Pantai Moonwake',
      findMak: 'Berbual dengan Tuan Pelabuhan Mak Long',
      readBoard: 'Baca Papan Pasang Surut di kampung',
      ringFirst: 'Bunyikan loceng pelampung: {order} ({n}/{total})',
      ringOther: 'Sekarang bunyikan lagu air yang satu lagi: {order} ({n}/{total})',
      heron: 'Jalan Bulan sudah timbul! Hadapi Bangau Pemanggil Air',
      lamp: 'Bangau sudah tenang. Nyalakan lampu di rumah api',
      glass: 'Cari kaca laut untuk Mak Long ({n}/{total})',
      glassReport: 'Tunjukkan kaca laut kepada Mak Long',
      keeperReport: 'Beritahu penjaga bahawa Bangau sudah tenang',
      crabs: 'Tenangkan Ketam Batu dan Camar Muram ({n}/{total})',
      bottles: 'Cari botol berpesan ({n}/{total})',
      peace: 'Pantai Moonwake bersinar. Jelajahlah sesuka hati!',
    },
    toast: {
      enter: 'Selamat datang ke Pantai Moonwake! Air pasang sudah berhenti.',
      boardRead: 'Papan Pasang Surut menunjukkan dua lagu. Air surut: {ebb}. Air pasang: loceng yang sama secara terbalik, {flood}.',
      bellRight: 'Loceng itu berbunyi betul!',
      bellWrong: 'Bukan loceng itu. Bunyinya hilang. Cuba lagi ikut susunan Papan Pasang Surut!',
      ebb: 'Lagu air surut! Air mengalir pergi. Air surut: tanah lumpur terbuka!',
      flood: 'Lagu air pasang! Air naik. Air pasang: feri terapung ke kapal karam!',
      sameLow: 'Air sudah surut.',
      sameHigh: 'Air sudah pasang.',
      solved: 'Kedua-dua lagu air sudah dibunyikan! Jalan Bulan timbul dari laut!',
      glass: 'Kaca laut {n}/{total}',
      allGlass: 'Semua kaca laut! Bawa kepada Mak Long.',
      crab: 'Ketam Batu sudah tenang ({n}/{total})',
      gull: 'Camar Muram sudah tenang ({n}/{total})',
      shellBlocks: 'Cangkerangnya menahan bahagian depan! Melangkah ke sisi atau belakangnya, atau serang ketika ia pening.',
      heronWakes: 'Bangau Pemanggil Air sudah bangun! Perhatikan bentuk yang bercahaya.',
      weakSpot: 'Dadanya kelihatan! Serang sekarang: setiap pukulan dikira dua kali.',
      heronDown: 'Bangau sudah tenang. Lampu sudah bebas!',
      lampGuarded: 'Bangau menjaga lampu.',
      lampDone: 'Lampu bersinar! Pantai Moonwake terang semula.',
      makMet: 'Mak Long meminta bantuan kamu.',
      makDone: 'Mak Long gembira! Dia memberi kamu pakaian pelaut.',
      keeperMet: 'Penjaga sudah menceritakan tentang Bangau.',
      keeperDone: 'Penjaga gembira! Jamnya tepat semula.',
      bottle: 'Botol berpesan {n}/{total}',
      allBottles: 'Semua botol berpesan! Kamu tahu rahsia Bangau.',
      back: 'Kembali ke Hutan Berbisik.',
    },
    ui: { ring: 'Bunyikan' },
    boss: 'Bangau Pemanggil Air',
    mak: {
      name: 'Mak Long',
      intro: [
        'Ahoi! Saya Mak Long, tuan pelabuhan Pantai Moonwake. Lihatlah pelabuhan saya: air pasang sudah berhenti, dan rumah api gelap.',
        'Tiga pelampung loceng terapung di tepi jeti. Bunyikan ikut susunan yang betul dan laut akan bergerak semula. Papan Pasang Surut di kampung menunjukkan lagunya.',
        'Sementara kamu di sini, tolong cari kaca laut di pantai. Saya perlukan lapan keping untuk tingkap tanglung saya, dan saya akan bayar kamu!',
      ],
      waiting: [
        'Setakat ini kamu sudah jumpa {n} keping kaca laut. Saya perlukan lapan.',
        'Jika sesuatu jalan dalam air, air pasangnya tidak sesuai. Tanah lumpur kering ketika air surut. Feri terapung ketika air pasang.',
      ],
      report: ['Lapan keping! Lihatlah betapa berkilau!', 'Biar saya kira bayaran kamu, dan kamu boleh mengira bersama saya.'],
      ask: {
        add: 'Kaca itu bernilai RM{a}, dan kerang itu bernilai RM{b}. Berapa ringgit semuanya?',
        subtract: 'Kamu bayar saya RM{a}. Tali itu berharga RM{b}. Berapa ringgit baki yang saya pulangkan?',
      },
      thanks: ['Terima kasih, wira! Ini pakaian pelaut dari peti laut saya.', 'Buka almari pakaian untuk memakainya. Selamat belayar!'],
    },
    keeper: {
      name: 'Penjaga Salleh',
      intro: [
        'Oh! Ada orang menyeberangi Jalan Bulan! Saya Salleh, penjaga rumah api.',
        'Seekor bangau kelabu yang besar, Pemanggil Air, menghentikan air pasang dan duduk di tepi lampu saya. Ia memercikkan air di tempat kamu berdiri, mengibas sayap berbentuk garisan panjang, dan menghantar satu cincin.',
        'Apabila ia berhenti untuk membersihkan bulu, dadanya terbuka. Seranglah ketika itu! Saya akan tunggu di sini.',
      ],
      waiting: ['Bangau masih di tepi lampu. Perhatikan bentuk yang bercahaya, dan serang ketika ia membersihkan bulu!'],
      report: ['Bangau sudah tenang! Saya dapat rasa laut bernafas semula.', 'Sekarang teka-teki tentang jam, kerana lampu saya mesti tepat masa.'],
      ask: {
        add: 'Loceng besar berbunyi pada pukul {a}. Ia berbunyi lagi {b} jam kemudian. Pukul berapakah ketika itu?',
        subtract: 'Lampu mesti dinyalakan pada pukul {a}. Sekarang pukul {b}. Berapa jam saya perlu menunggu?',
      },
      thanks: ['Terima kasih, wira! Jam saya tepat semula.', 'Sentuh lampu untuk menyalakan rumah api. Ia cahaya kamu sekarang, lebih daripada cahaya saya.'],
    },
    sums: {
      money: { hint: { add: 'Gabungkan kedua-dua jumlah dan kira ringgitnya.', subtract: 'Tolak harga daripada wang yang dibayar. Yang tinggal ialah bakinya.' },
        concept: { add: 'Menambah wang: mulakan dengan jumlah pertama dan kira terus jumlah kedua.', subtract: 'Baki ialah yang tinggal selepas membayar. Kira mengundur dari wang yang dibayar.' } },
      clock: { hint: { add: 'Kira jam demi jam di sekeliling muka jam.', subtract: 'Kira jam dari sekarang sehingga waktu pada lampu.' },
        concept: { add: 'Lebih lewat pada hari itu: mulakan dengan jam pertama dan kira terus.', subtract: 'Masa menunggu ialah jarak antara dua jam itu. Kira dengan jari.' } },
    },
    bottle: {
      name: 'Botol berpesan',
      lines: [
        ['Nota dalam botol: \u2018Bangau memercikkan air di tempat kamu berdiri. Terus bergerak dan percikan itu tidak akan kena.\u2019'],
        ['Nota dalam botol: \u2018Kibasan sayapnya berbentuk garisan panjang, tetapi lambat disasarkan. Melangkahlah ke tepi, atau bergulinglah melaluinya.\u2019'],
        ['Nota dalam botol: \u2018Apabila Bangau membersihkan bulu, dadanya kelihatan. Seranglah ketika itu, dan setiap pukulan dikira dua kali. Cincinnya hanya sampai sejauh itu: berlarilah melepasi tepinya.\u2019'],
        ['Nota dalam botol: ‘Mutiara di teluk ini hanyalah air mata lama laut. Kutiplah dengan lembut dan air pasang akan mengingati kamu.’'],
        ['Nota dalam botol: ‘Batu Camar hanya menjadi batu apabila laut pasang. Datanglah ketika air pasang dan camar akan berkongsi pemandangan mereka.’'],
        ['Nota dalam botol: ‘Dari Batu Suar, rumah api kelihatan kecil. Setiap cahaya yang dinyalakan penjaga bermula sebagai percikan seperti milik kamu.’'],
      ],
    },
    tide: { low: 'Air surut', high: 'Air pasang', still: 'Air: berhenti' },
    board: { title: 'Papan Pasang Surut', ebb: 'Lagu air surut: {order}', flood: 'Lagu air pasang: {order} (lagu air surut secara terbalik)', hint: 'Bunyikan loceng ikut susunan. Loceng yang salah hanya mula semula.' },
    labels: { beach: 'Jalan keluar', village: 'Kampung atas tiang', flats: 'Tanah Lumpur', wreck: 'Kapal Karam', island: 'Rumah Api', cave: 'Gua laut', cove: 'Teluk Mutiara', tern: 'Batu Camar', beacon: 'Batu Suar' },
    mapTitle: 'Peta Pantai Moonwake',
    elderToShore: ['Cahaya Batu Hati mengalir menyusuri sungai ke laut, wira. Jauh di pesisir, air pasang sudah berhenti dan rumah api gelap.', 'Ikut jalan sungai di sebelah timur kampung. Pantai Moonwake memerlukan kamu!'],
    elderShoreDone: ['Pantai Moonwake bercahaya semula. Kamulah yang melakukannya, wira!', 'Jalan sungai sentiasa terbuka untuk kamu. Kaca laut dan botol berpesan masih tersembunyi di pesisir.'],
  },
};

const fill = (t: string, v: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
export const shoreFill = fill;

/** "Wave, Shell, Star" in a song's order. */
export const songText = (lang: Lang, song: readonly BuoyId[]): string => song.map(b => SHORE_TEXT[lang].buoy[b]).join(', ');
export const ebbText = (lang: Lang): string => songText(lang, EBB_SONG);
export const floodText = (lang: Lang): string => songText(lang, FLOOD_SONG);

/**
 * The quest card while the hero is on the shore, or (`inside` false) in the woods with the shore still unfinished. `attempt` is how many bells
 * have been rung right in this try and `boardSeen` whether the hero has read the Tide Board this visit (the song is only written on the card
 * once they have: the board, not the card, is how the order is learned).
 */
export function shoreObjective(lang: Lang, s: ShoreState, o: { inside: boolean; rung: number; boardSeen: boolean }): string {
  const t = SHORE_TEXT[lang].objective;
  if (!o.inside) return s.lampLit ? '' : t.gate;
  if (s.mak === 0 && s.songs.length === 0) return t.findMak;   // a hero who has already rung a bell has clearly found their way
  if (!causewayOpen(s)) {
    if (!o.boardSeen && s.songs.length === 0) return t.readBoard;
    // the song still to learn: the ebb song first, then the flood song
    const next = s.songs.includes('ebb') ? FLOOD_SONG : EBB_SONG, order = o.boardSeen ? songText(lang, next) : '?';
    return fill(s.songs.length === 0 ? t.ringFirst : t.ringOther, { order, n: Math.min(next.length, o.rung), total: next.length });
  }
  if (!s.heronDefeated) return t.heron;
  if (!s.lampLit) return t.lamp;
  // the story is done: the optional jobs, Mak Long's request first (only if he has been met), then the keeper, the creatures and the bottles
  if (s.mak === 1) return s.glass.length < GLASS_COUNT ? fill(t.glass, { n: s.glass.length, total: GLASS_COUNT }) : t.glassReport;
  if (s.keeper === 1) return t.keeperReport;
  const creatures = s.crabs.length + s.gulls.length, total = CRAB_COUNT + GULL_COUNT;
  if (creatures < total) return fill(t.crabs, { n: creatures, total });
  if (s.bottles.length < BOTTLE_COUNT) return fill(t.bottles, { n: s.bottles.length, total: BOTTLE_COUNT });
  return t.peace;
}

/** v2.30: "1 hours" reads wrong to a child; the clock riddle fills in a number, so a lone hour must be singular (Malay "jam" never changes). */
export const singularHour = (text: string): string => text.replace(/\b1 hours\b/g, '1 hour');
