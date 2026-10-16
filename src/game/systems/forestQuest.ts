export const TIMBER_GOAL = 12;
export const BRIDGE_REWARD_XP = 100;

export type ForestQuestStage = 'unstarted' | 'collecting' | 'bridge-repaired' | 'complete';

/** Session-only quest state. Item IDs and the one-time reward are tracked explicitly. */
export class ForestQuest {
  private readonly collected = new Set<string>();
  private currentStage: ForestQuestStage = 'unstarted';
  private currentXp = 0;

  get stage() { return this.currentStage; }
  get timberCount() { return this.collected.size; }
  get xp() { return this.currentXp; }
  hasCollected(itemId: string) { return this.collected.has(itemId); }
  get canRepairBridge() { return this.currentStage === 'collecting' && this.timberCount >= TIMBER_GOAL; }

  start() {
    if (this.currentStage !== 'unstarted') return false;
    this.currentStage = 'collecting';
    return true;
  }

  collect(itemId: string) {
    if (this.currentStage !== 'collecting' || this.collected.size >= TIMBER_GOAL || this.collected.has(itemId)) return false;
    this.collected.add(itemId);
    return true;
  }

  repairBridge() {
    if (!this.canRepairBridge) return false;
    this.currentStage = 'bridge-repaired';
    return true;
  }

  completeAfterCrossing() {
    if (this.currentStage !== 'bridge-repaired') return false;
    this.currentStage = 'complete';
    this.currentXp += BRIDGE_REWARD_XP;
    return true;
  }
}
