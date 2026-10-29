/**
 * One challenge being answered (pure, unit-tested; the Rune Stone card and the Elder's question both use it).
 * Gentle by design: a wrong answer fades that button and never costs XP; a hint is free; after `REVEAL_AFTER` slips the answer is shown, so
 * nobody is ever stuck. "First try" means no wrong answer: asking for a hint first does not take it away.
 */
import { REVEAL_AFTER, isRight, type Riddle } from '../systems/runePuzzle';

export type SessionPhase = 'asking' | 'solved' | 'revealed';
export type ChoiceResult = 'ignored' | 'right' | 'wrong' | 'revealed';
export interface SessionResult { slips: number; hinted: boolean; revealed: boolean; firstTry: boolean }

export class ChallengeSession {
  phase: SessionPhase = 'asking';
  slips = 0;
  hintUsed = false;
  /** Answer buttons already tried wrongly (they fade out and cannot be counted again). */
  readonly wrong = new Set<number>();

  constructor(readonly riddle: Riddle, private readonly revealAfter = REVEAL_AFTER) {}

  get done(): boolean { return this.phase !== 'asking'; }
  /** Solved with no wrong answer (a hint does not matter). A revealed answer is never a first try. */
  get firstTry(): boolean { return this.phase === 'solved' && this.slips === 0; }

  /** Asks for the hint. True the first time (so a counting hint starts once), false after. */
  hint(): boolean { if (this.done || this.hintUsed) return false; this.hintUsed = true; return true; }

  choose(index: number): ChoiceResult {
    if (this.done || !Number.isInteger(index) || index < 0 || index >= this.riddle.options.length || this.wrong.has(index)) return 'ignored';
    if (isRight(this.riddle, index)) { this.phase = 'solved'; return 'right'; }
    this.slips++; this.wrong.add(index);
    if (this.slips >= this.revealAfter) { this.phase = 'revealed'; return 'revealed'; }
    return 'wrong';
  }

  result(): SessionResult | null {
    return this.done ? { slips: this.slips, hinted: this.hintUsed, revealed: this.phase === 'revealed', firstTry: this.firstTry } : null;
  }
}
