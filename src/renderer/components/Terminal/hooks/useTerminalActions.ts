import { TreeNode } from '../../../../shared/types';
import { exportNodeAsMarkdown } from '../../../utils/markdown';
import { logger } from '../../../services/logger';
import { executeInTerminal as executeInTerminalUtil } from '../../../utils/terminalExecution';

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
      const formattedContent = exportNodeAsMarkdown(node, nodes);
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
      const formattedContent = exportNodeAsMarkdown(node, nodes);
      await executeInTerminalUtil(activeTerminalId, formattedContent);
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
