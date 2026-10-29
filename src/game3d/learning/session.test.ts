import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../systems/layout3d';
import { REVEAL_AFTER, makeSum, type Riddle } from '../systems/runePuzzle';
import { ChallengeSession } from './session';

const riddle = (): Riddle => makeSum('add', 2, mulberry32(7));
const wrongIndexes = (r: Riddle): number[] => r.options.map((_, i) => i).filter(i => i !== r.answer);

describe('a challenge being answered', () => {
  it('is solved at the first try and counts as a first try', () => {
    const r = riddle(), s = new ChallengeSession(r);
    expect(s.choose(r.answer)).toBe('right');
    expect(s.phase).toBe('solved'); expect(s.firstTry).toBe(true);
    expect(s.result()).toEqual({ slips: 0, hinted: false, revealed: false, firstTry: true });
  });

  it('keeps the first-try bonus when a hint was asked for first (hints are free)', () => {
    const r = riddle(), s = new ChallengeSession(r);
    expect(s.hint()).toBe(true); expect(s.hint()).toBe(false); // the hint starts once
    s.choose(r.answer);
    expect(s.firstTry).toBe(true); expect(s.result()?.hinted).toBe(true);
  });

  it('lets a child retry after a wrong answer: no first try, but solved and nothing is lost', () => {
    const r = riddle(), s = new ChallengeSession(r), [w] = wrongIndexes(r);
    expect(s.choose(w)).toBe('wrong'); expect(s.phase).toBe('asking'); expect(s.slips).toBe(1);
    expect(s.choose(r.answer)).toBe('right');
    expect(s.firstTry).toBe(false); expect(s.result()).toEqual({ slips: 1, hinted: false, revealed: false, firstTry: false });
  });

  it('shows the answer after the second slip, so a child is never stuck', () => {
    const r = riddle(), s = new ChallengeSession(r), [w1, w2] = wrongIndexes(r);
    expect(REVEAL_AFTER).toBe(2);
    expect(s.choose(w1)).toBe('wrong'); expect(s.choose(w2)).toBe('revealed');
    expect(s.phase).toBe('revealed'); expect(s.done).toBe(true); expect(s.firstTry).toBe(false);
    expect(s.result()).toEqual({ slips: 2, hinted: false, revealed: true, firstTry: false });
    expect(s.choose(r.answer)).toBe('ignored'); // finished: nothing more counts
  });

  it('ignores a button that already faded, an out-of-range key and a hint after the end', () => {
    const r = riddle(), s = new ChallengeSession(r), [w] = wrongIndexes(r);
    s.choose(w);
    expect(s.choose(w)).toBe('ignored'); expect(s.slips).toBe(1); // the 1-2-3 keys cannot count it twice
    for (const bad of [-1, 3, 99, 1.5, Number.NaN]) expect(s.choose(bad)).toBe('ignored');
    s.choose(r.answer); expect(s.hint()).toBe(false);
  });

  it('has no result until it is finished', () => { expect(new ChallengeSession(riddle()).result()).toBeNull(); });
});
