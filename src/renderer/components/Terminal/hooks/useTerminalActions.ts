import { TreeNode } from '../../../../shared/types';
import { formatNodeAsMarkdown } from '../../../utils/nodeFormatting';
import { logger } from '../../../services/logger';

/**
 * Hook providing terminal-related actions for context menus
 */
export function useTerminalActions(activeTerminalId: string | null) {
  const sendToTerminal = async (node: TreeNode, nodes: Record<string, TreeNode>) => {
    if (!activeTerminalId) {
      logger.error('No active terminal', new Error('No terminal selected'), 'Terminal Actions');
      return;
    }

    try {
      const formattedContent = formatNodeAsMarkdown(node, nodes);
      await window.electron.terminalWrite(activeTerminalId, formattedContent + '\n');
      logger.info('Sent content to terminal', 'Terminal Actions');
    } catch (error) {
      logger.error('Failed to send to terminal', error as Error, 'Terminal Actions');
    }
  };

  const executeInTerminal = async (node: TreeNode, nodes: Record<string, TreeNode>) => {
    if (!activeTerminalId) {
      logger.error('No active terminal', new Error('No terminal selected'), 'Terminal Actions');
      return;
    }

    try {
      const formattedContent = formatNodeAsMarkdown(node, nodes);
      if (!formattedContent.trim()) {
        logger.error('No content to execute', new Error('Node is empty'), 'Terminal Actions');
        return;
      }

      await window.electron.terminalWrite(activeTerminalId, formattedContent);

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

      logger.info('Executed content in terminal', 'Terminal Actions');
    } catch (error) {
      logger.error('Failed to execute in terminal', error as Error, 'Terminal Actions');
    }
  };

  return {
    sendToTerminal,
    executeInTerminal,
  };
}
