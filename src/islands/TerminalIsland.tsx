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

export function TerminalIsland() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | undefined;
    let term: GhosttyTerminal | undefined;

    (async () => {
      // Runtime URL — built outside of bundler awareness so the path stays a literal HTTP fetch.
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

      const connect = () => {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(
          `${proto}//${location.host}/ws?cols=${term!.cols}&rows=${term!.rows}`
        );
        ws.onmessage = (e) => term!.write(e.data);
        ws.onclose = () => {
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
