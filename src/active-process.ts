// Best-effort foreground-child name for a shell PID.
// Linux & macOS: pgrep + ps. Returns "(idle)" on any failure or no children.

const readAll = async (proc: Bun.Subprocess): Promise<string> => {
  const text = await new Response(proc.stdout as ReadableStream).text();
  await proc.exited;
  return text.trim();
};

export async function activeProcess(shellPid: number): Promise<string> {
  try {
    const child = await readAll(Bun.spawn(['pgrep', '-n', '-P', String(shellPid)], { stdout: 'pipe', stderr: 'ignore' }));
    if (!child) return '(idle)';
    const comm = await readAll(Bun.spawn(['ps', '-o', 'comm=', '-p', child], { stdout: 'pipe', stderr: 'ignore' }));
    return comm || '(idle)';
  } catch {
    return '(idle)';
  }
}
