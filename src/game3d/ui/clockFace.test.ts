import { describe, expect, it } from 'vitest';
import { clockFaceSvg } from './clockFace';

/** Angle (degrees clockwise from 12) of the hand drawn with class `cls`. */
const handAngle = (svg: string, cls: string): number => {
  const m = new RegExp(`class="${cls}" x1="32" y1="32" x2="([\\d.-]+)" y2="([\\d.-]+)"`).exec(svg)!;
  return ((Math.atan2(+m[1] - 32, 32 - +m[2]) * 180) / Math.PI + 360) % 360;
};

describe('clock face (v2.30)', () => {
  it('points the hour hand at every whole hour and keeps the minute hand on 12', () => {
    for (let h = 1; h <= 12; h++) {
      const svg = clockFaceSvg(h);
      expect(Math.round(handAngle(svg, 'mq-ck-hr')) % 360).toBe((h * 30) % 360);
      expect(Math.round(handAngle(svg, 'mq-ck-min'))).toBe(0);
    }
  });
  it('labels the face for screen readers with the time and shows the four main numerals', () => {
    const svg = clockFaceSvg(7);
    expect(svg).toContain('aria-label="7:00"'); expect(clockFaceSvg(12)).toContain('aria-label="12:00"');
    for (const n of ['12', '3', '6', '9']) expect(svg).toContain(`>${n}</text>`);
    expect((svg.match(/mq-ck-tick/g) ?? []).length).toBe(12);
  });
});
