# ghostty-web-server

A local web server that opens a real shell session in your browser, rendered with the
[ghostty-web](https://github.com/coder/ghostty-web) terminal emulator. Runs on
**Linux** and **macOS** (no Windows support yet).

## Quick Start

```bash
npx ghostty-web-server
```

Then open http://localhost:8080 in your browser.

## What it does

- Starts an HTTP server on port 8080 (configurable via `PORT` env var)
- Serves a WebSocket PTY on the same port at the `/ws` endpoint
- Spawns a real shell (`$SHELL`, falling back to `/bin/bash`)
- Provides full PTY support (colors, cursor positioning, resize, etc.)
- Supports reverse proxies (ngrok, nginx, etc.) via `X-Forwarded-*` headers

## Usage

```bash
# Default (port 8080)
npx ghostty-web-server

# Custom port
PORT=3000 npx ghostty-web-server
```

### Local development

If you've cloned this repo and want auto-restart while editing `bin/server.js`:

```bash
npm install
npm run dev
```

This runs the server on port 8000 under `node --watch`, restarting whenever
the file changes.

## Reverse Proxy Support

The server runs HTTP and WebSocket on the same port and uses relative WebSocket
URLs on the client, so it works behind ngrok, nginx, and similar proxies with no
additional configuration. Protocol selection (ws / wss) is automatic based on
the page's protocol.

### Example with ngrok

```bash
# Start the server
npx ghostty-web-server

# In another terminal, expose it
ngrok http 8080
```

### Example with nginx

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Security Warning

⚠️ **This server provides full shell access.**

Only use for local development and demos. Do not expose to untrusted networks.
