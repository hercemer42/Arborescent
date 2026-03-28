import { TerminalInfo } from '../store/terminal/terminalStore';
import { logger } from './logger';

export async function createTerminal(
  title = 'Terminal',
  shellCommand?: string,
  shellArgs?: string[],
  cwd?: string
): Promise<TerminalInfo> {
  const id = `terminal-${Date.now()}`;

  try {
    const terminalInfo = await window.electron.terminalCreate(id, title, shellCommand, shellArgs, cwd);
    return {
      ...terminalInfo,
      pinnedToBottom: true,
    };
  } catch (error) {
    logger.error('Failed to create terminal', error as Error, 'TerminalService');
    throw error;
  }
}
