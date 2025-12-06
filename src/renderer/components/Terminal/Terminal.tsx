import '@xterm/xterm/css/xterm.css';
import './Terminal.css';
import { useTerminal } from './hooks/useTerminal';

interface TerminalProps {
  id: string;
  pinnedToBottom?: boolean;
  onResize?: (cols: number, rows: number) => void;
}

export function Terminal({ id, pinnedToBottom = true, onResize }: TerminalProps) {
  const { terminalRef } = useTerminal({ id, pinnedToBottom, onResize });

  return <div ref={terminalRef} className="terminal-container" />;
}
