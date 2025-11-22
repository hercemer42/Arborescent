import { logger } from './logger';

/**
 * Writes content to terminal and executes it by simulating Enter key press
 */
export async function executeInTerminal(terminalId: string, content: string): Promise<void> {
  if (!content.trim()) {
    logger.error('No content to execute', new Error('Content is empty'), 'Terminal Execution');
    return;
  }

  await window.electron.terminalWrite(terminalId, content);

  // Wait a moment for text to be written
  await new Promise(resolve => setTimeout(resolve, 50));

  // Focus and send Enter key event to the terminal
  const terminalElement = document.querySelector('.terminal-container .xterm-helper-textarea') as HTMLTextAreaElement;
  if (terminalElement) {
    terminalElement.focus();

    // Dispatch Enter key event
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
