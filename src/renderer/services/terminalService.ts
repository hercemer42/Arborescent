import { TerminalInfo } from '../store/terminal/terminalStore';
import { logger } from './logger';

/**
 * Creates a new terminal instance via IPC.
 * This is an infrastructure service that handles electron IPC communication.
 * Store updates should be done by the caller (store action).
 * @param title - Optional title for the terminal (defaults to "Terminal")
 * @returns Promise that resolves with terminal info when terminal is created
 */
export async function createTerminal(title = 'Terminal'): Promise<TerminalInfo> {
  const id = `terminal-${Date.now()}`;

  try {
    const terminalInfo = await window.electron.terminalCreate(id, title);
    return terminalInfo;
  } catch (error) {
    logger.error('Failed to create terminal', error as Error, 'TerminalService');
    throw error;
  }
}
