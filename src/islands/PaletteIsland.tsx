import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadCommands, type Command } from '../palette';

export function PaletteIsland() {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K toggles, Esc closes — listened with capture so the terminal
  // doesn't swallow the keystroke.
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

  // Load + poll commands while open.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    let cancelled = false;
    const refresh = async () => {
      const list = await loadCommands();
      if (!cancelled) setCommands(list);
    };
    refresh();
    const id = setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open]);

  // Focus the search box on open.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      [c.label, c.detail, c.hint, c.group].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Keep selection in range as the filtered list shrinks/grows.
  useEffect(() => {
    if (selected >= filtered.length) setSelected(Math.max(0, filtered.length - 1));
  }, [filtered, selected]);

  const move = (delta: number) => {
    if (filtered.length === 0) return;
    let next = selected;
    for (let i = 0; i < filtered.length; i += 1) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    setSelected(next);
  };

  const invoke = async (cmd: Command | undefined) => {
    if (!cmd || cmd.disabled) return;
    setOpen(false);
    await cmd.onSelect();
  };

  const onInputKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      invoke(filtered[selected]);
    }
  };

  if (!open) return null;

  // Group rows for rendering while preserving global selection index.
  const groups: { label: string; items: { cmd: Command; idx: number }[] }[] = [];
  filtered.forEach((cmd, idx) => {
    const label = cmd.group ?? '';
    let bucket = groups.find((g) => g.label === label);
    if (!bucket) {
      bucket = { label, items: [] };
      groups.push(bucket);
    }
    bucket.items.push({ cmd, idx });
  });

  return (
    <div class="ghostty-palette" onClick={() => setOpen(false)}>
      <div class="ghostty-palette-card" onClick={(e) => e.stopPropagation()}>
        <div class="ghostty-palette-search">
          <span class="ghostty-palette-search-icon">›</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands…"
            value={query}
            onInput={(e) => {
              setQuery((e.target as HTMLInputElement).value);
              setSelected(0);
            }}
            onKeyDown={onInputKey}
            spellcheck={false}
            autocomplete="off"
          />
        </div>
        <div class="ghostty-palette-list">
          {groups.length === 0 && <div class="ghostty-palette-empty">No matches</div>}
          {groups.map((g) => (
            <div key={g.label} class="ghostty-palette-group">
              {g.label && <div class="ghostty-palette-group-label">{g.label}</div>}
              {g.items.map(({ cmd, idx }) => {
                const cls = [
                  'ghostty-palette-row',
                  idx === selected ? 'ghostty-palette-row-selected' : '',
                  cmd.disabled ? 'ghostty-palette-row-disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={cmd.id}
                    class={cls}
                    onMouseEnter={() => !cmd.disabled && setSelected(idx)}
                    onClick={() => invoke(cmd)}
                  >
                    <span class="ghostty-palette-label">{cmd.label}</span>
                    {cmd.detail && <span class="ghostty-palette-detail">{cmd.detail}</span>}
                    {cmd.hint && <span class="ghostty-palette-hint-cell">{cmd.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div class="ghostty-palette-footer">
          <span>↑↓ navigate</span>
          <span>⏎ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
