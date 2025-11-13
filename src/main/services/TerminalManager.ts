import * as pty from 'node-pty';
import * as os from 'os';
import { logger } from './logger';

export interface Terminal {
  id: string;
  title: string;
  ptyProcess: pty.IPty;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

class TerminalManagerClass {
  private terminals: Map<string, Terminal> = new Map();

  /**
   * Create a new terminal instance
   */
  create(
    id: string,
    title: string,
    shellCommand: string = process.env.SHELL || 'bash',
    shellArgs: string[] = [],
    cwd: string = os.homedir()
  ): Terminal {
    if (this.terminals.has(id)) {
      logger.warn(`Terminal ${id} already exists`, 'Terminal Manager');
      return this.terminals.get(id)!;
    }

    const ptyProcess = pty.spawn(shellCommand, shellArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as { [key: string]: string },
    });

    const terminal: Terminal = {
      id,
      title,
      ptyProcess,
      cwd,
      shellCommand,
      shellArgs,
    };

    this.terminals.set(id, terminal);
    logger.info(`Created terminal ${id}: ${shellCommand} ${shellArgs.join(' ')}`, 'Terminal Manager');

    return terminal;
  }

  /**
   * Write data to a terminal
   */
  write(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.error(`Terminal ${id} not found`, new Error('Terminal not found'), 'Terminal Manager');
      return;
    }

    terminal.ptyProcess.write(data);
  }

  /**
   * Resize a terminal
   */
  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.error(`Terminal ${id} not found`, new Error('Terminal not found'), 'Terminal Manager');
      return;
    }

    terminal.ptyProcess.resize(cols, rows);
  }

  /**
   * Destroy a terminal
   */
  destroy(id: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return;
    }

    terminal.ptyProcess.kill();
    this.terminals.delete(id);
    logger.info(`Destroyed terminal ${id}`, 'Terminal Manager');
  }

  /**
   * Get a terminal by ID
   */
  get(id: string): Terminal | undefined {
    return this.terminals.get(id);
  }


  /**
   * Destroy all terminals
   */
  destroyAll(): void {
    for (const [id] of this.terminals) {
      this.destroy(id);
    }
  }
}

export const TerminalManager = new TerminalManagerClass();
