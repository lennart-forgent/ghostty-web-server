import { useEffect, useRef } from 'preact/hooks';
import { setStatus } from '../status';
import { switchSession } from '../session-commands';
import { settings } from '../settings';

type GhosttyModule = {
  init: () => Promise<unknown>;
  Terminal: new (opts: Record<string, unknown>) => GhosttyTerminal;
};

interface GhosttyTerminal {
  cols: number;
  rows: number;
  renderer: { getMetrics(): { width: number; height: number } };
  open(el: HTMLElement): Promise<void>;
  resize(cols: number, rows: number): void;
  write(data: string): void;
  onData(cb: (data: string) => void): void;
  onResize(cb: (size: { cols: number; rows: number }) => void): void;
  dispose?(): void;
}

// RFC4122 v4 via getRandomValues, which (unlike crypto.randomUUID) works on
// plain-HTTP non-localhost origins too.
function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function getSessionId(): string {
  let id = sessionStorage.getItem('ghosttySessionId');
  if (!id) {
    id = uuid();
    sessionStorage.setItem('ghosttySessionId', id);
  }
  return id;
}

function consumeTakeFlag(): boolean {
  const taken = sessionStorage.getItem('ghosttyTake') === '1';
  if (taken) sessionStorage.removeItem('ghosttyTake');
  return taken;
}

export function TerminalIsland() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | undefined;
    let term: GhosttyTerminal | undefined;
    let take = consumeTakeFlag();
    let reconnectTimer: ReturnType<typeof setInterval> | undefined;
    let ro: ResizeObserver | undefined;

    (async () => {
      const url = `${location.origin}/dist/ghostty-web.js`;
      const { init, Terminal } = (await import(/* @vite-ignore */ url)) as GhosttyModule;
      if (cancelled) return;

      await init();
      term = new Terminal({
        cols: 80,
        rows: 24,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
        fontSize: 14,
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      });
      await term.open(ref.current!);

      // Compute cols/rows directly from container size — fitAddon ships its
      // own 100ms ResizeObserver debounce *and* a 50ms `_isResizing` lockout,
      // both of which make drag-resize feel like it stalls.
      const fit = () => {
        if (!term || !ref.current) return;
        const m = term.renderer.getMetrics();
        if (!m.width || !m.height) return;
        const cols = Math.max(settings.minCols, Math.floor(ref.current.clientWidth / m.width));
        const rows = Math.max(settings.minRows, Math.floor(ref.current.clientHeight / m.height));
        if (cols !== term.cols || rows !== term.rows) term.resize(cols, rows);
      };
      fit();
      ro = new ResizeObserver(fit);
      ro.observe(ref.current!);

      const sessionId = getSessionId();

      const connect = () => {
        if (cancelled) return;
        setStatus({ kind: 'connecting' });
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const params = new URLSearchParams({
          sessionId,
          cols: String(term!.cols),
          rows: String(term!.rows),
        });
        if (take) {
          params.set('take', '1');
          take = false;
        }
        ws = new WebSocket(`${proto}//${location.host}/ws?${params}`);
        ws.onopen = () => setStatus({ kind: 'connected' });
        ws.onmessage = (e) => term!.write(e.data);
        ws.onclose = (e) => {
          if (cancelled) return;
          if (e.code === 4002) {
            setStatus({
              kind: 'busy',
              onTake: () => switchSession(sessionId, true),
            });
            return;
          }
          let n = 2;
          setStatus({ kind: 'reconnecting', in: n });
          reconnectTimer = setInterval(() => {
            n -= 1;
            if (n <= 0) {
              clearInterval(reconnectTimer);
              connect();
            } else {
              setStatus({ kind: 'reconnecting', in: n });
            }
          }, 1000);
        };
      };
      connect();

      term.onData((d) => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(d);
      });

      let pendingSize: { cols: number; rows: number } | null = null;
      let lastSent = 0;
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      let settleTimer: ReturnType<typeof setTimeout> | null = null;
      const flushResize = () => {
        resizeTimer = null;
        if (!pendingSize || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'resize', ...pendingSize }));
        pendingSize = null;
        lastSent = performance.now();
      };
      term.onResize(({ cols, rows }) => {
        pendingSize = { cols, rows };
        if (!resizeTimer) {
          const wait = Math.max(0, settings.resizeMinIntervalMs - (performance.now() - lastSent));
          resizeTimer = setTimeout(flushResize, wait);
        }
        if (settings.resizeAutoRedrawMs > 0) {
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            settleTimer = null;
            if (ws && ws.readyState === WebSocket.OPEN) ws.send('\x0c'); // ^L
          }, settings.resizeAutoRedrawMs);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearInterval(reconnectTimer);
      ro?.disconnect();
      ws?.close();
      term?.dispose?.();
    };
  }, []);

  return <div ref={ref} id="terminal" />;
}
