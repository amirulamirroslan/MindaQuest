/**
 * The skills the Rune Stone (and the Elder's questions) practise. A skill belongs to a subject; riddle kinds map to skills.
 * To add a new subject or skill: add it here, map its riddle kinds in `SKILL_OF_KIND`, make the riddles in `systems/runePuzzle.ts`
 * (or a sibling generator) and add its words to `data/woodsText.ts` (the tests fail until both languages have them).
 */
import { RUNE_STAR_XP, RUNE_XP, type Tier } from '../systems/woodsQuest';
import type { Riddle, RiddleKind } from '../systems/runePuzzle';

export type Subject = 'maths';
export type Skill = 'counting' | 'patterns' | 'adding' | 'subtracting' | 'multistep';
export const SKILLS: readonly Skill[] = ['counting', 'patterns', 'adding', 'subtracting', 'multistep'];
export const SKILL_SUBJECT: Readonly<Record<Skill, Subject>> = { counting: 'maths', patterns: 'maths', adding: 'maths', subtracting: 'maths', multistep: 'maths' };
export const SKILL_OF_KIND: Readonly<Record<RiddleKind, Skill>> = { count: 'counting', recognise: 'counting', pattern: 'patterns', add: 'adding', subtract: 'subtracting', twostep: 'multistep' };
export const skillOf = (r: Riddle): Skill => SKILL_OF_KIND[r.kind];

/** The three difficulty tiers, for people reading the code and the docs (children only see small pips). */
export const TIER_NAMES: Readonly<Record<Tier, string>> = { 1: 'Foundation', 2: 'Developing', 3: 'Challenge' };
/** Multi-step reasoning only exists at the Challenge tier. */
export const FIXED_TIER: Readonly<Partial<Record<Skill, Tier>>> = { multistep: 3 };

/** What a finished challenge pays: the same for every skill and tier, so no skill is a better "XP farm" than another. */
export const REWARD = { xp: RUNE_XP, firstTryBonus: RUNE_STAR_XP } as const;
