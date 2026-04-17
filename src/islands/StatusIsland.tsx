import { useEffect, useState } from 'preact/hooks';
import { subscribe, type Status } from '../status';

function Spinner() {
  return (
    <svg class="ghostty-spinner" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function Icon({ kind }: { kind: 'warn' | 'error' }) {
  return (
    <svg class={`ghostty-icon ghostty-icon-${kind}`} viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'warn' && (
        <path d="M12 3 L22 20 L2 20 Z M12 10 V14 M12 17 V17.01" />
      )}
      {kind === 'error' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 8 L16 16 M16 8 L8 16" />
        </>
      )}
    </svg>
  );
}

export function StatusIsland() {
  const [status, setLocal] = useState<Status>({ kind: 'idle' });

  useEffect(() => subscribe(setLocal), []);

  if (status.kind === 'idle' || status.kind === 'connected') return null;

  return (
    <div class="ghostty-status" role="status" aria-live="polite">
      <div class="ghostty-status-card">
        {status.kind === 'connecting' && (
          <>
            <Spinner />
            <span class="ghostty-status-label">Connecting…</span>
          </>
        )}
        {status.kind === 'reconnecting' && (
          <>
            <Spinner />
            <span class="ghostty-status-label">
              Reconnecting in {status.in}s…
            </span>
          </>
        )}
        {status.kind === 'busy' && (
          <>
            <Icon kind="warn" />
            <div class="ghostty-status-text">
              <strong>Session attached in another tab</strong>
              <span>Take it over to continue here.</span>
            </div>
            <button class="ghostty-status-action" onClick={status.onTake}>
              Take session
            </button>
          </>
        )}
        {status.kind === 'error' && (
          <>
            <Icon kind="error" />
            <span class="ghostty-status-label">{status.message}</span>
          </>
        )}
      </div>
    </div>
  );
}
