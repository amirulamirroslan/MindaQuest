import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../systems/layout3d';
import { makeCount, makePattern, makePlannedRun, makeRecognise, makeSum, makeTwoStep, signatureOf, type Riddle } from '../systems/runePuzzle';
import type { Tier } from '../systems/woodsQuest';
import {
  EVIDENCE_WINDOW, LEARNING_STORAGE_KEY, RECENT_LIMIT, classify, decideTier, loadLearning, needsPractice, newProfile, planRun, recordResult, recordStart,
  sanitizeProfile, saveLearning, summarise, tierOf, type LearningProfile, type Outcome,
} from './profile';

const rnd = mulberry32(99);
const countAt = (t: Tier): Riddle => makeCount(t, rnd);
const addAt = (t: Tier): Riddle => makeSum('add', t, rnd);
const CLEAN = { slips: 0, hinted: false, revealed: false }, HINT = { slips: 0, hinted: true, revealed: false }, SLIP = { slips: 1, hinted: false, revealed: false }, SHOWN = { slips: 2, hinted: false, revealed: true };
function memory() { const m: Record<string, string> = {}; return { m, getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; }
const play = (p: LearningProfile, r: Riddle, res: typeof CLEAN): LearningProfile => recordResult(recordStart(p, r), r, res);

describe('how a riddle is judged', () => {
  it('is clean, steady or struggled by what the child did', () => {
    expect(classify(CLEAN)).toBe('clean'); expect(classify(HINT)).toBe('steady'); expect(classify(SLIP)).toBe('steady'); expect(classify(SHOWN)).toBe('struggled');
  });
});

describe('difficulty adapts to what the child has shown', () => {
  const D = (o: Outcome[], t: Tier) => decideTier(o, t);
  it('goes up after two clean riddles in a row, never above 3', () => {
    expect(D(['clean', 'clean'], 1)).toBe(2); expect(D(['steady', 'clean'], 1)).toBe(1); expect(D(['clean'], 1)).toBe(1); expect(D(['clean', 'clean'], 3)).toBe(3);
  });
  it('is not moved by hints or by one stumble among good answers', () => {
    expect(D(['steady', 'steady', 'steady'], 2)).toBe(2); expect(D(['clean', 'struggled'], 2)).toBe(2); expect(D(['clean', 'clean', 'steady'], 2)).toBe(2);
  });
  it('goes down when the answer had to be shown again soon, never below 1', () => {
    expect(D(['steady', 'struggled'], 2)).toBe(1); expect(D(['struggled', 'clean', 'struggled'], 3)).toBe(2); expect(D(['struggled', 'struggled'], 1)).toBe(1);
  });

  it('steps up after two clean riddles of a skill and starts the evidence afresh', () => {
    let p = newProfile(); p = play(p, countAt(1), CLEAN); expect(tierOf(p, 'counting', 1)).toBe(1);
    p = play(p, countAt(1), CLEAN); expect(tierOf(p, 'counting', 1)).toBe(2); expect(p.skills.counting?.recent).toEqual([]);
    p = play(p, countAt(2), CLEAN); expect(tierOf(p, 'counting', 1)).toBe(2); // one clean at the new tier is not yet enough
    p = play(p, countAt(2), SHOWN); expect(p.skills.counting?.revealed).toBe(1);
  });
  it('does not count a riddle made at an older tier as evidence for the new one', () => {
    let p = newProfile(); p = play(play(p, countAt(1), CLEAN), countAt(1), CLEAN); // now tier 2
    p = play(p, countAt(1), SHOWN); expect(p.skills.counting?.recent).toEqual([]); expect(p.skills.counting?.tier).toBe(2);
  });
  it('steps down after a struggle that follows another slip', () => {
    let p = newProfile(); p = play(play(p, countAt(1), CLEAN), countAt(1), CLEAN); p = play(p, countAt(2), HINT); p = play(p, countAt(2), SHOWN);
    expect(tierOf(p, 'counting', 1)).toBe(1);
  });
  it('keeps the evidence window short', () => {
    let p = newProfile(); for (let i = 0; i < 9; i++) p = play(p, countAt(1), HINT); expect(p.skills.counting!.recent.length).toBeLessThanOrEqual(EVIDENCE_WINDOW);
  });
});

describe('the practice log', () => {
  it('counts attempts, completions, first tries, retries, hints and shown answers', () => {
    let p = newProfile();
    p = play(p, addAt(1), CLEAN); p = play(p, addAt(1), HINT); p = play(p, addAt(1), SLIP); p = play(p, addAt(1), SHOWN);
    const r = p.skills.adding!;
    expect(r).toMatchObject({ attempted: 4, completed: 4, firstTry: 2, retries: 3, hints: 1, revealed: 1 });
  });
  it('counts a riddle that was shown but never finished as attempted only', () => {
    const p = recordStart(newProfile(), addAt(1)); expect(p.skills.adding).toMatchObject({ attempted: 1, completed: 0 });
  });
  it('remembers recent riddles once each, oldest first, up to a limit', () => {
    let p = newProfile(); const a = countAt(1); p = recordStart(p, a); p = recordStart(p, a); expect(p.recent).toEqual([signatureOf(a)]);
    for (let i = 0; i < 60; i++) p = recordStart(p, makePattern(3, mulberry32(i + 1)));
    expect(p.recent.length).toBeLessThanOrEqual(RECENT_LIMIT);
  });
  it('lists practised skills and offers "more practice" only after a recent struggle', () => {
    let p = newProfile(); expect(summarise(p)).toEqual([]);
    p = play(p, addAt(1), CLEAN); p = play(p, addAt(1), SHOWN);
    const row = summarise(p)[0]; expect(row).toMatchObject({ skill: 'adding', attempted: 2, completed: 2, firstTry: 1 }); expect(row.practice).toBe(needsPractice(p.skills.adding)); expect(row.practice).toBe(true);
  });
});

describe('choosing the next riddles from what has been shown', () => {
  it('starts from the quest tier for skills with no history', () => {
    const plan = planRun(newProfile(), 2, 4); expect(plan.counting.tier).toBe(2); expect(plan.pattern.tier).toBe(2); expect(plan.maths.tier).toBe(2);
  });
  it('uses each skill\'s own tier', () => {
    let p = newProfile(); p = play(play(p, countAt(1), CLEAN), countAt(1), CLEAN);
    const plan = planRun(p, 1, 3); expect(plan.counting.tier).toBe(2); expect(plan.pattern.tier).toBe(1);
  });
  it('balances adding and taking away: the less practised one comes next', () => {
    let p = newProfile(); p = play(p, addAt(1), CLEAN);
    expect(planRun(p, 1, 0).maths.kind).toBe('subtract');
    p = play(p, makeSum('subtract', 1, rnd), CLEAN); expect(['add', 'subtract']).toContain(planRun(p, 1, 0).maths.kind);
  });
  it('mixes number words and counting at Foundation, and only counting above it', () => {
    let p = newProfile(); const kinds = new Set<string>();
    for (let i = 0; i < 8; i++) { const plan = planRun(p, 1, i); kinds.add(plan.counting.kind); p = recordStart(p, makePlannedRun(i + 5, plan)[0]); }
    expect(kinds).toEqual(new Set(['count', 'recognise']));
    expect(planRun(newProfile(), 2, 0).counting.kind).toBe('count');
  });
  it('brings in two-step reasoning only when both adding and taking away are at Challenge, and rests it while it is hard', () => {
    let p = newProfile(); expect(planRun(p, 1, 0).maths.kind).not.toBe('twostep');
    const top = (skill: 'adding' | 'subtracting'): LearningProfile => ({ ...p, skills: { ...p.skills, [skill]: { attempted: 4, completed: 4, firstTry: 4, retries: 0, hints: 0, revealed: 0, tier: 3, recent: [] } } });
    p = top('adding'); for (let s = 0; s < 6; s++) expect(planRun(p, 1, s).maths.kind).not.toBe('twostep'); // taking away is not there yet
    p = top('subtracting'); const kinds = new Set(Array.from({ length: 6 }, (_, s) => planRun(p, 1, s).maths.kind)); expect(kinds.has('twostep')).toBe(true);
    const hard = play(play(p, makeTwoStep(rnd), SHOWN), makeTwoStep(rnd), SHOWN);
    for (let s = 0; s < 6; s++) expect(planRun(hard, 1, s).maths.kind).not.toBe('twostep');
  });
});

describe('riddles are not repeated lately', () => {
  it('never gives the same counting riddle twice in a row, even in the smallest tier', () => {
    let p = newProfile(), prev = '';
    for (let i = 0; i < 60; i++) {
      const plan = { ...planRun(p, 1, i), counting: { kind: 'count' as const, tier: 1 as Tier } };
      const run = makePlannedRun(i * 31 + 1, plan, p.recent); const sig = signatureOf(run[0]);
      expect(sig).not.toBe(prev); prev = sig; run.forEach(r => { p = recordStart(p, r); });
    }
  });
  it('gives different patterns and sums in a row where the tier has plenty', () => {
    let p = newProfile(); const seen: string[] = [];
    for (let i = 0; i < 12; i++) { const run = makePlannedRun(i * 977 + 3, { counting: { kind: 'count', tier: 3 }, pattern: { tier: 3 }, maths: { kind: 'add', tier: 3 } }, p.recent); for (const r of run) { seen.push(signatureOf(r)); p = recordStart(p, r); } }
    const roomy = seen.filter(x => !x.startsWith('count:')); // a counting tier has only a handful of numbers; the others have plenty
    expect(new Set(roomy).size).toBe(roomy.length);
  });
  it('is the same run for the same seed, plan and recent list', () => {
    const plan = planRun(newProfile(), 2, 9); expect(makePlannedRun(5, plan, ['count:7'])).toEqual(makePlannedRun(5, plan, ['count:7']));
  });
});

describe('new riddle kinds', () => {
  it('number recognition: the word\'s digit is the answer, with distinct digits as options', () => {
    for (const tier of [1, 2, 3] as Tier[]) for (let seed = 1; seed <= 150; seed++) {
      const r = makeRecognise(tier, mulberry32(seed));
      expect(r.options[r.answer]).toBe(String(r.n)); expect(new Set(r.options).size).toBe(3); expect(r.n).toBeGreaterThanOrEqual(1); expect(r.n).toBeLessThanOrEqual(tier === 1 ? 6 : 10);
    }
  });
  it('two-step reasoning: add, then take away, never above 20 and never empty', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = makeTwoStep(mulberry32(seed)), ans = r.a + r.b - r.c;
      expect(r.a + r.b).toBeLessThanOrEqual(20); expect(ans).toBeGreaterThanOrEqual(1); expect(r.options[r.answer]).toBe(String(ans));
      expect(r.options).toContain(String(r.a + r.b)); // forgetting the second step is always on offer as a wrong answer
      expect(new Set(r.options).size).toBe(3); r.options.forEach(o => expect(Number(o)).toBeGreaterThanOrEqual(0));
    }
  });
});

describe('saving practice on the device', () => {
  it('survives a reload', () => {
    const store = memory(); let p = newProfile();
    p = play(play(p, countAt(1), CLEAN), countAt(1), CLEAN); p = play(p, addAt(1), HINT);
    expect(saveLearning(p, store)).toBe(true); expect(store.m[LEARNING_STORAGE_KEY]).toBeDefined();
    const back = loadLearning(store); expect(back).toEqual(p); expect(planRun(back, 1, 1)).toEqual(planRun(p, 1, 1));
  });
  it('holds only counters and riddle signatures (no personal information)', () => {
    const store = memory(); saveLearning(play(newProfile(), countAt(1), CLEAN), store);
    expect(Object.keys(JSON.parse(store.m[LEARNING_STORAGE_KEY])).sort()).toEqual(['recent', 'skills', 'version']);
  });
  it('turns corrupt or hostile data into a safe profile', () => {
    expect(loadLearning({ getItem: () => '{not json' })).toEqual(newProfile());
    expect(loadLearning({ getItem: () => { throw new Error('denied'); } })).toEqual(newProfile());
    const p = sanitizeProfile({ skills: { counting: { attempted: -5, completed: 9e99, firstTry: 'x', tier: 7, recent: ['clean', 'bogus', 'struggled'] }, evil: { tier: 3 }, multistep: { tier: 1 } }, recent: [1, 'ok', 'x'.repeat(200)] });
    expect(p.skills.counting).toMatchObject({ tier: 1, firstTry: 0 }); expect(p.skills.counting!.recent).toEqual(['clean', 'struggled']);
    expect(Object.keys(p.skills).sort()).toEqual(['counting', 'multistep']); expect(p.skills.multistep!.tier).toBe(3); expect(p.recent).toEqual(['ok']);
  });
  it('keeps practising for the session when the browser refuses to save', () => {
    expect(saveLearning(newProfile(), { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(saveLearning(newProfile(), undefined)).toBe(false);
  });
});
