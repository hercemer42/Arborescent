import { logger } from './logger';

export async function executeInTerminal(terminalId: string, content: string): Promise<void> {
  if (!content.trim()) {
    logger.error('No content to execute', new Error('Content is empty'), 'Terminal Execution');
    return;
  }

  // Wrap in bracketed paste mode so terminals treat it as a single paste
  const bracketedContent = `\x1b[200~${content}\x1b[201~`;
  await window.electron.terminalWrite(terminalId, bracketedContent);

  await new Promise(resolve => setTimeout(resolve, 150));

  const terminalElement = document.querySelector('.terminal-container .xterm-helper-textarea') as HTMLTextAreaElement;
  if (terminalElement) {
    terminalElement.focus();

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    terminalElement.dispatchEvent(enterEvent);
  }
}
