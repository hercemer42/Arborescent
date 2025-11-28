import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TerminalManager } from '../services/TerminalManager';
import { logger } from '../services/logger';
import { IDisposable } from 'node-pty';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

// Track disposables for each terminal so we can clean them up
const terminalDisposables: Map<string, IDisposable[]> = new Map();

export function registerTerminalHandlers(mainWindow: Electron.BrowserWindow) {
  /**
   * Create a new terminal
   */
  ipcMain.handle(
    'terminal:create',
    async (
      _event: IpcMainInvokeEvent,
      id: string,
      title: string,
      shellCommand?: string,
      shellArgs?: string[],
      cwd?: string
    ): Promise<TerminalInfo> => {
      try {
        const terminal = TerminalManager.create(id, title, shellCommand, shellArgs, cwd);

        const disposables: IDisposable[] = [];

        // Forward PTY output to renderer (with destroyed check)
        disposables.push(terminal.ptyProcess.onData((data: string) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`terminal:data:${id}`, data);
          }
        }));

        // Forward PTY exit event (with destroyed check)
        disposables.push(terminal.ptyProcess.onExit(({ exitCode, signal }) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`terminal:exit:${id}`, { exitCode, signal });
          }
        }));

        terminalDisposables.set(id, disposables);

        return {
          id: terminal.id,
          title: terminal.title,
          cwd: terminal.cwd,
          shellCommand: terminal.shellCommand,
          shellArgs: terminal.shellArgs,
        };
      } catch (error) {
        logger.error('Failed to create terminal', error as Error, 'Terminal IPC');
        throw error;
      }
    }
  );

  /**
   * Write data to a terminal
   */
  ipcMain.handle(
    'terminal:write',
    async (_event: IpcMainInvokeEvent, id: string, data: string): Promise<void> => {
      try {
        TerminalManager.write(id, data);
      } catch (error) {
        logger.error(`Failed to write to terminal ${id}`, error as Error, 'Terminal IPC');
        throw error;
      }
    }
  );

  /**
   * Resize a terminal
   */
  ipcMain.handle(
    'terminal:resize',
    async (_event: IpcMainInvokeEvent, id: string, cols: number, rows: number): Promise<void> => {
      try {
        TerminalManager.resize(id, cols, rows);
      } catch (error) {
        logger.error(`Failed to resize terminal ${id}`, error as Error, 'Terminal IPC');
        throw error;
      }
    }
  );

  /**
   * Destroy a terminal
   */
  ipcMain.handle(
    'terminal:destroy',
    async (_event: IpcMainInvokeEvent, id: string): Promise<void> => {
      try {
        // Dispose listeners first
        const disposables = terminalDisposables.get(id);
        if (disposables) {
          disposables.forEach(d => d.dispose());
          terminalDisposables.delete(id);
        }
        TerminalManager.destroy(id);
      } catch (error) {
        logger.error(`Failed to destroy terminal ${id}`, error as Error, 'Terminal IPC');
        throw error;
      }
    }
  );
}

/**
 * Dispose listeners for a specific terminal
 */
export function disposeTerminalListeners(id: string) {
  const disposables = terminalDisposables.get(id);
  if (disposables) {
    disposables.forEach(d => d.dispose());
    terminalDisposables.delete(id);
  }
}

/**
 * Cleanup terminals on app quit
 */
export function cleanupTerminals() {
  // Dispose all listeners first to prevent "Object has been destroyed" errors
  for (const [id] of terminalDisposables) {
    disposeTerminalListeners(id);
  }
  TerminalManager.destroyAll();
}
