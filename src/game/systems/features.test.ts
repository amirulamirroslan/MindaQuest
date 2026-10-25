import { describe, expect, it } from 'vitest';
import { FEATURES, parseOff, wantsFpsMeter } from './features';

describe('feature switches', () => {
  it('turn nothing off by default', () => {
    expect(parseOff('').size).toBe(0);
    expect(parseOff('?debug').size).toBe(0);
  });
  it('turn off exactly the named features, ignoring case, spaces and unknown names', () => {
    expect([...parseOff('?off=leaves, Birds,nonsense')].sort()).toEqual(['birds', 'leaves']);
  });
  it('turn everything off with all', () => {
    expect(parseOff('?off=all').size).toBe(FEATURES.length);
  });
  it('detect the fps meter switch', () => {
    expect(wantsFpsMeter('?fps')).toBe(true);
    expect(wantsFpsMeter('?perf=lite')).toBe(false);
  });
});
