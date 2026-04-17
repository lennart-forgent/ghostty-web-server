// Tiny pub/sub for the connection-status overlay. TerminalIsland calls
// `setStatus`, StatusIsland subscribes.

export type Status =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'reconnecting'; in: number }
  | { kind: 'busy'; onTake: () => void }
  | { kind: 'error'; message: string };

const listeners = new Set<(s: Status) => void>();
let current: Status = { kind: 'idle' };

export function setStatus(s: Status) {
  current = s;
  for (const l of listeners) l(s);
}

export function subscribe(fn: (s: Status) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => {
    listeners.delete(fn);
  };
}
