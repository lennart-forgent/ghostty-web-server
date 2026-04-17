import { hydrate } from 'preact';
import './session-commands'; // side-effect: registers session/action providers
import { TerminalIsland } from './islands/TerminalIsland';
import { PaletteIsland } from './islands/PaletteIsland';
import { StatusIsland } from './islands/StatusIsland';

if (typeof document !== 'undefined') {
  hydrate(<TerminalIsland />, document.getElementById('root')!);
  hydrate(<PaletteIsland />, document.getElementById('palette-root')!);
  hydrate(<StatusIsland />, document.getElementById('status-root')!);
}
