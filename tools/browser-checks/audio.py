"""Renders the synthesised sound offline and measures it (peak, loudness, silence, NaN). Usage: python audio.py http://127.0.0.1:4173/"""
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
JS = """
async () => {
  const SR = 44100, out = {};
  const measure = async (name, secs, play) => {
    const ctx = new OfflineAudioContext(2, SR * secs, SR);
    const a = new window.__GameAudio(ctx, null);
    play(a, ctx);
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0); let peak = 0, sum = 0, nan = 0;
    for (const v of d) { if (Number.isNaN(v)) nan++; const x = Math.abs(v); if (x > peak) peak = x; sum += v * v; }
    out[name] = { peak: +peak.toFixed(3), rmsDb: +(20 * Math.log10(Math.sqrt(sum / d.length) + 1e-9)).toFixed(1), nan };
  };
  await measure('music 8 bars', 26, (a) => { for (let b = 0; b < 8; b++) a.scheduleBar(b, b * 3.158, 0); });
  await measure('music night', 26, (a) => { for (let b = 0; b < 8; b++) a.scheduleBar(b, b * 3.158, 1); });
  await measure('ambience day by river', 6, (a) => { a.startAmbience(); a.setAmbience({ river: 1, night: 0, daylight: 1, gust: 0.8 }); });
  await measure('ambience night', 6, (a) => { a.startAmbience(); a.setAmbience({ river: 0.1, night: 1, daylight: 0, gust: 0.2 }); });
  for (const s of ['grass', 'dirt', 'wood']) await measure('step ' + s, 1, (a) => a.step(s, 0.05));
  await measure('pickup 1', 2, (a) => a.pickup(1, 0.05));
  await measure('pickup 12 + fanfare', 4, (a) => a.pickup(12, 0.05));
  await measure('plank', 1, (a) => a.plank(0.05));
  await measure('splash big', 1.5, (a) => a.splash(1, 'big', 0.05));
  await measure('fish leap', 1.5, (a) => a.fishLeap(1, 0.05));
  await measure('fanfare', 4, (a) => a.fanfare(0.05));
  await measure('reward', 5, (a) => a.reward(0.05));
  await measure('chirp', 1, (a) => a.chirp(1, 0, 0.05));
  await measure('hoot', 2, (a) => a.hoot(0.05));
  await measure('dialogue open', 1, (a) => a.dialogue('open', 0.05));
  await measure('click', 1, (a) => a.click(0.05));
  await measure('everything at once', 6, (a) => { for (let b = 0; b < 2; b++) a.scheduleBar(b, b * 3.158, 0); a.startAmbience(); a.setAmbience({ river: 1, night: 0, daylight: 1, gust: 1 }); a.pickup(12, 1); a.splash(1, 'big', 1.2); a.plank(1.2); a.step('wood', 1.3); a.fanfare(2); });
  // Regression: an envelope that starts at gain 1 produced a random full-level click at the start of noise bursts.
  const peaks = [];
  for (let i = 0; i < 8; i++) { const c = new OfflineAudioContext(2, SR * 5, SR); const a = new window.__GameAudio(c, null); a.reward(0.05); a.pickup(3, 2); const b = await c.startRendering(); let p = 0; for (const v of b.getChannelData(0)) p = Math.max(p, Math.abs(v)); peaks.push(p); }
  out['click check (8 runs, max-min)'] = { peak: +Math.max(...peaks).toFixed(3), rmsDb: +(20 * Math.log10(Math.max(...peaks) - Math.min(...peaks) + 1e-9)).toFixed(1), nan: Math.max(...peaks) - Math.min(...peaks) > 0.08 ? 1 : 0 };
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page()
    pg.goto(base + '?debug', wait_until='commit')
    pg.wait_for_function('typeof window.__GameAudio === "function"', timeout=60000)
    res = pg.evaluate(JS)
    bad = 0
    for k, v in res.items():
        flag = ''
        if v['nan'] or v['peak'] >= 0.99: flag = '  <-- CLIPPING/NaN'; bad += 1
        elif v['peak'] < 0.005: flag = '  <-- SILENT'; bad += 1
        print(f"{k:26s} peak {v['peak']:.3f}  rms {v['rmsDb']:6.1f} dBFS{flag}")
    b.close()
sys.exit(1 if bad else 0)
