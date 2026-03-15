import { logger } from './logger';

export async function executeInTerminal(terminalId: string, content: string): Promise<void> {
  if (!content.trim()) {
    logger.error('No content to execute', new Error('Content is empty'), 'Terminal Execution');
    return;
  }

  const bracketedContent = `\x1b[200~${content}\x1b[201~`;
  await window.electron.terminalWrite(terminalId, bracketedContent);
  // Delay ensures the paste completes before Enter is sent
  await new Promise((resolve) => setTimeout(resolve, 200));
  await window.electron.terminalWrite(terminalId, '\r');
}
