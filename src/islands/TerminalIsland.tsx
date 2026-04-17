import { useEffect, useRef } from 'preact/hooks';

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

function getSessionId(): string {
  let id = sessionStorage.getItem('ghosttySessionId');
  if (!id) {
    id = crypto.randomUUID();
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
        ws.onmessage = (e) => term!.write(e.data);
        ws.onclose = (e) => {
          if (e.code === 4002) {
            term!.write(
              '\r\n\x1b[31mSession is attached in another tab. Press Cmd/Ctrl+K to take it.\x1b[0m\r\n'
            );
            return;
          }
          term!.write('\r\n\x1b[31mConnection closed. Reconnecting in 2s...\x1b[0m\r\n');
          setTimeout(connect, 2000);
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
      ws?.close();
      term?.dispose?.();
    };
  }, []);

  return <div ref={ref} id="terminal" />;
}
