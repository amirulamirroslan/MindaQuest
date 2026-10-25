/** Pure pixel maths for recolouring the Adventurer art (no Phaser or DOM, so it is unit-tested). */
/** Hue/saturation window that holds the tunic, hood and hair ochre; skin, steel, boots and outlines fall outside it. */
function isOchre(h: number, s: number, v: number) { return h >= 0.085 && h <= 0.14 && s > 0.6 && v > 0.12; }

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [r, g, b];
}

/** Shifts the ochre ramp to teal in place, keeping every pixel's lightness so the shading survives. */
export function recolourOchreToTeal(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, v] = rgbToHsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (!isOchre(h, s, v)) continue;
    const [r, g, b] = hsvToRgb(0.47 + (h - 0.11) * 0.8, Math.min(1, s * 0.85), Math.min(1, v * 1.12));
    data[i] = Math.round(r * 255); data[i + 1] = Math.round(g * 255); data[i + 2] = Math.round(b * 255);
  }
}

