/**
 * All the words of the wider woods (v2.31), English and Malay. The Malay is first-draft and NEEDS A NATIVE SPEAKER'S REVIEW, like the
 * shore text before it. Plain strings only (no emoji: see ui/noEmoji.test.ts). `{n}`, `{total}`, `{name}`, `{a}`, `{b}` are filled in by the game.
 */
import type { Lang } from './woodsText';
import type { ZoneId } from '../systems/expansion';

export type WildsLandmarkKind = ZoneId | 'mill' | 'door';
type Ask = { add: string; subtract: string };
interface Person { name: string; intro: string[]; waiting: string[]; report: string[]; thanks: string[]; ask?: Ask }
export interface WildsStrings {
  name: string;
  zones: Record<ZoneId, string>;
  labels: Record<WildsLandmarkKind, string>;
  ui: { open: string; light: string; read: string; talk: string; look: string };
  toast: {
    discover: string; hiddenFound: string; acorn: string; allAcorns: string; pumpkin: string; pearl: string; lantern: string; lanternsDone: string; tablet: string; allTablets: string;
    chest: string; chestEmpty: string; allChests: string; taniMet: string; lumutMet: string; dinMet: string; taniDone: string; lumutDone: string; dinDone: string; thorns: string; pumpkinsDone: string; pearlsDone: string; fogHint: string;
  };
  tani: Person; lumut: Person; din: Person;
  /** The three Old Step tablets: hints for finding the hidden places. */
  tablet: { name: string; lines: string[][] };
  sign: { name: string; lines: Record<string, string[]> };
  gate: { name: string; lines: string[] };
  door: { name: string; lines: string[] };
  chest: { name: string };
  objective: { explore: string; acorns: string; errand: Record<'tani' | 'lumut' | 'din', string>; report: Record<'tani' | 'lumut' | 'din', string>; allDone: string };
  map: { discovered: string; legendChest: string; legendFog: string; legendNew: string };
  /** v2.31.1: the clear "what next" after the Crystal Hollow. */
  next: { shoreObjective: string; shoreToast: string };
}

export const WILDS_TEXT: Record<Lang, WildsStrings> = {
  en: {
    name: 'The Wider Woods',
    zones: { orchard: 'Orchard Lane', hearthfield: 'Hearthfield Farm', kite: 'Kite Meadow', lookout: 'Lookout Hill', mirror: 'Mirror Pond', thicket: 'Mossbark Thicket', heartwood: 'The Heartwood', grove: 'Hidden Grove', cave: 'Whisper Cave', steps: 'The Old Steps', moon: 'Moon Circle', mist: 'Mistfall Gate', marsh: 'Firefly Marsh', rise: 'Sunstone Rise', falls: 'Whispering Falls' },
    labels: { orchard: 'Orchard', hearthfield: 'Farm', kite: 'Kite Meadow', lookout: 'Lookout', mirror: 'Mirror Pond', thicket: 'Mossbark', heartwood: 'Heartwood', grove: 'Hidden Grove', cave: 'Whisper Cave', steps: 'Old Steps', moon: 'Moon Circle', mist: 'Mistfall Gate', mill: 'Windmill', door: 'Sealed Door', marsh: 'Firefly Marsh', rise: 'Sunstone Rise', falls: 'Whispering Falls' },
    ui: { open: 'Open', light: 'Light', read: 'Read', talk: 'Talk', look: 'Look' },
    toast: {
      discover: 'Found: {name}', hiddenFound: 'A secret place: {name}!', acorn: 'Fairy Acorn {n}/{total}', allAcorns: 'All the Fairy Acorns!', pumpkin: 'Golden Pumpkin {n}/{total}', pearl: 'Pond Pearl {n}/{total}',
      lantern: 'Wisp Lantern lit {n}/{total}', lanternsDone: 'All the lanterns glow! Tell Kak Lumut.', tablet: 'Tablet read {n}/{total}', allTablets: 'You read every tablet!', chest: 'A treasure chest!', chestEmpty: 'The chest is empty now.', allChests: 'Every treasure chest found!',
      taniMet: 'Pak Tani has asked for your help.', lumutMet: 'Kak Lumut has asked for your help.', dinMet: 'Pak Din has asked for your help.', taniDone: 'Pak Tani is very happy!', lumutDone: 'Kak Lumut is very happy!', dinDone: 'Pak Din is very happy!',
      thorns: 'The thorns curl back. A shortcut is open!', pumpkinsDone: 'All the pumpkins! Take them to Pak Tani.', pearlsDone: 'All the pearls! Take them to Pak Din.', fogHint: 'New parts of the map appear as you explore.',
    },
    tani: {
      name: 'Pak Tani',
      intro: ['Good day, young hero! I am Pak Tani, the farmer of Hearthfield.', 'My four golden pumpkins rolled away down the lanes. Could you find them?', 'They shine a little when the sun is on them.'],
      waiting: ['Have you found my pumpkins? We have {n} of {total} so far.', 'Look around the farm and along the lanes. They are easy to spot.'],
      report: ['All four golden pumpkins! You are a wonderful helper.', 'I sold some at market this week. Let me ask you a quick sum.'],
      ask: { add: 'I sold pumpkins for RM{a} in the morning and RM{b} in the afternoon. How many ringgit did I get?', subtract: 'I had RM{a} in my tin and I spent RM{b} on seeds. How many ringgit are left?' },
      thanks: ['Thank you again! The pumpkins will make a fine soup.'],
    },
    lumut: {
      name: 'Kak Lumut',
      intro: ['Shh, little one. I am Kak Lumut. I look after the Mossbark Thicket.', 'Three wisp lanterns stand on the trail, and they have gone dark. The thicket feels lonely without their light.', 'Touch each one to wake it. Then come back and tell me.'],
      waiting: ['Three wisp lanterns need waking. {n} of {total} glow now.', 'Follow the winding trail. The stones are beside the path.'],
      report: ['The thicket is glowing again. Thank you!', 'Before I show you my secret, a little sum for the thinking cap.'],
      thanks: ['The thorns on the old shortcut have curled back. Walk freely between the Heartwood and the glade.'],
    },
    din: {
      name: 'Pak Din',
      intro: ['Salam, young hero. I am Pak Din. I watch over Mirror Pond.', 'Four pond pearls have drifted into the shallows. They shine like tiny moons.', 'Wade in and gather them, and I will be in your debt.'],
      waiting: ['The pearls are in the shallows. You have {n} of {total}.', 'Wade gently. The water is not deep.'],
      report: ['Four pearls! The pond is calm again.', 'Let me test your clock: the fish bite by the hour.'],
      ask: { add: 'The fish bite at {a} o\'clock. The tide turns {b} hours later. What time is that?', subtract: 'It is {a} o\'clock now. My boat left {b} hours ago. What time did it leave?' },
      thanks: ['Thank you, hero. Come and rest by the water any time.'],
    },
    tablet: {
      name: 'Old Step Tablet',
      lines: [
        ['The moss has covered most of the words.', 'West of the great glade, a winding trail goes into the dark thicket. At its end a giant tree sleeps.'],
        ['The first travellers hid a grove where the blossoms never fall.', 'Look for a fern-lined trail that leaves the glade to the north-west, behind the Ancient Tree.'],
        ['Where the grove path ends, a cave breathes quietly.', 'Those who whisper in the cave are said to hear the forest answer.'],
      ],
    },
    sign: {
      name: 'Signpost',
      lines: {
        orchard: ['Orchard Lane and Hearthfield Farm. Windmill ahead.'], pond: ['Pond Road. Mirror Pond lies to the east.'], thicket: ['Mossbark Trail. The thicket is dark, so follow the lanterns.'],
        steps: ['The Old Steps. Ancient ruins lie to the north.'], mist: ['Mist Road. The Mistfall Gate is at the end.'], fern: ['A fern trail leads north-west. Few travellers go this way.'], lookout: ['Lookout Trail. Climb the hill for the view.'],
        marsh: ['Marsh Trail. Fireflies gather where the farm ends.'], rise: ['Rise Trail. Follow it past the pond to the sunlit stones.'],
      },
    },
    gate: { name: 'Mistfall Gate', lines: ['A great stone gate. A thick, cold mist rolls in and hides the path beyond.', 'Something high and far away is waiting on the other side.', 'The mist is too thick to cross yet. Come back one day.'] },
    door: { name: 'Sealed Door', lines: ['A heavy stone door, carved with swirls and sealed shut.', 'Cool air breathes through the crack under it. It smells of deep caves.', 'It will not open yet.'] },
    chest: { name: 'Treasure Chest' },
    objective: { explore: 'Explore the Wider Woods', acorns: 'Find the Fairy Acorns ({n}/{total})', errand: { tani: 'Find the golden pumpkins ({n}/{total})', lumut: 'Wake the wisp lanterns ({n}/{total})', din: 'Gather the pond pearls ({n}/{total})' }, report: { tani: 'Take the pumpkins to Pak Tani', lumut: 'Tell Kak Lumut', din: 'Take the pearls to Pak Din' }, allDone: 'You have explored the Wider Woods!' },
    map: { discovered: 'Places found {n}/{total}', legendChest: 'Treasure chest', legendFog: 'Unexplored', legendNew: 'New region' },
    next: { shoreObjective: 'Next map: go to the glowing arch in the village (east side, gold star on the map)', shoreToast: 'NEXT: Moonwake Shore! Walk to the glowing arch on the east side of the village. Open the map to see the gold star.' },
  },
  ms: {
    name: 'Hutan Yang Lebih Luas',
    zones: { orchard: 'Lorong Kebun', hearthfield: 'Ladang Hearthfield', kite: 'Padang Layang-layang', lookout: 'Bukit Tinjau', mirror: 'Tasik Cermin', thicket: 'Belukar Mossbark', heartwood: 'Pokok Teras', grove: 'Dusun Tersembunyi', cave: 'Gua Bisikan', steps: 'Tangga Lama', moon: 'Bulatan Bulan', mist: 'Pintu Mistfall', marsh: 'Paya Kelip-kelip', rise: 'Tanjakan Batu Suria', falls: 'Air Terjun Berbisik' },
    labels: { orchard: 'Kebun', hearthfield: 'Ladang', kite: 'Padang Layang', lookout: 'Bukit Tinjau', mirror: 'Tasik Cermin', thicket: 'Mossbark', heartwood: 'Pokok Teras', grove: 'Dusun Rahsia', cave: 'Gua Bisikan', steps: 'Tangga Lama', moon: 'Bulatan Bulan', mist: 'Pintu Mistfall', mill: 'Kincir Angin', door: 'Pintu Berkunci', marsh: 'Paya Kelip', rise: 'Batu Suria', falls: 'Air Terjun' },
    ui: { open: 'Buka', light: 'Nyalakan', read: 'Baca', talk: 'Bercakap', look: 'Lihat' },
    toast: {
      discover: 'Jumpa: {name}', hiddenFound: 'Tempat rahsia: {name}!', acorn: 'Buah Ek Pari-pari {n}/{total}', allAcorns: 'Semua Buah Ek Pari-pari!', pumpkin: 'Labu Emas {n}/{total}', pearl: 'Mutiara Tasik {n}/{total}',
      lantern: 'Tanglung Bayang menyala {n}/{total}', lanternsDone: 'Semua tanglung bercahaya! Beritahu Kak Lumut.', tablet: 'Loh dibaca {n}/{total}', allTablets: 'Anda sudah baca semua loh!', chest: 'Peti harta karun!', chestEmpty: 'Peti ini sudah kosong.', allChests: 'Semua peti harta karun sudah dijumpai!',
      taniMet: 'Pak Tani minta bantuan anda.', lumutMet: 'Kak Lumut minta bantuan anda.', dinMet: 'Pak Din minta bantuan anda.', taniDone: 'Pak Tani sangat gembira!', lumutDone: 'Kak Lumut sangat gembira!', dinDone: 'Pak Din sangat gembira!',
      thorns: 'Duri-duri itu melengkung pergi. Jalan pintas terbuka!', pumpkinsDone: 'Semua labu! Bawa kepada Pak Tani.', pearlsDone: 'Semua mutiara! Bawa kepada Pak Din.', fogHint: 'Bahagian baru peta muncul semasa anda meneroka.',
    },
    tani: {
      name: 'Pak Tani',
      intro: ['Selamat sejahtera, wira muda! Saya Pak Tani, petani Hearthfield.', 'Empat biji labu emas saya sudah bergolek jauh di lorong-lorong. Boleh tolong cari?', 'Labu itu berkilau sedikit bila terkena cahaya matahari.'],
      waiting: ['Sudah jumpa labu saya? Setakat ini {n} daripada {total}.', 'Lihat sekitar ladang dan di tepi lorong. Senang nampak.'],
      report: ['Keempat-empat labu emas! Anda pembantu yang hebat.', 'Minggu ini saya jual beberapa di pasar. Biar saya tanya satu soalan kira-kira.'],
      ask: { add: 'Saya jual labu RM{a} pada waktu pagi dan RM{b} pada waktu petang. Berapa ringgit saya dapat?', subtract: 'Saya ada RM{a} dalam tin dan saya belanja RM{b} untuk benih. Berapa ringgit yang tinggal?' },
      thanks: ['Terima kasih lagi! Labu ini akan jadi sup yang sedap.'],
    },
    lumut: {
      name: 'Kak Lumut',
      intro: ['Shh, adik kecil. Saya Kak Lumut. Saya jaga Belukar Mossbark.', 'Tiga tanglung bayang di denai itu sudah malap. Belukar ini sunyi tanpa cahayanya.', 'Sentuh setiap satu untuk menyalakannya. Kemudian datang beritahu saya.'],
      waiting: ['Tiga tanglung bayang perlu dinyalakan. {n} daripada {total} sudah bercahaya.', 'Ikut denai yang berliku. Batu tanglung ada di tepi laluan.'],
      report: ['Belukar bersinar semula. Terima kasih!', 'Sebelum saya tunjuk rahsia saya, satu soalan kira-kira untuk melatih otak.'],
      thanks: ['Duri di jalan pintas lama sudah melengkung pergi. Berjalanlah bebas antara Pokok Teras dan lembah.'],
    },
    din: {
      name: 'Pak Din',
      intro: ['Salam, wira muda. Saya Pak Din. Saya jaga Tasik Cermin.', 'Empat mutiara tasik sudah hanyut ke air cetek. Ia bersinar seperti bulan kecil.', 'Redah dan kutiplah, dan saya akan berhutang budi.'],
      waiting: ['Mutiara ada di air cetek. Anda sudah ada {n} daripada {total}.', 'Redah perlahan-lahan. Airnya tidak dalam.'],
      report: ['Empat mutiara! Tasik tenang semula.', 'Biar saya uji anda tentang jam: ikan makan mengikut waktu.'],
      ask: { add: 'Ikan makan umpan pada pukul {a}. Air pasang berubah {b} jam kemudian. Pukul berapa itu?', subtract: 'Sekarang pukul {a}. Bot saya bertolak {b} jam yang lalu. Pukul berapa ia bertolak?' },
      thanks: ['Terima kasih, wira. Datanglah berehat di tepi tasik bila-bila masa.'],
    },
    tablet: {
      name: 'Loh Tangga Lama',
      lines: [
        ['Lumut sudah menutup kebanyakan perkataan.', 'Di barat lembah besar, ada denai berliku masuk ke belukar gelap. Di hujungnya tidur sebatang pokok gergasi.'],
        ['Pengembara pertama menyembunyikan sebuah dusun yang bunganya tidak pernah gugur.', 'Cari denai penuh paku-pakis yang keluar dari lembah ke barat laut, di belakang Pokok Purba.'],
        ['Di hujung denai dusun, sebuah gua bernafas perlahan.', 'Mereka yang berbisik dalam gua konon dapat dengar hutan menjawab.'],
      ],
    },
    sign: {
      name: 'Papan Tanda',
      lines: {
        orchard: ['Lorong Kebun dan Ladang Hearthfield. Kincir angin di hadapan.'], pond: ['Jalan Tasik. Tasik Cermin di sebelah timur.'], thicket: ['Denai Mossbark. Belukar gelap, jadi ikut tanglung.'],
        steps: ['Tangga Lama. Runtuhan purba di sebelah utara.'], mist: ['Jalan Kabus. Pintu Mistfall di hujungnya.'], fern: ['Denai paku-pakis ke barat laut. Jarang orang lalu sini.'], lookout: ['Denai Bukit Tinjau. Daki bukit untuk melihat pemandangan.'],
        marsh: ['Denai Paya. Kelip-kelip berkumpul di hujung ladang.'], rise: ['Denai Tanjakan. Ikutlah melepasi tasik ke batu-batu yang bercahaya.'],
      },
    },
    gate: { name: 'Pintu Mistfall', lines: ['Sebuah pintu batu yang besar. Kabus tebal dan sejuk bergulung masuk dan menyembunyikan laluan di sebelah sana.', 'Sesuatu yang tinggi dan jauh sedang menunggu di seberang.', 'Kabus terlalu tebal untuk dilalui lagi. Datang lagi suatu hari nanti.'] },
    door: { name: 'Pintu Berkunci', lines: ['Sebuah pintu batu yang berat, berukir pusaran dan terkunci rapat.', 'Angin sejuk menghembus dari celah di bawahnya. Baunya seperti gua yang dalam.', 'Ia belum boleh dibuka.'] },
    chest: { name: 'Peti Harta Karun' },
    objective: { explore: 'Teroka Hutan Yang Lebih Luas', acorns: 'Cari Buah Ek Pari-pari ({n}/{total})', errand: { tani: 'Cari labu emas ({n}/{total})', lumut: 'Nyalakan tanglung bayang ({n}/{total})', din: 'Kutip mutiara tasik ({n}/{total})' }, report: { tani: 'Bawa labu kepada Pak Tani', lumut: 'Beritahu Kak Lumut', din: 'Bawa mutiara kepada Pak Din' }, allDone: 'Anda sudah meneroka Hutan Yang Lebih Luas!' },
    map: { discovered: 'Tempat dijumpai {n}/{total}', legendChest: 'Peti harta karun', legendFog: 'Belum diteroka', legendNew: 'Kawasan baru' },
    next: { shoreObjective: 'Peta seterusnya: pergi ke gerbang bercahaya di kampung (sebelah timur, bintang emas pada peta)', shoreToast: 'SETERUSNYA: Pantai Moonwake! Berjalan ke gerbang bercahaya di sebelah timur kampung. Buka peta untuk lihat bintang emas.' },
  },
};
