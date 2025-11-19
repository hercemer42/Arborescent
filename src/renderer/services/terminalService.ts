import { useTerminalStore } from '../store/terminal/terminalStore';
import { logger } from './logger';

/**
 * Creates a new terminal instance
 * @param title - Optional title for the terminal (defaults to "Terminal")
 * @returns Promise that resolves when terminal is created
 */
export async function createTerminal(title = 'Terminal'): Promise<void> {
  const id = `terminal-${Date.now()}`;

  try {
    const terminalInfo = await window.electron.terminalCreate(id, title);
    useTerminalStore.getState().addTerminal(terminalInfo);
  } catch (error) {
    logger.error('Failed to create terminal', error as Error, 'TerminalService');
    throw error;
  }
}
