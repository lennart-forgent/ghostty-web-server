import { useEffect, useRef } from 'preact/hooks';
import { setStatus } from '../status';
import { switchSession } from '../session-commands';

type GhosttyModule = {
  init: () => Promise<unknown>;
  Terminal: new (opts: Record<string, unknown>) => GhosttyTerminal;
  FitAddon: new () => GhosttyFitAddon;
};

interface GhosttyTerminal {
  cols: number;
  rows: number;
  loadAddon(addon: GhosttyFitAddon): void;
  open(el: HTMLElement): Promise<void>;
  write(data: string): void;
  onData(cb: (data: string) => void): void;
  onResize(cb: (size: { cols: number; rows: number }) => void): void;
  dispose?(): void;
}

interface GhosttyFitAddon {
  fit(): void;
  observeResize(): void;
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

    (async () => {
      const url = `${location.origin}/dist/ghostty-web.js`;
      const { init, Terminal, FitAddon } = (await import(/* @vite-ignore */ url)) as GhosttyModule;
      if (cancelled) return;

      await init();
      term = new Terminal({
        cols: 80,
        rows: 24,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
        fontSize: 14,
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      await term.open(ref.current!);
      fitAddon.fit();
      fitAddon.observeResize();

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
      term.onResize(({ cols, rows }) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });
    })();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearInterval(reconnectTimer);
      ws?.close();
      term?.dispose?.();
    };
  }, []);

  return <div ref={ref} id="terminal" />;
}
