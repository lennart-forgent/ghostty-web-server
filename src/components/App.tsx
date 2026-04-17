import { TerminalIsland } from '../islands/TerminalIsland';
import { PaletteIsland } from '../islands/PaletteIsland';

const STYLES = `
html,body{margin:0;padding:0;height:100%;background:#1e1e1e}
#terminal{width:100vw;height:100vh;height:100dvh}

.ghostty-palette{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;z-index:1000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5}
.ghostty-palette-card{background:#2a2a2a;border:1px solid #3a3a3a;border-radius:10px;width:min(640px,92vw);max-height:75vh;overflow:auto;box-shadow:0 25px 60px rgba(0,0,0,.6)}
.ghostty-palette-header{padding:12px 16px;font-weight:600;font-size:13px;border-bottom:1px solid #3a3a3a;color:#bbb}
.ghostty-palette-group{padding:6px 0;border-bottom:1px solid #333}
.ghostty-palette-group:last-of-type{border-bottom:none}
.ghostty-palette-group-label{padding:6px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888}
.ghostty-palette-row{display:grid;grid-template-columns:80px 1fr 1fr auto;align-items:center;gap:12px;padding:8px 16px;border:none;background:transparent;color:inherit;width:100%;text-align:left;font:inherit}
.ghostty-palette-clickable{cursor:pointer}
.ghostty-palette-clickable:hover{background:#363636}
.ghostty-palette-id{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#9cdcfe}
.ghostty-palette-meta{font-size:12px;color:#aaa}
.ghostty-palette-proc{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#ce9178;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ghostty-palette-action{font-size:11px;color:#888}
.ghostty-palette-take{font-size:11px;background:#444;border:1px solid #555;color:#e5e5e5;border-radius:4px;padding:3px 8px;cursor:pointer}
.ghostty-palette-take:hover{background:#555}
.ghostty-palette-empty{padding:24px;text-align:center;color:#888;font-size:13px}
.ghostty-palette-hint{padding:8px 16px;font-size:11px;color:#666;border-top:1px solid #3a3a3a;text-align:right}
`;

export function App() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/vnd.microsoft.icon" href="/favicon.ico" />
        <title>ghostty-web</title>
        <style>{STYLES}</style>
      </head>
      <body>
        <div id="root">
          <TerminalIsland />
        </div>
        <div id="palette-root">
          <PaletteIsland />
        </div>
        <script type="module" src="/client.js" />
      </body>
    </html>
  );
}
