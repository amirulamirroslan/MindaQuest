import { TIMBER_GOAL } from '../systems/forestQuest';

/** Player-facing story text, kept apart from scene logic so it can be reviewed and translated. */
export const LINA = 'LINA · TRAIL KEEPER';

export const linaIntro = [
  'Hello, Explorer! The river bridge is broken. Could you find 12 pieces of timber on this side?',
  'Walk near a timber piece and press its button to pick it up. When you have all 12, go to the bridge and repair it!',
];
export const linaReady = ['You found all 12 pieces! Go to the broken bridge and mend it.'];
export const linaProgress = (count: number) => [`The bridge needs ${TIMBER_GOAL} pieces of timber. You have ${count} so far. Look along the forest trail!`];
export const linaDone = ['Wonderful work, Explorer! The bridge is safe again. Have fun exploring the forest!'];

export const BRIDGE_REPAIRED = 'BRIDGE REPAIRED!';
export const bridgeRepairedPages = ['The new planks are strong and safe. Walk across to the other side to finish your quest and earn XP!'];
export const BRIDGE_BROKEN = 'BROKEN BRIDGE';
export const bridgeNeedsTimber = (missing: number) => [`This bridge still has a gap. Find ${missing} more pieces of timber, then come back here to repair it.`];
export const bridgeNeedsLina = ['The bridge is broken. Find Lina, the trail keeper, to learn how you can help.'];

export const QUEST_COMPLETE = 'QUEST COMPLETE';
export const questCompletePages = [
  'You gathered all 12 pieces of timber, repaired the bridge, and crossed safely!',
  'You earned 100 XP. The whole forest is open to explore now!',
];
