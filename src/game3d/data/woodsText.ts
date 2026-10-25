/** All words the 3D game shows, in English and Bahasa Melayu. Add a language by adding one object here (the test checks every key exists). */
import type { PartKey } from '../../game/art/parts';
import type { Explanation, RiddleKind } from '../systems/runePuzzle';
import type { Progress, WoodsStage } from '../systems/woodsQuest';
import { BONUS_XP_CAP, PATROL_XP, PETALS_NEEDED, RUNES_PER_RUN, SPROUTS_NEEDED } from '../systems/woodsQuest';

export type Lang = 'en' | 'ms';
export const LANG_STORAGE_KEY = 'mindquest.lang.v1';

export interface Strings {
  elderName: string;
  objective: Record<WoodsStage, string>;
  /** Elder's lines per stage (shown one box at a time). */
  elder: Record<WoodsStage, string[]>;
  toast: { gather: string; allPetals: string; runesCalling: string; bossStirs: string; bossCalm: string; gateOpen: string; levelUp: string; unlocked: string; fainted: string; petal: string; patrol: string; patrolDone: string; patrolLine: string; patrolPeace: string };
  ui: {
    attack: string; dodge: string; special: string; talk: string; read: string; pause: string; resume: string; language: string; startOver: string; sure: string;
    outfit: string; accessories: string; none: string; controls: string; level: string; sound: string; on: string; off: string; boss: string;
    endTitle: string; endBody: string; keepExploring: string; playAgain: string; noWebgl: string; loading: string; tapToContinue: string; moveHint: string;
    use: string; quest: string; menu: string; xp: string; soon: string; levelShort: string; collapse: string;
  };
  /** The Rune Stone riddles. `{a}`, `{b}` and `{n}` are replaced with numbers (see `fill`). */
  puzzle: {
    title: string; practiceTitle: string; riddleOf: string; runeName: Record<RiddleKind, string>;
    askCount: string; askPattern: string; askAdd: string; askSubtract: string;
    tapToCount: string; startOverCount: string; plus: string;
    hint: Record<RiddleKind, string>; hintStep: string;
    tryAgain: string; correct: string; correctFirst: string; revealed: string;
    /** Why the answer is right. `{a}` `{b}` `{n}` `{step}` are numbers. */
    explain: { count: string; recognise: string; add: string; subtract: string; twostep: string; repeat: string; up: string; down: string };
    /** Asked for before answering (free), and a short idea shown with a wrong answer. */
    hintLabel: string;
    concept: { count: string; recognise: string; add: string; subtract: string; twostep: string; repeat: string; step: string };
    askRecognise: string; askTwoStep: string;
    /** The Elder's lantern question, asked inside the conversation (no full-screen card). */
    gate: { add: string; subtract: string };
    symbol: Record<'blossom' | 'leaf' | 'mushroom' | 'star' | 'moon' | 'butterfly' | 'ladybug' | 'apple', string>;
    next: string; finish: string; close: string; allAwake: string; practiceAgain: string; practiceNote: string; practiceDone: string; xp: string;
  };
  /** The 3D wardrobe. */
  wardrobe: {
    title: string; done: string; random: string; reset: string; extras: string; drag: string; parts: Record<PartKey, string>;
    moves: { stand: string; walk: string; slash: string; spin: string };
  };
  controlsHelp: string[];
  /** The woods map screen. */
  map: { title: string; close: string; you: string; goal: string; hint: string; labels: Record<'village' | 'ruins' | 'pond' | 'camp' | 'tree' | 'fairy' | 'stone' | 'gate', string> };
  accessory: Record<string, string>;
  /** v2.14: the Hero panel (character, bag, journal) and its HUD buttons. `{n}` is replaced with a number. */
  hero: {
    heroTab: string; bagTab: string; journalTab: string; bag: string; close: string; health: string; level: string; xpToNext: string; wearing: string; changeOutfit: string; nothing: string;
    nextReward: string; allOpen: string; collected: string; petals: string; sprouts: string; riddles: string; mossback: string; calmed: string; waiting: string; rewards: string; noRewards: string;
    itemsSoon: string; stage: Record<WoodsStage, string>; done: string; now: string; hint: string;
    /** The Rune practice list in the journal (saved on this device only). */
    learning: { title: string; none: string; level: string; firstTry: string; hints: string; tryMore: string; note: string; skills: Record<'counting' | 'patterns' | 'adding' | 'subtracting' | 'multistep', string> };
  };
  /** The cosmetics (customisation) panel. `{n}` is replaced with a number. */
  cosmetics: {
    slots: Record<'hair' | 'outfit' | 'legs' | 'shoes' | 'headgear' | 'cape' | 'weapon' | 'offhand' | 'colours', string>;
    rarity: Record<'common' | 'uncommon' | 'rare' | 'epic' | 'legendary', string>;
    equip: string; unequip: string; equipped: string; owned: string; locked: string; none: string; reachLevel: string; questReward: string; comingSoon: string;
    collections: string; zoom: string; turn: string; capeTint: string; hatTint: string; newItems: string; free: string; twoHanded: string; items: string;
  };
}

export const TEXT: Record<Lang, Strings> = {
  en: {
    elderName: 'Elder Tok Wan',
    objective: {
      talk: 'Talk to the Elder at the village gate',
      petals: 'Collect glow petals',
      sprouts: 'Calm the grumpy sprouts',
      runes: 'Wake the Rune Stone at the ruins',
      boss: 'Face the Old Mossback in the ruins',
      return: 'Return to the Elder',
      complete: 'Walk through the Moonlit Gate!',
    },
    elder: {
      talk: [
        'Welcome, young hero! The Whispering Woods have gone quiet and cranky.',
        `The glow petals that keep the woods calm have scattered. Please gather ${PETALS_NEEDED} of them.`,
        'Follow the trail north. Walk close to a petal and it will jump into your hands!',
      ],
      petals: ['The petals shine in the woods, off the trail. Keep looking!', 'Walk close to a petal to pick it up.'],
      sprouts: [`The sprouts are grumpy and hopping about. Calm ${SPROUTS_NEEDED} of them with your blade.`, 'Watch the red glow on the ground. It shows where they will jump. Dodge out of it!'],
      runes: [`The sprouts are calm. Well done! Now go north to the old Rune Stone, beside the ruins.`, `It asks ${RUNES_PER_RUN} riddles about counting and patterns. Answer them and the Old Mossback will wake up.`, 'Take your time. A wrong answer is fine. The stone will give you a hint!'],
      boss: ['The Old Mossback is awake in the ruins to the north. It is huge, but it is only cranky.', 'Learn its moves, dodge the glowing shapes, and strike when it rests. You can do it!'],
      return: ['You calmed the Old Mossback! The woods are whispering happily again.', 'Thank you, brave hero. The Moonlit Gate is open for you now. Here is a Mossy Cloak as a reward!'],
      complete: ['The Moonlit Gate shines for you, hero. Step through when you are ready!', 'You can wear the Mossy Cloak from the pause menu.'],
    },
    toast: {
      gather: `Gather ${PETALS_NEEDED} glow petals in the Whispering Woods!`,
      allPetals: `All ${PETALS_NEEDED} petals! Now calm ${SPROUTS_NEEDED} grumpy sprouts.`,
      runesCalling: 'The sprouts are calm! Visit the Rune Stone beside the ruins.',
      bossStirs: 'The runes glow! The Old Mossback is stirring in the ruins. Be brave!',
      bossCalm: 'The Old Mossback is calm again! Return to the Elder.',
      gateOpen: 'The Moonlit Gate is open! New reward: Mossy Cloak.',
      levelUp: 'Level up!', unlocked: 'Unlocked', fainted: 'Oops! Back to safety.', petal: 'Glow petal',
      patrol: 'Restless sprouts are back in the woods! Calm them for bonus XP.', patrolDone: 'Woods patrol finished! The sprouts are happy again.', patrolLine: 'Woods patrol: calm the restless sprouts', patrolPeace: 'The Whispering Woods are peaceful. Explore as you like!',
    },
    ui: {
      attack: 'Attack', dodge: 'Dodge', special: 'Spin', talk: 'Talk', read: 'Read', pause: 'Paused', resume: 'Resume', language: 'Language', startOver: 'Start the adventure over', sure: 'Tap again to be sure',
      outfit: 'Change outfit', accessories: 'Extras', none: 'None', controls: 'Controls', level: 'Level', sound: 'Sound', on: 'On', off: 'Off', boss: 'Old Mossback',
      endTitle: 'Adventure complete!', endBody: 'You calmed the woods, crossed the Moonlit Gate and woke the Heartstone of the Crystal Hollow. More adventures are on the way.', keepExploring: 'Keep exploring', playAgain: 'Play again',
      noWebgl: 'This device cannot show 3D graphics (WebGL). Try another browser or device.', loading: 'Loading the woods…', tapToContinue: 'Tap to continue', moveHint: 'Drag to move',
      use: 'Use', quest: 'Quest', menu: 'Menu', xp: 'XP', soon: 'Soon', levelShort: 'Lv', collapse: 'Show or hide the quest',
    },
    puzzle: {
      title: 'Rune Stone', practiceTitle: 'Rune Stone practice', riddleOf: 'Riddle {n} of {total}',
      runeName: { recognise: 'Rune of Number Names', twostep: 'Rune of Two Steps', count: 'Rune of Counting', pattern: 'Rune of Patterns', add: 'Rune of Adding', subtract: 'Rune of Taking Away' },
      askCount: 'How many glow petals are on the stone?', askPattern: 'What comes next?',
      askAdd: 'You have {a} petals. You find {b} more. How many petals now?', askSubtract: 'There are {a} petals. {b} float away. How many are left?',
      tapToCount: 'Tap each petal to count it.', startOverCount: 'Count again', plus: 'and',
      hint: { recognise: 'Count the petals to check. Which digit shows that many?', twostep: 'Do it in two steps. First put the petals together. Then take the floating ones away.', count: 'Let us count together, one by one.', pattern: 'Look at the pattern. What repeats?', add: 'Put all the petals together and count them.', subtract: 'Take the floating petals away. Then count the ones that are left.' },
      hintStep: 'Look at how much each number goes up or down.',
      hintLabel: 'Hint', askRecognise: 'Which number says “{w}”?', askTwoStep: 'You have {a} petals. You find {b} more. Then {c} float away. How many are left?',
      concept: { count: 'Counting means saying one number for each petal. The last number you say is how many there are.', recognise: 'Every number has a name and a digit. “five” is written 5, and it means five things.', add: 'Adding means putting groups together to make more. Count them all.', subtract: 'Taking away means some go, so fewer are left. Count the petals that stay.', twostep: 'Go one step at a time. Finish the first step, then use that answer for the second.', repeat: 'A pattern repeats in the same order. Find the part that repeats, then see what comes next.', step: 'In a number pattern, each number changes by the same amount every time.' },
      gate: { add: 'The basket has {a} glow petals for the gate lanterns. You add {b} more. How many petals now?', subtract: 'The basket has {a} glow petals. The lanterns use {b}. How many petals are left?' },
      tryAgain: 'Not quite. Try again!', correct: 'Yes! That is right.', correctFirst: 'Yes! First try!', revealed: 'The answer is {n}. Remember it for next time!',
      explain: { recognise: '“{w}” is the number {n}. Count {n} petals to check!', twostep: '{a} + {b} = {mid}, then {mid} − {c} = {n}.', count: 'There are {n} petals in all.', add: '{a} + {b} = {n}. Put them together and count!', subtract: '{a} − {b} = {n}. Take {b} away and {n} are left.', repeat: 'The pictures repeat in the same order, so this one comes next.', up: 'Each number goes up by {step}, so the next one is {n}.', down: 'Each number goes down by {step}, so the next one is {n}.' },
      symbol: { blossom: 'flower', leaf: 'leaf', mushroom: 'mushroom', star: 'star', moon: 'moon', butterfly: 'butterfly', ladybug: 'ladybird', apple: 'apple' },
      next: 'Next riddle', finish: 'Wake the stone!', close: 'Close', allAwake: 'The runes glow! The Old Mossback has woken up.', practiceAgain: 'Practise again',
      practiceNote: 'Practice gives no XP.', practiceDone: 'Well done! The runes shine for you.', xp: 'XP',
    },
    wardrobe: {
      title: 'Wardrobe', done: 'Done', random: 'Surprise me', reset: 'Original look', extras: 'Extras', drag: 'Drag to turn your hero',
      parts: { hood: 'Hood & hair', tunic: 'Tunic', trousers: 'Trousers', boots: 'Boots', gear: 'Pack & belt', skin: 'Skin', steel: 'Blade', eyes: 'Eyes' },
      moves: { stand: 'Stand', walk: 'Walk', slash: 'Slash', spin: 'Spin' },
    },
    controlsHelp: ['Move: W A S D or arrow keys (hold Shift to run)', 'Look around: drag the mouse, or Q and R', 'Attack: Space, J or click', 'Dodge roll: K', 'Spin attack: L', 'Talk or read the Rune Stone: E', 'Map: M', 'Bag: I', 'Hero: C', 'Pause: Esc'],
    map: { title: 'Map', close: 'Close', you: 'You', goal: 'Goal', hint: 'Press M or tap outside to close', labels: { village: 'Village', ruins: 'Old Ruins', pond: 'Pond', camp: 'Camp', tree: 'Ancient Tree', fairy: 'Fairy Ring', stone: 'Rune Stone', gate: 'Moonlit Gate' } },
    accessory: { 'leaf-crown': 'Leaf crown', 'mossy-cloak': 'Mossy cloak', 'glow-lantern': 'Glow lantern', 'crystal-hat': 'Crystal Hat' },
    hero: {
      heroTab: 'Hero', bagTab: 'Bag', journalTab: 'Journal', bag: 'Bag', close: 'Close', health: 'Health', level: 'Level', xpToNext: '{n} XP to next level', wearing: 'Wearing', changeOutfit: 'Change outfit', nothing: 'Nothing',
      nextReward: 'Next reward', allOpen: 'Every level reward is open!', collected: 'Collected', petals: 'Glow petals', sprouts: 'Sprouts calmed', riddles: 'Rune riddles', mossback: 'Old Mossback', calmed: 'Calmed', waiting: 'Waiting', rewards: 'Rewards earned', noRewards: 'Finish the quest to earn one.',
      itemsSoon: 'More items will appear here when the shop and loot come to the woods.', stage: { talk: 'Meet the Elder', petals: 'Gather glow petals', sprouts: 'Calm the sprouts', runes: 'Wake the Rune Stone', boss: 'Face the Old Mossback', return: 'Return to the Elder', complete: 'Walk through the Moonlit Gate' }, done: 'Done', now: 'Now', hint: 'Press I or C, or tap outside to close',
      learning: { title: 'Rune practice', none: 'Wake the Rune Stone to start your practice log.', level: 'Level', firstTry: 'first try', hints: 'hints', tryMore: 'Fun to practise more', note: 'Saved on this device only.', skills: { counting: 'Counting', patterns: 'Patterns', adding: 'Adding', subtracting: 'Taking away', multistep: 'Two steps' } },
    },
    cosmetics: {
      slots: { hair: 'Hair', outfit: 'Clothes', legs: 'Trousers', shoes: 'Shoes', headgear: 'Hats', cape: 'Capes', weapon: 'Weapons', offhand: 'Off hand', colours: 'Colours' },
      rarity: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' },
      equip: 'Wear', unequip: 'Take off', equipped: 'Wearing', owned: 'Owned', locked: 'Locked', none: 'None', reachLevel: 'Reach level {n}', questReward: 'Quest reward', comingSoon: 'Coming soon',
      collections: 'Collections', zoom: 'Zoom', turn: 'Drag to turn your hero', capeTint: 'Cape colour', hatTint: 'Hat colour',
      newItems: 'New things to wear!', free: 'Free', twoHanded: 'Two hands: no off-hand item', items: 'items',
    },
  },
  ms: {
    elderName: 'Tok Wan',
    objective: {
      talk: 'Bercakap dengan Tok Wan di pintu kampung',
      petals: 'Kumpul kelopak bercahaya',
      sprouts: 'Tenangkan anak pokok yang merajuk',
      runes: 'Bangunkan Batu Rune di runtuhan',
      boss: 'Hadapi Si Lumut Tua di runtuhan',
      return: 'Kembali kepada Tok Wan',
      complete: 'Masuk melalui Pintu Cahaya Bulan!',
    },
    elder: {
      talk: [
        'Selamat datang, wira muda! Hutan Berbisik sudah senyap dan panas baran.',
        `Kelopak bercahaya yang menenangkan hutan sudah bertaburan. Tolong kumpulkan ${PETALS_NEEDED} kelopak.`,
        'Ikut denai ke utara. Dekati kelopak dan ia akan melompat ke tanganmu!',
      ],
      petals: ['Kelopak bersinar di dalam hutan, jauh dari denai. Teruskan mencari!', 'Dekati kelopak untuk mengambilnya.'],
      sprouts: [`Anak-anak pokok sedang merajuk dan melompat-lompat. Tenangkan ${SPROUTS_NEEDED} daripadanya dengan pedangmu.`, 'Perhatikan cahaya merah di tanah. Ia menunjukkan tempat mereka akan melompat. Elak dari situ!'],
      runes: ['Anak-anak pokok sudah tenang. Syabas! Sekarang pergi ke utara, ke Batu Rune lama di tepi runtuhan.', `Ia bertanya ${RUNES_PER_RUN} teka-teki tentang mengira dan corak. Jawab semuanya dan Si Lumut Tua akan bangun.`, 'Jangan tergesa-gesa. Salah pun tidak mengapa. Batu itu akan memberi petunjuk!'],
      boss: ['Si Lumut Tua sudah bangun di runtuhan sebelah utara. Ia besar, tetapi hanya merajuk.', 'Pelajari gerakannya, elak bentuk bercahaya, dan serang ketika ia berehat. Kamu boleh!'],
      return: ['Kamu sudah menenangkan Si Lumut Tua! Hutan berbisik gembira semula.', 'Terima kasih, wira berani. Pintu Cahaya Bulan kini terbuka untukmu. Ini Jubah Lumut sebagai hadiah!'],
      complete: ['Pintu Cahaya Bulan bersinar untukmu, wira. Masuklah apabila kamu bersedia!', 'Kamu boleh memakai Jubah Lumut dari menu jeda.'],
    },
    toast: {
      gather: `Kumpul ${PETALS_NEEDED} kelopak bercahaya di Hutan Berbisik!`,
      allPetals: `Semua ${PETALS_NEEDED} kelopak! Sekarang tenangkan ${SPROUTS_NEEDED} anak pokok yang merajuk.`,
      runesCalling: 'Anak pokok sudah tenang! Pergi ke Batu Rune di tepi runtuhan.',
      bossStirs: 'Rune bersinar! Si Lumut Tua mula bergerak di runtuhan. Beranilah!',
      bossCalm: 'Si Lumut Tua sudah tenang! Kembali kepada Tok Wan.',
      gateOpen: 'Pintu Cahaya Bulan terbuka! Hadiah baharu: Jubah Lumut.',
      levelUp: 'Naik tahap!', unlocked: 'Dibuka', fainted: 'Alamak! Kembali ke tempat selamat.', petal: 'Kelopak bercahaya',
      patrol: 'Anak pokok yang gelisah kembali ke hutan! Tenangkan mereka untuk XP bonus.', patrolDone: 'Rondaan hutan selesai! Anak pokok sudah gembira semula.', patrolLine: 'Rondaan hutan: tenangkan anak pokok yang gelisah', patrolPeace: 'Hutan Berbisik aman damai. Terokai sesuka hati!',
    },
    ui: {
      attack: 'Serang', dodge: 'Elak', special: 'Pusing', talk: 'Bual', read: 'Baca', pause: 'Dijeda', resume: 'Sambung', language: 'Bahasa', startOver: 'Mulakan pengembaraan semula', sure: 'Tekan sekali lagi untuk pasti',
      outfit: 'Tukar pakaian', accessories: 'Tambahan', none: 'Tiada', controls: 'Kawalan', level: 'Tahap', sound: 'Bunyi', on: 'Buka', off: 'Tutup', boss: 'Si Lumut Tua',
      endTitle: 'Pengembaraan tamat!', endBody: 'Kamu menenangkan hutan, melalui Pintu Cahaya Bulan dan membangunkan Batu Hati di Gua Hablur. Lebih banyak pengembaraan akan datang.', keepExploring: 'Terus meneroka', playAgain: 'Main semula',
      noWebgl: 'Peranti ini tidak dapat memaparkan grafik 3D (WebGL). Cuba pelayar atau peranti lain.', loading: 'Memuatkan hutan…', tapToContinue: 'Ketik untuk sambung', moveHint: 'Seret untuk bergerak',
      use: 'Guna', quest: 'Pencarian', menu: 'Menu', xp: 'XP', soon: 'Nanti', levelShort: 'Thp', collapse: 'Tunjuk atau sorok pencarian',
    },
    puzzle: {
      title: 'Batu Rune', practiceTitle: 'Latihan Batu Rune', riddleOf: 'Teka-teki {n} daripada {total}',
      runeName: { recognise: 'Rune Nama Nombor', twostep: 'Rune Dua Langkah', count: 'Rune Mengira', pattern: 'Rune Corak', add: 'Rune Tambah', subtract: 'Rune Tolak' },
      askCount: 'Berapakah kelopak bercahaya di atas batu ini?', askPattern: 'Apakah yang seterusnya?',
      askAdd: 'Kamu ada {a} kelopak. Kamu jumpa {b} lagi. Berapakah kelopak sekarang?', askSubtract: 'Ada {a} kelopak. {b} kelopak terbang pergi. Berapakah yang tinggal?',
      tapToCount: 'Ketik setiap kelopak untuk mengira.', startOverCount: 'Kira semula', plus: 'dan',
      hint: { recognise: 'Kira kelopak untuk menyemak. Angka yang manakah menunjukkan jumlah itu?', twostep: 'Buat dua langkah. Mula-mula satukan kelopak. Kemudian ambil yang hanyut pergi.', count: 'Mari kita kira bersama, satu demi satu.', pattern: 'Lihat coraknya. Apakah yang berulang?', add: 'Satukan semua kelopak dan kira kesemuanya.', subtract: 'Ambil pergi kelopak yang terapung. Kemudian kira yang tinggal.' },
      hintStep: 'Lihat berapa banyak setiap nombor naik atau turun.',
      hintLabel: 'Petunjuk', askRecognise: 'Nombor yang manakah “{w}”?', askTwoStep: 'Kamu ada {a} kelopak. Kamu jumpa {b} lagi. Kemudian {c} hanyut pergi. Berapa yang tinggal?',
      concept: { count: 'Mengira bermaksud menyebut satu nombor untuk setiap kelopak. Nombor terakhir ialah jumlahnya.', recognise: 'Setiap nombor ada nama dan angka. “lima” ditulis 5, dan bermaksud lima benda.', add: 'Menambah bermaksud menyatukan kumpulan supaya jadi lebih banyak. Kira semuanya.', subtract: 'Menolak bermaksud ada yang pergi, jadi tinggal lebih sedikit. Kira kelopak yang tinggal.', twostep: 'Buat satu langkah demi satu langkah. Siapkan langkah pertama, kemudian guna jawapannya untuk langkah kedua.', repeat: 'Corak berulang dengan susunan yang sama. Cari bahagian yang berulang, kemudian lihat apa yang seterusnya.', step: 'Dalam corak nombor, setiap nombor berubah dengan jumlah yang sama setiap kali.' },
      gate: { add: 'Bakul ada {a} kelopak bercahaya untuk tanglung pintu gerbang. Kamu tambah {b} lagi. Berapa kelopak sekarang?', subtract: 'Bakul ada {a} kelopak bercahaya. Tanglung guna {b}. Berapa kelopak yang tinggal?' },
      tryAgain: 'Belum tepat. Cuba lagi!', correct: 'Ya! Betul.', correctFirst: 'Ya! Betul sekali jalan!', revealed: 'Jawapannya ialah {n}. Ingat untuk lain kali!',
      explain: { recognise: '“{w}” ialah nombor {n}. Kira {n} kelopak untuk menyemak!', twostep: '{a} + {b} = {mid}, kemudian {mid} − {c} = {n}.', count: 'Ada {n} kelopak semuanya.', add: '{a} + {b} = {n}. Satukan semuanya dan kira!', subtract: '{a} − {b} = {n}. Ambil {b} pergi, tinggal {n}.', repeat: 'Gambar-gambar berulang mengikut turutan yang sama, jadi inilah yang seterusnya.', up: 'Setiap nombor naik sebanyak {step}, jadi yang seterusnya ialah {n}.', down: 'Setiap nombor turun sebanyak {step}, jadi yang seterusnya ialah {n}.' },
      symbol: { blossom: 'bunga', leaf: 'daun', mushroom: 'cendawan', star: 'bintang', moon: 'bulan', butterfly: 'rama-rama', ladybug: 'kumbang kecil', apple: 'epal' },
      next: 'Teka-teki seterusnya', finish: 'Bangunkan batu!', close: 'Tutup', allAwake: 'Rune bersinar! Si Lumut Tua sudah bangun.', practiceAgain: 'Berlatih lagi',
      practiceNote: 'Latihan tidak memberi XP.', practiceDone: 'Syabas! Rune bersinar untukmu.', xp: 'XP',
    },
    wardrobe: {
      title: 'Almari Pakaian', done: 'Siap', random: 'Kejutkan saya', reset: 'Rupa asal', extras: 'Tambahan', drag: 'Seret untuk memusingkan wira',
      parts: { hood: 'Tudung & rambut', tunic: 'Baju', trousers: 'Seluar', boots: 'Kasut but', gear: 'Beg & tali pinggang', skin: 'Kulit', steel: 'Bilah', eyes: 'Mata' },
      moves: { stand: 'Berdiri', walk: 'Jalan', slash: 'Tebas', spin: 'Pusing' },
    },
    controlsHelp: ['Bergerak: W A S D atau kekunci anak panah (tekan Shift untuk berlari)', 'Lihat sekeliling: seret tetikus, atau Q dan R', 'Serang: Space, J atau klik', 'Guling elak: K', 'Serangan pusing: L', 'Bual atau baca Batu Rune: E', 'Peta: M', 'Beg: I', 'Wira: C', 'Jeda: Esc'],
    map: { title: 'Peta', close: 'Tutup', you: 'Anda', goal: 'Matlamat', hint: 'Tekan M atau ketik di luar untuk tutup', labels: { village: 'Kampung', ruins: 'Runtuhan Lama', pond: 'Kolam', camp: 'Khemah', tree: 'Pokok Purba', fairy: 'Bulatan Pari-pari', stone: 'Batu Rune', gate: 'Pintu Bulan' } },
    accessory: { 'leaf-crown': 'Mahkota daun', 'mossy-cloak': 'Jubah lumut', 'glow-lantern': 'Tanglung bercahaya', 'crystal-hat': 'Topi Hablur' },
    hero: {
      heroTab: 'Wira', bagTab: 'Beg', journalTab: 'Jurnal', bag: 'Beg', close: 'Tutup', health: 'Kesihatan', level: 'Tahap', xpToNext: '{n} XP lagi untuk tahap seterusnya', wearing: 'Dipakai', changeOutfit: 'Tukar pakaian', nothing: 'Tiada',
      nextReward: 'Hadiah seterusnya', allOpen: 'Semua hadiah tahap sudah dibuka!', collected: 'Dikumpul', petals: 'Kelopak bercahaya', sprouts: 'Tunas ditenangkan', riddles: 'Teka-teki rune', mossback: 'Si Lumut Tua', calmed: 'Tenang', waiting: 'Menunggu', rewards: 'Hadiah diterima', noRewards: 'Tamatkan pencarian untuk mendapatkannya.',
      itemsSoon: 'Lebih banyak barang akan muncul di sini apabila kedai dan rampasan tiba di hutan.', stage: { talk: 'Jumpa Tok Wan', petals: 'Kumpul kelopak bercahaya', sprouts: 'Tenangkan tunas', runes: 'Bangunkan Batu Rune', boss: 'Hadapi Mossback Tua', return: 'Kembali kepada Tok Wan', complete: 'Masuk ke Pintu Cahaya Bulan' }, done: 'Siap', now: 'Kini', hint: 'Tekan I atau C, atau ketik di luar untuk tutup',
      learning: { title: 'Latihan rune', none: 'Bangunkan Batu Rune untuk mula catatan latihan.', level: 'Tahap', firstTry: 'cuba pertama', hints: 'petunjuk', tryMore: 'Seronok untuk berlatih lagi', note: 'Disimpan pada peranti ini sahaja.', skills: { counting: 'Mengira', patterns: 'Corak', adding: 'Menambah', subtracting: 'Menolak', multistep: 'Dua langkah' } },
    },
    cosmetics: {
      slots: { hair: 'Rambut', outfit: 'Pakaian', legs: 'Seluar', shoes: 'Kasut', headgear: 'Topi', cape: 'Jubah', weapon: 'Senjata', offhand: 'Tangan kiri', colours: 'Warna' },
      rarity: { common: 'Biasa', uncommon: 'Agak jarang', rare: 'Jarang', epic: 'Epik', legendary: 'Lagenda' },
      equip: 'Pakai', unequip: 'Tanggalkan', equipped: 'Dipakai', owned: 'Dimiliki', locked: 'Berkunci', none: 'Tiada', reachLevel: 'Capai tahap {n}', questReward: 'Hadiah pencarian', comingSoon: 'Akan datang',
      collections: 'Koleksi', zoom: 'Zum', turn: 'Seret untuk memusingkan wira', capeTint: 'Warna jubah', hatTint: 'Warna topi',
      newItems: 'Ada pakaian baharu!', free: 'Percuma', twoHanded: 'Dua tangan: tiada barang tangan kiri', items: 'barang',
    },
  },
};

/** Replaces `{a}`, `{b}`, `{n}` ... in a string with values. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export function objectiveLine(lang: Lang, p: Progress): string {
  const base = TEXT[lang].objective[p.stage];
  if (p.stage === 'petals') return `${base} (${Math.min(p.petalIds.length, PETALS_NEEDED)}/${PETALS_NEEDED})`;
  if (p.stage === 'sprouts') return `${base} (${Math.min(p.sproutsCalmed, SPROUTS_NEEDED)}/${SPROUTS_NEEDED})`;
  if (p.stage === 'runes') return `${base} (${Math.min(p.runesSolved, RUNES_PER_RUN)}/${RUNES_PER_RUN})`;
  // after the quest: once the patrol has started the card follows it (the gate line stays until the first returning sprout is calmed)
  if (p.stage === 'complete' && p.bonusXp >= BONUS_XP_CAP) return TEXT[lang].toast.patrolPeace;
  if (p.stage === 'complete' && p.bonusXp > 0) return `${TEXT[lang].toast.patrolLine} (${Math.round(p.bonusXp / PATROL_XP)}/${BONUS_XP_CAP / PATROL_XP})`;
  return base;
}

/** A banner for a quest change, or null when nothing worth announcing happened. */
export function questToast(lang: Lang, before: Progress, after: Progress): string | null {
  const t = TEXT[lang].toast;
  if (before.stage === after.stage) return null;
  switch (after.stage) {
    case 'petals': return t.gather;
    case 'sprouts': return t.allPetals;
    case 'runes': return t.runesCalling;
    case 'boss': return t.bossStirs;
    case 'return': return t.bossCalm;
    case 'complete': return t.gateOpen;
    default: return null;
  }
}

const NUMBER_WORDS: Record<Lang, readonly string[]> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
  ms: ['kosong', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan', 'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'lapan belas', 'sembilan belas', 'dua puluh'],
};
/** The word for 0 to 20 ("five" / "lima"); the number itself above that. */
export const numberWord = (lang: Lang, n: number): string => NUMBER_WORDS[lang][n] ?? String(n);

/** One kind sentence on why a riddle's answer is right. */
export function explanationText(lang: Lang, x: Explanation): string {
  const t = TEXT[lang].puzzle.explain;
  switch (x.kind) {
    case 'count': return fill(t.count, { n: x.n });
    case 'recognise': return fill(t.recognise, { w: numberWord(lang, x.n), n: x.n });
    case 'twostep': return fill(t.twostep, { a: x.a, b: x.b, c: x.c, mid: x.mid, n: x.n });
    case 'add': return fill(t.add, { a: x.a, b: x.b, n: x.n });
    case 'subtract': return fill(t.subtract, { a: x.a, b: x.b, n: x.n });
    case 'repeat': return t.repeat;
    case 'up': return fill(t.up, { step: x.step, n: x.n });
    case 'down': return fill(t.down, { step: x.step, n: x.n });
  }
}

export function parseLang(v: unknown): Lang { return v === 'ms' ? 'ms' : 'en'; }
export function loadLang(): Lang { try { return parseLang(localStorage.getItem(LANG_STORAGE_KEY)); } catch { return 'en'; } }
export function saveLang(l: Lang): void { try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* private mode: fine */ } }
