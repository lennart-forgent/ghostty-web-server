// Compile-time configuration. Edit this file and rebuild to change behavior;
// there are no runtime knobs by design. Constants are inlined at use sites by
// the bundler so disabled branches fold to dead code.

export const settings = {
  // ─── Resize handling ────────────────────────────────────────────────────────

  /**
   * After the user stops resizing for this many ms, send Ctrl+L so bash
   * repaints the prompt from scratch. Cleans up the prompt-redraw artifacts
   * bash's readline leaves behind during a fast drag (native Ghostty avoids
   * them via OS-level SIGWINCH coalescing, which doesn't replicate over the
   * network).
   *
   * Set to 0 to disable.
   */
  resizeAutoRedrawMs: 200,

  /**
   * Minimum interval between WebSocket resize messages while the user is
   * dragging. The local canvas still follows every ResizeObserver tick; this
   * only caps the rate of SIGWINCHes the shell receives.
   */
  resizeMinIntervalMs: 50,

  /**
   * Floor for terminal dimensions. cols=1 sends readline into a tail-spin
   * the buffer often can't recover from when you drag back to a normal width.
   */
  minCols: 20,
  minRows: 4,

  // ─── Terminal ↔ browser interop ────────────────────────────────────────────
  // All on by default. Toggle individually at compile time.

  /** Forward mouse events (click/drag/wheel) to the PTY when the running
   *  program enables tracking (btop, vim, fzf, opencode, htop). */
  mouseEnabled: true,

  /** Wrap pasted text with bracketed-paste markers (\e[200~ … \e[201~) when
   *  the program enables `?2004h`. Stops bash from auto-running multi-line
   *  pastes and lets editors detect paste vs typing. */
  bracketedPasteEnabled: true,

  /** Forward window focus/blur as `\e[I` / `\e[O` when the program enables
   *  `?1004h`. vim `:set autoread`, tmux focus events. */
  focusEventsEnabled: true,

  /** Reflect terminal title escapes (`\e]0;…\a`) into document.title. */
  setDocumentTitle: true,

  /** Brief CSS flash on `\a`. */
  visualBellEnabled: true,

  /** Short 800 Hz beep on `\a` via Web Audio. Off by default — many TUIs
   *  (opencode, vim with errorbells) ring the bell at intervals that aren't
   *  bursty enough for rate-limiting to help, and an audio bell every few
   *  seconds gets old fast. Flip to true if you want it. */
  audibleBellEnabled: false,
} as const;
