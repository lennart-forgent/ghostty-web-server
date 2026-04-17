import { useEffect, useState } from 'preact/hooks';

type SessionRow = {
  id: string;
  startedAt: number;
  attached: boolean;
  activeProcess: string;
};

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function switchSession(id: string, take = false) {
  sessionStorage.setItem('ghosttySessionId', id);
  if (take) sessionStorage.setItem('ghosttyTake', '1');
  location.reload();
}

export function PaletteIsland() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [currentId, setCurrentId] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCurrentId(sessionStorage.getItem('ghosttySessionId') ?? '');
    let cancelled = false;
    const refresh = () =>
      fetch('/api/sessions')
        .then((r) => r.json())
        .then((data: { sessions: SessionRow[] }) => {
          if (!cancelled) setRows(data.sessions);
        })
        .catch(() => {});
    refresh();
    const id = setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open]);

  if (!open) return null;

  const orphans = rows.filter((r) => !r.attached);
  const others = rows.filter((r) => r.attached && r.id !== currentId);
  const current = rows.find((r) => r.id === currentId);

  return (
    <div class="ghostty-palette" onClick={() => setOpen(false)}>
      <div class="ghostty-palette-card" onClick={(e) => e.stopPropagation()}>
        <div class="ghostty-palette-header">Sessions</div>

        {orphans.length > 0 && (
          <div class="ghostty-palette-group">
            <div class="ghostty-palette-group-label">Orphan</div>
            {orphans.map((r) => (
              <button
                key={r.id}
                class="ghostty-palette-row ghostty-palette-clickable"
                onClick={() => switchSession(r.id)}
              >
                <span class="ghostty-palette-id">{r.id.slice(0, 8)}</span>
                <span class="ghostty-palette-meta">{relTime(r.startedAt)}</span>
                <span class="ghostty-palette-proc">{r.activeProcess}</span>
                <span class="ghostty-palette-action">⏎ switch</span>
              </button>
            ))}
          </div>
        )}

        {current && (
          <div class="ghostty-palette-group">
            <div class="ghostty-palette-group-label">Current</div>
            <div class="ghostty-palette-row">
              <span class="ghostty-palette-id">{current.id.slice(0, 8)}</span>
              <span class="ghostty-palette-meta">{relTime(current.startedAt)}</span>
              <span class="ghostty-palette-proc">{current.activeProcess}</span>
              <span class="ghostty-palette-action">this tab</span>
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div class="ghostty-palette-group">
            <div class="ghostty-palette-group-label">Other tabs</div>
            {others.map((r) => (
              <div key={r.id} class="ghostty-palette-row">
                <span class="ghostty-palette-id">{r.id.slice(0, 8)}</span>
                <span class="ghostty-palette-meta">{relTime(r.startedAt)}</span>
                <span class="ghostty-palette-proc">{r.activeProcess}</span>
                <button
                  class="ghostty-palette-take"
                  onClick={() => switchSession(r.id, true)}
                >
                  Take
                </button>
              </div>
            ))}
          </div>
        )}

        {rows.length === 0 && <div class="ghostty-palette-empty">No sessions</div>}

        <div class="ghostty-palette-hint">⌘K to toggle · Esc to close</div>
      </div>
    </div>
  );
}
