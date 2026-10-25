/** A whole-hour clock face (v2.30): 12 ticks, numerals at 12/3/6/9, a short hour hand on `hour` and a long minute hand on 12. Colours come from CSS. */
export function clockFaceSvg(hour: number): string {
  const h = ((hour % 12) + 12) % 12, ang = (h * 30 - 90) * Math.PI / 180, pt = (r: number, a: number): string => `${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}`;
  let ticks = ''; for (let i = 0; i < 12; i++) { const a = (i * 30 - 90) * Math.PI / 180; ticks += `<line class="mq-ck-tick" x1="${pt(i % 3 === 0 ? 24 : 26, a).split(' ')[0]}" y1="${pt(i % 3 === 0 ? 24 : 26, a).split(' ')[1]}" x2="${pt(29, a).split(' ')[0]}" y2="${pt(29, a).split(' ')[1]}"/>`; }
  const num = (t: string, x: number, y: number): string => `<text class="mq-ck-num" x="${x}" y="${y}">${t}</text>`;
  return `<svg viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${h === 0 ? 12 : h}:00"><circle class="mq-ck-face" cx="32" cy="32" r="30"/>${ticks}${num('12', 32, 18)}${num('3', 51, 36)}${num('6', 32, 55)}${num('9', 13, 36)}`
    + `<line class="mq-ck-min" x1="32" y1="32" x2="32" y2="10"/><line class="mq-ck-hr" x1="32" y1="32" x2="${pt(15, ang).split(' ')[0]}" y2="${pt(15, ang).split(' ')[1]}"/><circle class="mq-ck-pin" cx="32" cy="32" r="2.6"/></svg>`;
}
