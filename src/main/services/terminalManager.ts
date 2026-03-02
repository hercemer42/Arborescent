import * as pty from 'node-pty';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from './logger';

export interface Terminal {
  id: string;
  title: string;
  ptyProcess: pty.IPty;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

const isWindows = process.platform === 'win32';

function commandExists(cmd: string): boolean {
  try {
    const checkCmd = isWindows ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getWindowsShell(): { shell: string; args: string[] } {
  // Prefer PowerShell Core, then Windows PowerShell, then cmd
  if (commandExists('pwsh')) {
    return { shell: 'pwsh', args: ['-NoLogo'] };
  }
  if (commandExists('powershell')) {
    return { shell: 'powershell', args: ['-NoLogo'] };
  }
  return { shell: process.env.COMSPEC || 'cmd.exe', args: [] };
}

const { shell: defaultShell, args: defaultShellArgs } = isWindows
  ? getWindowsShell()
  : { shell: process.env.SHELL || 'bash', args: ['-l'] };

class TerminalManagerClass {
  private terminals: Map<string, Terminal> = new Map();

  create(
    id: string,
    title: string,
    shellCommand: string = defaultShell,
    shellArgs: string[] = defaultShellArgs,
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

  write(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.error(`Terminal ${id} not found`, new Error('Terminal not found'), 'Terminal Manager');
      return;
    }

    terminal.ptyProcess.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.error(`Terminal ${id} not found`, new Error('Terminal not found'), 'Terminal Manager');
      return;
    }

    terminal.ptyProcess.resize(cols, rows);
  }

  destroy(id: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return;
    }

    terminal.ptyProcess.kill();
    this.terminals.delete(id);
    logger.info(`Destroyed terminal ${id}`, 'Terminal Manager');
  }

  get(id: string): Terminal | undefined {
    return this.terminals.get(id);
  }

  destroyAll(): void {
    for (const [id] of this.terminals) {
      this.destroy(id);
    }
  }
}

export const TerminalManager = new TerminalManagerClass();
