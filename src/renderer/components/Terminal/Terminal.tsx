import '@xterm/xterm/css/xterm.css';
import './Terminal.css';
import { useTerminal } from './hooks/useTerminal';

interface TerminalProps {
  id: string;
  onResize?: (cols: number, rows: number) => void;
}

export function Terminal({ id, onResize }: TerminalProps) {
  const { terminalRef } = useTerminal({ id, onResize });

  return <div ref={terminalRef} className="terminal-container" />;
}
