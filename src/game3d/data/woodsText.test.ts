import { describe, expect, it } from 'vitest';
import { ACCESSORY_CATALOG } from '../systems/outfit3d';
import { newProgress, reduceQuest, type WoodsStage } from '../systems/woodsQuest';
import { TEXT, fill, objectiveLine, parseLang, questToast } from './woodsText';

const STAGES: WoodsStage[] = ['talk', 'petals', 'sprouts', 'runes', 'boss', 'return', 'complete'];

describe('3D text', () => {
  it('has the same shape in both languages and no empty strings', () => {
    const walk = (o: unknown, path: string, out: string[]) => {
      if (typeof o === 'string') { if (!o.trim()) out.push(`${path} is empty`); return; }
      if (Array.isArray(o)) { if (!o.length) out.push(`${path} is empty`); o.forEach((v, i) => walk(v, `${path}[${i}]`, out)); return; }
      for (const [k, v] of Object.entries(o as object)) walk(v, `${path}.${k}`, out);
    };
    const problems: string[] = [];
    walk(TEXT.en, 'en', problems); walk(TEXT.ms, 'ms', problems);
    expect(problems).toEqual([]);
    expect(Object.keys(TEXT.ms.ui).sort()).toEqual(Object.keys(TEXT.en.ui).sort());
    expect(Object.keys(TEXT.ms.toast).sort()).toEqual(Object.keys(TEXT.en.toast).sort());
    expect(Object.keys(TEXT.ms.puzzle).sort()).toEqual(Object.keys(TEXT.en.puzzle).sort());
    expect(Object.keys(TEXT.ms.puzzle.runeName).sort()).toEqual(Object.keys(TEXT.en.puzzle.runeName).sort());
    expect(Object.keys(TEXT.ms.puzzle.hint).sort()).toEqual(Object.keys(TEXT.en.puzzle.hint).sort());
    expect(Object.keys(TEXT.ms.wardrobe.parts).sort()).toEqual(Object.keys(TEXT.en.wardrobe.parts).sort());
    expect(Object.keys(TEXT.ms.wardrobe.moves).sort()).toEqual(Object.keys(TEXT.en.wardrobe.moves).sort());
    for (const s of STAGES) expect(TEXT.ms.elder[s].length).toBe(TEXT.en.elder[s].length);
  });
  it('names every accessory in both languages', () => {
    for (const a of ACCESSORY_CATALOG) { expect(TEXT.en.accessory[a.id]).toBeTruthy(); expect(TEXT.ms.accessory[a.id]).toBeTruthy(); }
  });
  it('shows counts in objectives', () => {
    let p = reduceQuest(newProgress(), { kind: 'talked' }).state;
    p = reduceQuest(p, { kind: 'petal', id: 1 }).state;
    expect(objectiveLine('en', p)).toContain('1/6');
  });
  it('announces each stage change once', () => {
    const a = newProgress();
    const b = reduceQuest(a, { kind: 'talked' }).state;
    expect(questToast('en', a, b)).toContain('6');
    expect(questToast('en', b, b)).toBeNull();
  });
  it('falls back to English', () => { expect(parseLang('fr')).toBe('en'); expect(parseLang('ms')).toBe('ms'); });
  it('keeps the same {placeholders} in both languages, so numbers always land in the sentence', () => {
    const holes = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(TEXT.en.puzzle) as (keyof typeof TEXT.en.puzzle)[]) {
      const en = TEXT.en.puzzle[k], ms = TEXT.ms.puzzle[k];
      if (typeof en === 'string' && typeof ms === 'string') expect(holes(ms), k).toBe(holes(en));
    }
    expect(fill(TEXT.en.puzzle.askAdd, { a: 4, b: 3 })).toBe('You have 4 petals. You find 3 more. How many petals now?');
    expect(fill(TEXT.ms.puzzle.askSubtract, { a: 9, b: 2 })).toContain('9');
    expect(fill('{x} and {y}', { x: 1 })).toBe('1 and {y}');
  });
  it('says what to do at each new stage and announces the Rune Stone once', () => {
    let p = reduceQuest(newProgress(), { kind: 'talked' }).state;
    for (let i = 0; i < 6; i++) p = reduceQuest(p, { kind: 'petal', id: i }).state;
    const a = p; for (let i = 0; i < 3; i++) p = reduceQuest(p, { kind: 'enemyDefeated', enemy: 'sprout' }).state;
    expect(questToast('en', a, p)).toMatch(/Rune Stone/); expect(questToast('ms', a, p)).toMatch(/Batu Rune/);
    expect(objectiveLine('en', p)).toContain('0/3'); expect(objectiveLine('ms', p)).toContain('0/3');
    const b = reduceQuest(p, { kind: 'runeSolved', index: 0, mistakes: 0 }).state; expect(questToast('en', p, b)).toBeNull(); expect(objectiveLine('en', b)).toContain('1/3');
  });
});

import { BONUS_XP_CAP as CAP, PATROL_XP as PXP, newProgress as np } from '../systems/woodsQuest';
describe('woods patrol text (v2.21)', () => {
  it('the quest card follows the patrol after the quest, in both languages', () => {
    for (const lang of ['en', 'ms'] as const) {
      const done = { ...np(), stage: 'complete' as const, gateOpen: true };
      const gate = objectiveLine(lang, done);
      expect(objectiveLine(lang, { ...done, bonusXp: PXP * 3 })).toContain('(3/' + CAP / PXP + ')');
      expect(objectiveLine(lang, { ...done, bonusXp: PXP * 3 })).not.toBe(gate);
      expect(objectiveLine(lang, { ...done, bonusXp: CAP })).toBe(TEXT[lang].toast.patrolPeace);
      expect(TEXT[lang].toast.patrol.length).toBeGreaterThan(10);
    }
  });
});
