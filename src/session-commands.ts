// Session-related commands for the palette. Self-registers on import.

import { registerProvider, type Command } from './palette';

type SessionRow = {
  id: string;
  startedAt: number;
  attached: boolean;
  activeProcess: string;
};

export function switchSession(id: string, take = false) {
  sessionStorage.setItem('ghosttySessionId', id);
  if (take) sessionStorage.setItem('ghosttyTake', '1');
  location.reload();
}

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

registerProvider(async () => {
  let rows: SessionRow[] = [];
  try {
    const data = await fetch('/api/sessions').then((r) => r.json());
    rows = data.sessions ?? [];
  } catch {
    rows = [];
  }
  const currentId = sessionStorage.getItem('ghosttySessionId') ?? '';

  return rows.map<Command>((s) => {
    const isCurrent = s.id === currentId;
    const isOrphan = !s.attached;
    const group = isOrphan ? 'Orphan' : isCurrent ? 'Current' : 'Other tabs';
    const hint = isCurrent ? 'this tab' : isOrphan ? 'switch' : 'take';

    return {
      id: 'session:' + s.id,
      group,
      label: s.id.slice(0, 8) + ' · ' + s.activeProcess,
      detail: relTime(s.startedAt),
      hint,
      disabled: isCurrent,
      onSelect: () => {
        if (isCurrent) return;
        switchSession(s.id, !isOrphan);
      },
    };
  });
});

registerProvider(() => [
  {
    id: 'action:new-tab',
    group: 'Actions',
    label: 'New session in new tab',
    hint: '⏎',
    onSelect: () => {
      window.open(location.origin + '/', '_blank');
    },
  },
  {
    id: 'action:reload',
    group: 'Actions',
    label: 'Reload',
    hint: '⏎',
    onSelect: () => location.reload(),
  },
]);
