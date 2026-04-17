import { hydrate } from 'preact';
import { TerminalIsland } from './islands/TerminalIsland';

hydrate(<TerminalIsland />, document.getElementById('root')!);
