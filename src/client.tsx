import { hydrate } from 'preact';
import { TerminalIsland } from './islands/TerminalIsland';
import { PaletteIsland } from './islands/PaletteIsland';

if (typeof document !== 'undefined') {
  hydrate(<TerminalIsland />, document.getElementById('root')!);
  hydrate(<PaletteIsland />, document.getElementById('palette-root')!);
}
