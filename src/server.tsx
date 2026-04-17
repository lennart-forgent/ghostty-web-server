import { Elysia, t } from 'elysia';
import { renderToString } from 'preact-render-to-string';
import { App } from './components/App';
import { activeProcess } from './active-process';
import ghosttyJs from '../node_modules/ghostty-web/dist/ghostty-web.js' with { type: 'file' };
import wasm from '../node_modules/ghostty-web/ghostty-vt.wasm' with { type: 'file' };
import favicon from '../assets/favicon.ico' with { type: 'file' };

const PORT = Number(process.env.PORT ?? 8080);
const HTML = '<!doctype html>' + renderToString(<App />);

const SCROLLBACK_CAP = 256_000;
const SCROLLBACK_KEEP = 192_000;

type AttachedWS = { send: (data: string) => unknown; close: (code?: number, reason?: string) => unknown };

type Session = {
  id: string;
  startedAt: number;
  proc: ReturnType<typeof Bun.spawn>;
  scrollback: string;
  attached: AttachedWS | null;
  attachKey: number; // monotonically increasing; each WS-attach bumps it. close handler compares.
};

const sessions = new Map<string, Session>();

function createSession(id: string, cols: number, rows: number): Session {
  const decoder = new TextDecoder('utf-8');
  const s: Session = {
    id, startedAt: Date.now(), proc: undefined as never, scrollback: '', attached: null, attachKey: 0,
  };
  s.proc = Bun.spawn([process.env.SHELL ?? '/bin/bash'], {
    cwd: process.env.HOME,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    terminal: {
      cols,
      rows,
      data: (_t, data) => {
        const chunk = decoder.decode(data, { stream: true });
        s.scrollback += chunk;
        if (s.scrollback.length > SCROLLBACK_CAP) {
          s.scrollback = s.scrollback.slice(-SCROLLBACK_KEEP);
        }
        try {
          s.attached?.send(chunk);
        } catch {}
      },
    },
  });
  s.proc.exited.then(() => {
    try {
      s.attached?.send('\r\n\x1b[33mShell exited\x1b[0m\r\n');
      s.attached?.close();
    } catch {}
    sessions.delete(id);
  });
  return s;
}

const html = (body: string) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const resolve = (p: string) =>
  p.startsWith('/') || /^[a-zA-Z]:/.test(p) ? p : `${import.meta.dir}/${p.replace(/^\.\//, '')}`;
const file = (path: string, type: string) =>
  new Response(Bun.file(resolve(path)), { headers: { 'content-type': type } });

let clientCache: string | null = null;
const clientResponse = async () => {
  if (clientCache === null) {
    if (process.env.NODE_ENV !== 'production') {
      const built = await Bun.build({
        entrypoints: [`${import.meta.dir}/client.tsx`],
        target: 'browser',
        sourcemap: 'inline',
      });
      if (!built.success) {
        return new Response(
          '// build failed:\n' + built.logs.map((l) => String(l.message)).join('\n'),
          { status: 500, headers: { 'content-type': 'text/javascript' } }
        );
      }
      clientCache = await built.outputs[0].text();
    } else {
      const m = await import('../dist/client.js', { with: { type: 'file' } });
      clientCache = await Bun.file(resolve(m.default as string)).text();
    }
  }
  return new Response(clientCache, { headers: { 'content-type': 'text/javascript' } });
};

if (process.env.NODE_ENV !== 'production') {
  import(`${import.meta.dir}/client.tsx`).catch(() => {});
  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      clientCache = null;
    });
  }
}

// idleTimeout=30 lets Bun auto-ping every 15s; a tab that goes away (closed,
// navigated, network died) is detected within 30s and the session detaches.
new Elysia({ websocket: { idleTimeout: 30 } })
  .get('/', () => html(HTML))
  .get('/client.js', () => clientResponse())
  .get('/dist/ghostty-web.js', () => file(ghosttyJs, 'text/javascript'))
  .get('/ghostty-vt.wasm', () => file(wasm, 'application/wasm'))
  .get('/favicon.ico', () => file(favicon, 'image/vnd.microsoft.icon'))
  // Empty-module fallback for stale Vite "__vite-browser-external-*.js" stubs
  // that ghostty-web's published bundle occasionally references.
  .get('/dist/*', () => new Response('export {};', { headers: { 'content-type': 'text/javascript' } }))
  .get(
    '/api/sessions',
    async () => ({
      sessions: await Promise.all(
        [...sessions.values()].map(async (s) => ({
          id: s.id,
          startedAt: s.startedAt,
          attached: !!s.attached,
          activeProcess: await activeProcess(s.proc.pid),
        }))
      ),
    })
  )
  .ws('/ws', {
    query: t.Object({
      sessionId: t.String(),
      cols: t.Numeric(),
      rows: t.Numeric(),
      take: t.Optional(t.String()),
    }),
    parse: false,
    open(ws) {
      const { sessionId, cols, rows, take } = ws.data.query;
      let s = sessions.get(sessionId);

      if (s) {
        if (s.attached) {
          if (take === '1') {
            try {
              s.attached.close(1000, 'taken');
            } catch {}
          } else {
            ws.close(4002, 'session-busy');
            return;
          }
        }
        s.attached = ws;
        s.attachKey += 1;
        s.proc.terminal.resize(cols, rows);
        if (s.scrollback) ws.send(s.scrollback);
      } else {
        s = createSession(sessionId, cols, rows);
        sessions.set(sessionId, s);
        s.attached = ws;
        s.attachKey += 1;
      }
      const data = ws.data as { session?: Session; attachKey?: number };
      data.session = s;
      data.attachKey = s.attachKey;
    },
    message(ws, raw) {
      const session = (ws.data as { session?: Session }).session;
      if (!session) return;
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      if (text.startsWith('{')) {
        try {
          const m = JSON.parse(text);
          if (m.type === 'resize') {
            session.proc.terminal.resize(m.cols, m.rows);
            return;
          }
        } catch {}
      }
      session.proc.terminal.write(text);
    },
    close(ws) {
      const data = ws.data as { session?: Session; attachKey?: number };
      const s = data.session;
      // Only detach if this WS is still the current attachment (a newer take/reattach
      // bumps attachKey and we don't want to clobber the new connection).
      if (s && s.attachKey === data.attachKey) s.attached = null;
    },
  })
  .listen(PORT);

console.log(`ghostty-web-server → http://localhost:${PORT}`);
