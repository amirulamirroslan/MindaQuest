import type { ForestQuestStage } from './forestQuest';

/** Short objective shown in the HUD. Kept free of Phaser so it can be tested and localised later. */
export function objectiveLabel(stage: ForestQuestStage, canRepair: boolean): string {
  switch (stage) {
    case 'unstarted': return 'Meet Lina the trail keeper';
    case 'collecting': return canRepair ? 'Repair the bridge' : 'Collect timber for the bridge';
    case 'bridge-repaired': return 'Cross the bridge';
    default: return 'Quest complete!';
  }
}

export function bridgePrompt(stage: ForestQuestStage, canRepair: boolean, timber: number, goal: number, action: string): string {
  if (stage === 'collecting' && canRepair) return `${action}  ·  Repair the bridge`;
  if (stage === 'bridge-repaired') return 'Bridge repaired  ·  Cross to the east bank';
  if (stage === 'complete') return 'Quest complete  ·  Keep exploring';
  return `Bridge broken  ·  Timber ${timber}/${goal}`;
}

export const talkPrompt = (action: string) => `${action}  ·  Talk to Lina`;
export const timberPrompt = (action: string) => `${action}  ·  Pick up timber`;
export const actionLabel = (touch: boolean) => (touch ? 'USE' : 'E');
