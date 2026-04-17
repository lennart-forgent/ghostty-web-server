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
} as const;
