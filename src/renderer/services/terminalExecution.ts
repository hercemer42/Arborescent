import { logger } from './logger';

export async function executeInTerminal(terminalId: string, content: string): Promise<void> {
  if (!content.trim()) {
    logger.error('No content to execute', new Error('Content is empty'), 'Terminal Execution');
    return;
  }

  await window.electron.terminalWrite(terminalId, content + '\r');
}
