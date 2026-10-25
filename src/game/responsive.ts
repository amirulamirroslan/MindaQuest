import Phaser from 'phaser';
import { computeLayout, NO_INSETS, sameLayout, type Insets, type ViewportLayout } from './systems/viewport';

export const LAYOUT_KEY = 'layout';
/** Emitted on `game.events` after the canvas has been resized to a new layout. */
export const LAYOUT_EVENT = 'mq:layout';

/** The layout every scene reads. Always present once the game has booted. */
export function getLayout(scene: Phaser.Scene): ViewportLayout {
  return scene.registry.get(LAYOUT_KEY) as ViewportLayout;
}

const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function numberParam(name: string): number | null {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get(name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Reads the notch / rounded-corner / home-indicator insets the browser reports, in CSS px. */
function createSafeAreaProbe(): { read: () => Insets; remove: () => void } {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const px = (value: string) => { const n = parseFloat(value); return Number.isFinite(n) ? n : 0; };
  return {
    read() {
      const style = getComputedStyle(probe);
      return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
    },
    remove: () => probe.remove(),
  };
}

/** Measures the element the game lives in. `#game` is sized with `100dvh`, so this follows dynamic browser toolbars. */
export function measureLayout(parent: HTMLElement, insets: Insets = NO_INSETS): ViewportLayout {
  const rect = parent.getBoundingClientRect();
  const visual = window.visualViewport;
  return computeLayout({
    cssWidth: rect.width || visual?.width || window.innerWidth,
    cssHeight: rect.height || visual?.height || window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    insets,
    touch: isTouchDevice(),
    renderScaleOverride: numberParam('res'),
  });
}

/**
 * Keeps the Phaser canvas matched to the real viewport. The canvas is sized in device pixels (so text and
 * pixel art stay sharp) and shown at CSS size via the scale manager's zoom; it is never stretched.
 * Reacts to window resizes, rotation, browser-toolbar changes and safe-area changes, coalesced to one
 * update per animation frame, and only acts when something that matters actually changed.
 */
export class ResponsiveViewport {
  private layout: ViewportLayout;
  private frame = 0;
  private readonly probe = createSafeAreaProbe();
  private readonly observer?: ResizeObserver;
  private readonly cleanup: Array<() => void> = [];

  constructor(private readonly game: Phaser.Game, private readonly parent: HTMLElement, initial: ViewportLayout) {
    this.layout = initial;
    const schedule = () => this.schedule();
    const settleAfterRotation = () => { this.schedule(); window.setTimeout(schedule, 250); };
    this.listen(window, 'resize', schedule);
    this.listen(window, 'orientationchange', settleAfterRotation);
    this.listen(window, 'pageshow', schedule);
    if (window.visualViewport) this.listen(window.visualViewport, 'resize', schedule);
    if (typeof ResizeObserver !== 'undefined') { this.observer = new ResizeObserver(schedule); this.observer.observe(parent); }
    this.blockBrowserGestures();
    this.schedule();
  }

  get current(): ViewportLayout { return this.layout; }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.cleanup.forEach((undo) => undo());
    this.cleanup.length = 0;
    this.probe.remove();
  }

  private listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(type, handler, options);
    this.cleanup.push(() => target.removeEventListener(type, handler, options));
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.apply(); });
  }

  private apply() {
    const next = measureLayout(this.parent, this.probe.read());
    if (sameLayout(this.layout, next)) return;
    const zoomChanged = this.layout.renderScale !== next.renderScale;
    this.layout = next;
    this.game.registry.set(LAYOUT_KEY, next);
    if (zoomChanged) this.game.scale.setZoom(1 / next.renderScale);
    this.game.scale.resize(next.width, next.height);
    this.game.events.emit(LAYOUT_EVENT, next);
  }

  /** No page scroll, pull-to-refresh, pinch zoom, double-tap zoom or long-press menu while playing. */
  private blockBrowserGestures() {
    const stop: EventListener = (event) => { if (event.cancelable) event.preventDefault(); };
    this.listen(document, 'touchmove', stop, { passive: false });
    this.listen(document, 'gesturestart', stop);
    this.listen(document, 'gesturechange', stop);
    this.listen(document, 'gestureend', stop);
    this.listen(this.parent, 'contextmenu', stop);
    this.listen(this.parent, 'dblclick', stop);
  }
}
