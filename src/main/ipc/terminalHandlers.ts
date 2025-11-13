import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TerminalManager } from '../services/TerminalManager';
import { logger } from '../services/logger';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

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

        // Forward PTY output to renderer
        terminal.ptyProcess.onData((data: string) => {
          mainWindow.webContents.send(`terminal:data:${id}`, data);
        });

        // Forward PTY exit event
        terminal.ptyProcess.onExit(({ exitCode, signal }) => {
          mainWindow.webContents.send(`terminal:exit:${id}`, { exitCode, signal });
        });

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
        TerminalManager.destroy(id);
      } catch (error) {
        logger.error(`Failed to destroy terminal ${id}`, error as Error, 'Terminal IPC');
        throw error;
      }
    }
  );
}

/**
 * Cleanup terminals on app quit
 */
export function cleanupTerminals() {
  TerminalManager.destroyAll();
}
