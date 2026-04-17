import { Elysia, t } from 'elysia';
import { renderToString } from 'preact-render-to-string';
import { App } from './components/App';
import clientJs from '../dist/client.js' with { type: 'file' };
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

new Elysia({ websocket: { idleTimeout: 0 } })
  .get('/', () => html(HTML))
  .get('/client.js', () => file(clientJs, 'text/javascript'))
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
