// Wires browser events to PTY input (and PTY events to browser side-effects)
// for the five interop features ghostty-web exposes hooks for:
//
//   - Mouse reporting   (SGR 1006 encoding)
//   - Bracketed paste   (\e[200~ … \e[201~ wrapping)
//   - Focus events      (\e[I / \e[O on window focus/blur)
//   - Window title      (\e]0;…\a → document.title)
//   - Bell              (\a → CSS flash + Web Audio beep)
//
// Each feature is gated by a flag in `settings.ts`. attachBridge returns a
// single teardown function that disposes every listener / event subscription.

import { settings } from './settings';

interface Disposable {
  dispose(): void;
}

interface TerminalApi {
  hasMouseTracking(): boolean;
  hasBracketedPaste(): boolean;
  hasFocusEvents(): boolean;
  onTitleChange(cb: (title: string) => void): Disposable;
  onBell(cb: () => void): Disposable;
  renderer: { getMetrics(): { width: number; height: number } };
}

export function attachBridge(
  term: TerminalApi,
  container: HTMLElement,
  send: (data: string) => void
): () => void {
  const teardown: (() => void)[] = [];

  // ─── Mouse ─────────────────────────────────────────────────────────────────
  if (settings.mouseEnabled) {
    const SGR_PRESS = 'M';
    const SGR_RELEASE = 'm';
    let buttonHeld = false;

    const buttonBits = (e: MouseEvent): number => {
      let b = e.button === 0 ? 0 : e.button === 1 ? 1 : e.button === 2 ? 2 : 3;
      if (e.shiftKey) b |= 4;
      if (e.altKey) b |= 8;
      if (e.ctrlKey) b |= 16;
      return b;
    };

    const cell = (e: MouseEvent) => {
      const m = term.renderer.getMetrics();
      if (!m.width || !m.height) return null;
      const r = container.getBoundingClientRect();
      const x = Math.max(1, Math.floor((e.clientX - r.left) / m.width) + 1);
      const y = Math.max(1, Math.floor((e.clientY - r.top) / m.height) + 1);
      return { x, y };
    };

    const encode = (cb: number, x: number, y: number, kind: 'M' | 'm') =>
      `\x1b[<${cb};${x};${y}${kind}`;

    const onDown = (e: MouseEvent) => {
      if (!term.hasMouseTracking()) return;
      const c = cell(e);
      if (!c) return;
      send(encode(buttonBits(e), c.x, c.y, SGR_PRESS));
      buttonHeld = true;
      e.preventDefault();
      e.stopPropagation();
    };
    const onUp = (e: MouseEvent) => {
      if (!term.hasMouseTracking()) return;
      const c = cell(e);
      if (!c) return;
      send(encode(buttonBits(e), c.x, c.y, SGR_RELEASE));
      buttonHeld = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onMove = (e: MouseEvent) => {
      if (!term.hasMouseTracking()) return;
      if (!buttonHeld && e.buttons === 0) return;
      const c = cell(e);
      if (!c) return;
      send(encode(buttonBits(e) | 32, c.x, c.y, SGR_PRESS));
      e.preventDefault();
      e.stopPropagation();
    };
    const onWheel = (e: WheelEvent) => {
      if (!term.hasMouseTracking()) return;
      const c = cell(e);
      if (!c) return;
      const dir = e.deltaY > 0 ? 65 : 64;
      send(encode(dir, c.x, c.y, SGR_PRESS));
      e.preventDefault();
      e.stopPropagation();
    };

    const opts = { capture: true } as const;
    container.addEventListener('mousedown', onDown, opts);
    container.addEventListener('mouseup', onUp, opts);
    container.addEventListener('mousemove', onMove, opts);
    container.addEventListener('wheel', onWheel, { capture: true, passive: false });
    teardown.push(() => {
      container.removeEventListener('mousedown', onDown, opts);
      container.removeEventListener('mouseup', onUp, opts);
      container.removeEventListener('mousemove', onMove, opts);
      container.removeEventListener('wheel', onWheel, opts);
    });
  }

  // ─── Bracketed paste ───────────────────────────────────────────────────────
  if (settings.bracketedPasteEnabled) {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      send(term.hasBracketedPaste() ? `\x1b[200~${text}\x1b[201~` : text);
    };
    container.addEventListener('paste', onPaste, { capture: true });
    teardown.push(() => container.removeEventListener('paste', onPaste, { capture: true }));
  }

  // ─── Focus events ──────────────────────────────────────────────────────────
  if (settings.focusEventsEnabled) {
    const onFocus = () => term.hasFocusEvents() && send('\x1b[I');
    const onBlur = () => term.hasFocusEvents() && send('\x1b[O');
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    teardown.push(() => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    });
  }

  // ─── Window title ──────────────────────────────────────────────────────────
  if (settings.setDocumentTitle) {
    const sub = term.onTitleChange((t) => {
      document.title = t || 'ghostty-web';
    });
    teardown.push(() => sub.dispose());
  }

  // ─── Bell (visual + audible) ───────────────────────────────────────────────
  if (settings.visualBellEnabled || settings.audibleBellEnabled) {
    let audioCtx: AudioContext | null = null;
    const beep = () => {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx ??= new Ctor();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain).connect(audioCtx.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
      } catch {}
    };

    const sub = term.onBell(() => {
      if (settings.visualBellEnabled) {
        container.classList.remove('ghostty-bell-flash');
        void container.offsetWidth; // force reflow → restart animation
        container.classList.add('ghostty-bell-flash');
      }
      if (settings.audibleBellEnabled) beep();
    });
    teardown.push(() => sub.dispose());
  }

  return () => {
    for (const fn of teardown) fn();
  };
}
