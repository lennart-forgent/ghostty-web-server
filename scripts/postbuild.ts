// Prepend the bun shebang so `dist/server.js` is executable as a CLI bin.
const path = 'dist/server.js';
const body = await Bun.file(path).text();
const shebang = '#!/usr/bin/env bun\n';
if (!body.startsWith('#!')) {
  await Bun.write(path, shebang + body);
}
await Bun.$`chmod +x ${path}`;
