import { Elysia, t } from 'elysia';
import { renderToString } from 'preact-render-to-string';
import { App } from './components/App';
import ghosttyJs from '../node_modules/ghostty-web/dist/ghostty-web.js' with { type: 'file' };
import wasm from '../node_modules/ghostty-web/ghostty-vt.wasm' with { type: 'file' };

const PORT = Number(process.env.PORT ?? 8080);
const HTML = '<!doctype html>' + renderToString(<App />);

const html = (body: string) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const resolve = (p: string) =>
  p.startsWith('/') || /^[a-zA-Z]:/.test(p) ? p : `${import.meta.dir}/${p.replace(/^\.\//, '')}`;
const file = (path: string, type: string) =>
  new Response(Bun.file(resolve(path)), { headers: { 'content-type': type } });

// `--define 'process.env.NODE_ENV="production"'` folds these checks at build
// time, so the dev branch (Bun.build, dynamic imports of client.tsx) is dead
// code in the npm bundle and the --compile binary. Verified post-build.
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
  // Anchor src/client.tsx in the dev import graph so `--hot` reloads pick up
  // edits to it and its deps. Fire-and-forget — top-level await isn't allowed
  // by `bun build --compile`. Dynamic template-string is invisible to the
  // bundler so the npm-bundle and binary don't pull client.tsx in.
  import(`${import.meta.dir}/client.tsx`).catch(() => {});

  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      clientCache = null;
    });
  }
}

new Elysia({ websocket: { idleTimeout: 0 } })
  .get('/', () => html(HTML))
  .get('/client.js', () => clientResponse())
  .get('/dist/ghostty-web.js', () => file(ghosttyJs, 'text/javascript'))
  .get('/ghostty-vt.wasm', () => file(wasm, 'application/wasm'))
  .ws('/ws', {
    query: t.Object({ cols: t.Numeric(), rows: t.Numeric() }),
    parse: false,
    open(ws) {
      const { cols, rows } = ws.data.query;
      const decoder = new TextDecoder('utf-8');
      const proc = Bun.spawn([process.env.SHELL ?? '/bin/bash'], {
        cwd: process.env.HOME,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
        terminal: {
          cols,
          rows,
          data: (_t, data) => {
            try {
              ws.send(decoder.decode(data, { stream: true }));
            } catch {}
          },
        },
      });
      ws.data.proc = proc;
      proc.exited.then((code) => {
        try {
          ws.send(`\r\n\x1b[33mShell exited (code: ${code})\x1b[0m\r\n`);
          ws.close();
        } catch {}
      });
    },
    message(ws, raw) {
      const s = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      const proc = ws.data.proc;
      if (s.startsWith('{')) {
        try {
          const m = JSON.parse(s);
          if (m.type === 'resize') {
            proc.terminal.resize(m.cols, m.rows);
            return;
          }
        } catch {}
      }
      proc.terminal.write(s);
    },
    close(ws) {
      ws.data.proc?.kill();
    },
  })
  .listen(PORT);

console.log(`ghostty-web-server → http://localhost:${PORT}`);
