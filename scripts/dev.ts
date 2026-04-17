const procs = [
  Bun.spawn(
    ['bun', 'build', '--watch', 'src/client.tsx', '--outdir', 'dist', '--target', 'browser'],
    { stdout: 'inherit', stderr: 'inherit' }
  ),
  Bun.spawn(['bun', '--watch', 'src/server.tsx'], {
    stdout: 'inherit',
    stderr: 'inherit',
  }),
];

const shutdown = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await Promise.race(procs.map((p) => p.exited));
shutdown();
