import { clampThumb } from '../../game/systems/touchStick';
import type { CombatAction } from '../systems/combat';
import { icon } from '../ui/icons';

export interface InputHandlers {
  onAction(a: CombatAction): void;
  onInteract(): void;
  onPause(): void;
  onMap(): void;
  onPanel(tab: 'hero' | 'bag'): void;
  /** Any first touch/key: used to start audio. */
  onFirstGesture(): void;
}

export interface InputFrame { x: number; y: number; run: boolean; magnitude: number; yawRate: number }

const STICK_RADIUS = 56;
const DEAD = 0.16;
const DRAG_YAW_PER_PX = 0.0058;

/**
 * Keyboard, mouse and touch. Left half of the screen = floating thumb stick, right half = drag to turn the camera,
 * big round buttons for Attack / Dodge / Spin / Talk. Desktop: WASD/arrows, Shift to run, Q/R or mouse drag to look,
 * Space/J/click to attack, K dodge, L spin, E talk, Esc pause.
 */
export class Input3D {
  readonly touch: boolean;
  private keys = new Set<string>();
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private look: { id: number; lastX: number; downX: number; downY: number; downT: number; moved: boolean; mouse: boolean } | null = null;
  private yawAccum = 0;
  private readonly surface: HTMLDivElement;
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  private readonly buttons = {} as Record<'attack' | 'dodge' | 'special' | 'talk', HTMLButtonElement>;
  private readonly cleanup: (() => void)[] = [];
  private firstGesture = false;
  enabled = true;

  constructor(private readonly host: HTMLElement, private readonly h: InputHandlers, labels: { attack: string; dodge: string; special: string; talk: string }) {
    const qs = new URLSearchParams(location.search);
    this.touch = qs.has('touch') || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
    this.surface = el('div', 'mq-surface'); host.appendChild(this.surface);
    this.stickBase = el('div', 'mq-stick'); this.stickKnob = el('div', 'mq-knob'); this.stickBase.appendChild(this.stickKnob); this.stickBase.style.display = 'none';
    this.surface.appendChild(this.stickBase);

    const pad = el('div', 'mq-pad'); host.appendChild(pad);
    const mk = (k: 'attack' | 'dodge' | 'special' | 'talk', icon: string): HTMLButtonElement => {
      const b = document.createElement('button'); b.className = `mq-btn mq-btn-${k}`; b.type = 'button';
      const key = { attack: 'Space', dodge: 'K', special: 'L', talk: 'E' }[k];
      b.innerHTML = `<span class="mq-btn-icon">${icon}</span><span class="mq-btn-label">${labels[k]}</span>${this.touch ? '' : `<span class="mq-key">${key}</span>`}`;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.gesture(); if (!this.enabled) return; if (k === 'talk') this.h.onInteract(); else this.h.onAction(k); });
      b.addEventListener('contextmenu', e => e.preventDefault());
      pad.appendChild(b); this.buttons[k] = b; return b;
    };
    mk('attack', icon('attack', 38)); mk('dodge', icon('dodge', 30)); mk('special', icon('spin', 30)); mk('talk', icon('talk', 30));
    this.buttons.talk.style.display = 'none';
    if (!this.touch) pad.classList.add('mq-pad-desktop'); // v2.23: desktop shows the same buttons, with key badges and cooldown rings

    const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => { t.addEventListener(type, fn as EventListener); this.cleanup.push(() => t.removeEventListener(type, fn as EventListener)); };
    on(this.surface, 'pointerdown', e => this.down(e));
    on(this.surface, 'pointermove', e => this.move(e));
    on(this.surface, 'pointerup', e => this.up(e));
    on(this.surface, 'pointercancel', e => this.up(e, true));
    on(this.surface, 'contextmenu', e => e.preventDefault());
    const kd = (e: KeyboardEvent) => this.keyDown(e), ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    const release = () => this.releaseAll();
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    this.cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); });
  }

  private gesture(): void { if (!this.firstGesture) { this.firstGesture = true; this.h.onFirstGesture(); } }

  private keyDown(e: KeyboardEvent): void {
    this.gesture();
    if (e.code === 'Escape') { if (!e.repeat) this.h.onPause(); return; }
    if (e.code === 'KeyM') { if (!e.repeat) this.h.onMap(); return; }
    if (e.code === 'KeyI') { if (!e.repeat) this.h.onPanel('bag'); return; }
    if (e.code === 'KeyC') { if (!e.repeat) this.h.onPanel('hero'); return; }
    if (!this.enabled) return; // menus and riddles use the keyboard themselves (Space and Enter must still press their buttons)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat || !this.enabled) return;
    if (e.code === 'Space' || e.code === 'KeyJ') this.h.onAction('attack');
    else if (e.code === 'KeyK') this.h.onAction('dodge');
    else if (e.code === 'KeyL') this.h.onAction('special');
    else if (e.code === 'KeyE' || e.code === 'Enter') this.h.onInteract();
  }

  private down(e: PointerEvent): void {
    this.gesture();
    if (e.pointerType === 'mouse' && e.button === 2) { /* right drag looks too */ }
    try { this.surface.setPointerCapture(e.pointerId); } catch { /* not capturable: fine */ }
    const rect = this.host.getBoundingClientRect();
    const leftHalf = e.clientX - rect.left < rect.width * 0.5;
    if (e.pointerType === 'touch' && leftHalf && !this.stick) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.stickBase.style.display = ''; this.stickBase.style.left = `${e.clientX - rect.left}px`; this.stickBase.style.top = `${e.clientY - rect.top}px`;
      this.stickKnob.style.transform = 'translate(-50%,-50%)';
    } else if (!this.look) {
      this.look = { id: e.pointerId, lastX: e.clientX, downX: e.clientX, downY: e.clientY, downT: performance.now(), moved: false, mouse: e.pointerType === 'mouse' };
    }
  }
  private move(e: PointerEvent): void {
    if (this.stick && e.pointerId === this.stick.id) {
      const t = clampThumb(e.clientX - this.stick.ox, e.clientY - this.stick.oy, STICK_RADIUS);
      this.stick.x = t.x / STICK_RADIUS; this.stick.y = t.y / STICK_RADIUS;
      this.stickKnob.style.transform = `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px))`;
    } else if (this.look && e.pointerId === this.look.id) {
      const dx = e.clientX - this.look.lastX; this.look.lastX = e.clientX;
      if (Math.hypot(e.clientX - this.look.downX, e.clientY - this.look.downY) > 6) this.look.moved = true;
      if (this.look.moved) this.yawAccum -= dx * DRAG_YAW_PER_PX;
    }
  }
  private up(e: PointerEvent, cancelled = false): void {
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.stickBase.style.display = 'none'; }
    if (this.look && e.pointerId === this.look.id) {
      const l = this.look; this.look = null;
      // a quick click with the mouse (not a drag) attacks
      if (!cancelled && l.mouse && !l.moved && e.button === 0 && performance.now() - l.downT < 350 && this.enabled) this.h.onAction('attack');
    }
  }
  releaseAll(): void {
    this.keys.clear(); this.stick = null; this.look = null; this.stickBase.style.display = 'none';
  }

  /** Reads this frame's movement. `yawRate` is -1..1 from Q/R; drag-look is returned through `takeYaw`. */
  read(): InputFrame {
    if (!this.enabled) return { x: 0, y: 0, run: false, magnitude: 0, yawRate: 0 };
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let x = kx, y = ky, magnitude = Math.min(1, Math.hypot(kx, ky));
    if (this.stick) {
      const sm = Math.hypot(this.stick.x, this.stick.y);
      if (sm >= DEAD) { const s = Math.min(1, (sm - DEAD) / (1 - DEAD)); x = (this.stick.x / sm) * s; y = (-this.stick.y / sm) * s; magnitude = s; }
    }
    const yawRate = (k.has('KeyR') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    return { x, y, run: k.has('ShiftLeft') || k.has('ShiftRight'), magnitude, yawRate };
  }
  takeYaw(): number { const v = this.yawAccum; this.yawAccum = 0; return v; }

  setCooldown(a: 'attack' | 'dodge' | 'special', fraction: number): void { this.buttons[a].style.setProperty('--cd', `${Math.round(Math.min(1, Math.max(0, fraction)) * 360)}deg`); this.buttons[a].classList.toggle('mq-cooling', fraction > 0.001); }
  /** The Talk button (and the keyboard hint) appear only near someone to talk to. */
  setTalk(visible: boolean): void { this.buttons.talk.style.display = visible ? '' : 'none'; }
  setTalkLabel(text: string): void { const l = this.buttons.talk.querySelector('.mq-btn-label') as HTMLElement; if (l.textContent !== text) l.textContent = text; }
  setLabels(l: { attack: string; dodge: string; special: string; talk: string }): void {
    for (const k of ['attack', 'dodge', 'special', 'talk'] as const) (this.buttons[k].querySelector('.mq-btn-label') as HTMLElement).textContent = l[k];
  }
  destroy(): void { this.cleanup.forEach(f => f()); this.surface.remove(); this.buttons.attack.parentElement?.remove(); }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] { const e = document.createElement(tag); e.className = cls; return e; }
