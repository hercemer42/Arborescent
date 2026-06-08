import '@xterm/xterm/css/xterm.css';
import './Terminal.css';
import { useTerminal } from './hooks/useTerminal';

interface TerminalProps {
  id: string;
  pinnedToBottom?: boolean;
  onResize?: (cols: number, rows: number) => void;
}

export function Terminal({ id, pinnedToBottom = false, onResize }: TerminalProps) {
  const { terminalRef, status } = useTerminal({ id, pinnedToBottom, onResize });

  return (
    <div className="terminal-root">
      <div ref={terminalRef} className="terminal-container" />
      {status !== 'ready' && (
        <div
          className={status === 'error' ? 'terminal-status terminal-status--error' : 'terminal-status'}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live={status === 'error' ? 'assertive' : 'polite'}
        >
          {status === 'error' ? 'Terminal failed to start' : 'Starting terminal…'}
        </div>
      )}
    </div>
  );
}
