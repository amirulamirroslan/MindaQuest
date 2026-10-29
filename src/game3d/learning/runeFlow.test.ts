import { describe, expect, it } from 'vitest';
import { TEXT, explanationText, numberWord, type Lang } from '../data/woodsText';
import { mulberry32 } from '../systems/layout3d';
import { answerText, explain, makePlannedRun, makeRecognise, makeTwoStep, makeCount, makePattern, makeSum, type Riddle, type RiddleKind } from '../systems/runePuzzle';
import {
  PETALS_NEEDED, PETAL_XP, RUNES_PER_RUN, RUNE_STAR_XP, RUNE_XP, SPROUTS_NEEDED, SPROUT_XP, loadProgress, newProgress, reduceQuest, saveProgress, type Progress, type QuestEvent,
} from '../systems/woodsQuest';
import { loadLearning, planRun, recordResult, recordStart, saveLearning, summarise, tierOf, type LearningProfile } from './profile';
import { REWARD, SKILLS, SKILL_OF_KIND } from './skills';
import { ChallengeSession } from './session';

type Behaviour = 'clean' | 'hint' | 'slip' | 'shown';
function memory() { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; }

/** Answers one riddle the way a child of a given kind would, through the same session the game uses, and logs it. */
function answer(p: LearningProfile, r: Riddle, how: Behaviour): { p: LearningProfile; slips: number; firstTry: boolean } {
  const s = new ChallengeSession(r); let next = recordStart(p, r);
  if (how === 'hint') s.hint();
  const wrong = r.options.map((_, i) => i).filter(i => i !== r.answer);
  if (how === 'slip') s.choose(wrong[0]);
  if (how === 'shown') { s.choose(wrong[0]); s.choose(wrong[1]); }
  if (!s.done) s.choose(r.answer);
  next = recordResult(next, r, s.result()!);
  return { p: next, slips: s.slips, firstTry: s.firstTry };
}

describe('the Rune Stone quest flow, with learning', () => {
  it('plays from the first word to the awakened stone: hints and retries cost nothing, stars are for no slips, everything is saved', () => {
    const quest = memory(), learn = memory();
    let prog: Progress = newProgress(), xp = 0; let prof = loadLearning(learn);
    const send = (e: QuestEvent) => { const r = reduceQuest(prog, e); prog = r.state; xp += r.xpGained; saveProgress(prog, quest); prog = loadProgress(quest); };

    send({ kind: 'talked' }); for (let i = 0; i < PETALS_NEEDED; i++) send({ kind: 'petal', id: i });
    for (let i = 0; i < SPROUTS_NEEDED; i++) send({ kind: 'enemyDefeated', enemy: 'sprout' });
    expect(prog.stage).toBe('runes'); const before = xp;

    const run = makePlannedRun(2024, planRun(prof, prog.runeTier, 2024), prof.recent);
    expect(run).toHaveLength(RUNES_PER_RUN);
    const how: Behaviour[] = ['hint', 'slip', 'clean']; const stars: boolean[] = [];
    run.forEach((r, i) => { const a = answer(prof, r, how[i]); prof = a.p; stars.push(a.firstTry); send({ kind: 'runeSolved', index: i, mistakes: a.slips }); saveLearning(prof, learn); });

    expect(stars).toEqual([true, false, true]); // a hint keeps the first-try star; a retry does not
    expect(prog.stage).toBe('boss');
    expect(xp - before).toBe(RUNES_PER_RUN * RUNE_XP + 2 * RUNE_STAR_XP); // every riddle pays; only the stars differ

    const back = loadLearning(learn); // a page refresh
    expect(back).toEqual(prof);
    const rows = summarise(back); expect(rows.reduce((n, r) => n + r.completed, 0)).toBe(3); expect(rows.reduce((n, r) => n + r.hints, 0)).toBe(1); expect(rows.reduce((n, r) => n + r.retries, 0)).toBe(1);
  });

  it('shows the answer after two slips and still lets the quest go on, at the same XP', () => {
    let prog = newProgress(); let prof = loadLearning(memory()); let xp = 0;
    for (const e of [{ kind: 'talked' }, ...Array.from({ length: PETALS_NEEDED }, (_, i) => ({ kind: 'petal' as const, id: i })), ...Array.from({ length: SPROUTS_NEEDED }, () => ({ kind: 'enemyDefeated' as const, enemy: 'sprout' as const }))] as QuestEvent[]) prog = reduceQuest(prog, e).state;
    makePlannedRun(7, planRun(prof, 1, 7), []).forEach((r, i) => { const a = answer(prof, r, 'shown'); prof = a.p; const q = reduceQuest(prog, { kind: 'runeSolved', index: i, mistakes: a.slips }); prog = q.state; xp += q.xpGained; });
    expect(prog.stage).toBe('boss'); expect(xp).toBe(RUNES_PER_RUN * RUNE_XP); // no star, but nothing is taken away
  });

  it('pays the same for every skill and tier, so no skill is better for collecting XP', () => {
    expect(REWARD).toEqual({ xp: RUNE_XP, firstTryBonus: RUNE_STAR_XP }); expect(SPROUT_XP + PETAL_XP).toBeGreaterThan(0);
  });
});

describe('difficulty follows the child over several runs', () => {
  const runAll = (p: LearningProfile, seed: number, how: Behaviour): LearningProfile => makePlannedRun(seed, planRun(p, 1, seed), p.recent).reduce((acc, r) => answer(acc, r, how).p, p);

  it('moves up skill by skill as clean answers come in', () => {
    let p = loadLearning(memory());
    p = runAll(p, 11, 'clean'); expect(tierOf(p, 'counting', 1)).toBe(1);
    p = runAll(p, 12, 'clean'); expect(tierOf(p, 'counting', 1)).toBe(2); expect(tierOf(p, 'patterns', 1)).toBe(2);
    p = runAll(p, 13, 'clean'); p = runAll(p, 14, 'clean');
    expect(tierOf(p, 'adding', 1)).toBeGreaterThanOrEqual(2); expect(tierOf(p, 'subtracting', 1)).toBeGreaterThanOrEqual(2);
  });
  it('does not rush a child who needs hints, and eases off one who needs the answers shown', () => {
    let p = loadLearning(memory()); for (let i = 0; i < 4; i++) p = runAll(p, 20 + i, 'hint');
    expect(SKILLS.filter(s => s !== 'multistep').every(s => tierOf(p, s, 1) === 1)).toBe(true); // asking for hints never moves the level up
    let q = loadLearning(memory()); q = runAll(q, 30, 'clean'); q = runAll(q, 31, 'clean'); expect(tierOf(q, 'counting', 1)).toBe(2);
    q = runAll(q, 32, 'hint'); q = runAll(q, 33, 'shown'); expect(tierOf(q, 'counting', 1)).toBe(1);
  });
});

describe('every kind of riddle is explained in both languages', () => {
  const sample = (): Riddle[] => {
    const out: Riddle[] = [];
    for (let seed = 1; seed <= 120; seed++) { const r = mulberry32(seed); out.push(makeCount(1, r), makeCount(3, r), makeRecognise(1, r), makePattern(1, r), makePattern(2, r), makePattern(3, r), makeSum('add', 2, r), makeSum('subtract', 3, r), makeTwoStep(r)); }
    return out;
  };
  it('has an explanation with no gaps, the number word, and the real answer', () => {
    const kinds = new Set<RiddleKind>();
    for (const lang of ['en', 'ms'] as Lang[]) for (const r of sample()) {
      kinds.add(r.kind); const x = explain(r), text = explanationText(lang, x);
      expect(text).not.toMatch(/[{}]/); expect(text.length).toBeGreaterThan(8);
      if (x.kind !== 'repeat') expect(text).toContain(String(x.n));
      if (r.kind === 'recognise') expect(text).toContain(numberWord(lang, r.n));
      if (r.kind === 'twostep') expect(text).toContain(answerText(r));
    }
    expect([...kinds].sort()).toEqual(['add', 'count', 'pattern', 'recognise', 'subtract', 'twostep']);
  });
  it('has hints, ideas for wrong answers and names in English and Malay for every kind, and every skill is named', () => {
    for (const lang of ['en', 'ms'] as Lang[]) {
      const p = TEXT[lang].puzzle;
      for (const k of Object.keys(SKILL_OF_KIND) as RiddleKind[]) { expect(p.hint[k].length).toBeGreaterThan(5); expect(p.runeName[k].length).toBeGreaterThan(3); }
      for (const v of Object.values(p.concept)) expect(v.length).toBeGreaterThan(10);
      expect(Object.keys(TEXT[lang].hero.learning.skills).sort()).toEqual([...SKILLS].sort());
      expect(p.gate.add).toContain('{a}'); expect(p.gate.subtract).toContain('{b}');
    }
    expect(numberWord('en', 5)).toBe('five'); expect(numberWord('ms', 5)).toBe('lima'); expect(numberWord('en', 99)).toBe('99');
  });
});
