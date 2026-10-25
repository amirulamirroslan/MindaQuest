import './ui/hud3d.css';
import { TEXT, loadLang } from './data/woodsText';

const host = document.getElementById('game3d') as HTMLElement;

function webglAvailable(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!webglAvailable()) {
  const m = document.createElement('div'); m.className = 'mq-msg';
  m.innerHTML = `<div>${TEXT[loadLang()].ui.noWebgl}</div>`;
  host.appendChild(m);
} else {
  // three.js is loaded lazily so the WebGL-missing message can show without it
  import('./Game3D').then(({ Game3D }) => { const g = new Game3D(host); window.addEventListener('beforeunload', () => g.destroy()); })
    .catch(err => {
      console.error(err);
      const m = document.createElement('div'); m.className = 'mq-msg'; m.textContent = `Could not start the 3D game: ${err instanceof Error ? err.message : String(err)}`; host.appendChild(m);
    });
}
