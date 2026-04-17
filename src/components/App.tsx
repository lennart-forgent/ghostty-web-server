import { TerminalIsland } from '../islands/TerminalIsland';

export function App() {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ghostty-web</title>
        <style>{`html,body{margin:0;padding:0;height:100%;background:#1e1e1e}
#terminal{width:100vw;height:100vh;height:100dvh}`}</style>
      </head>
      <body>
        <div id="root">
          <TerminalIsland />
        </div>
        <script type="module" src="/client.js" />
      </body>
    </html>
  );
}
