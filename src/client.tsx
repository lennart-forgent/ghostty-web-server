import { hydrate } from 'preact';
import { TerminalIsland } from './islands/TerminalIsland';

if (typeof document !== 'undefined') {
  hydrate(<TerminalIsland />, document.getElementById('root')!);
}
