import { TreeState } from '../treeStore';
import { buildContentWithContext } from '../../../utils/nodeHelpers';
import { executeInTerminal } from '../../../services/terminalExecution';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { usePanelStore } from '../../panel/panelStore';
import { useTerminalStore } from '../../terminal/terminalStore';

export interface ExecuteActions {
  executeInBrowser: (nodeId: string) => Promise<void>;
  executeInTerminalWithContext: (nodeId: string) => Promise<void>;
}

export function createExecuteActions(
  get: () => TreeState
): ExecuteActions {
  return {
    executeInBrowser: async (nodeId: string) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'ExecuteActions');
        return;
      }

      try {
        const { contextPrefix, nodeContent } = buildContentWithContext(
          nodeId,
          state.nodes,
          state.ancestorRegistry,
          'execute'
        );

        const clipboardContent = contextPrefix + nodeContent;
        await navigator.clipboard.writeText(clipboardContent);

        useToastStore.getState().addToast(
          'Content copied to clipboard - Paste to execute',
          'info'
        );

        usePanelStore.getState().showBrowser();
        logger.info(`Executed in browser for node: ${nodeId}`, 'ExecuteActions');
      } catch (error) {
        logger.error('Failed to execute in browser', error as Error, 'ExecuteActions');
        throw error;
      }
    },

    executeInTerminalWithContext: async (nodeId: string) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'ExecuteActions');
        return;
      }

      const terminalId = await useTerminalStore.getState().openTerminal();
      if (!terminalId) {
        logger.error('Failed to create terminal', new Error('No terminal available'), 'ExecuteActions');
        return;
      }

      try {
        const { contextPrefix, nodeContent } = buildContentWithContext(
          nodeId,
          state.nodes,
          state.ancestorRegistry,
          'execute'
        );

        const terminalContent = contextPrefix + nodeContent;
        usePanelStore.getState().showTerminal();
        await executeInTerminal(terminalId, terminalContent);

        logger.info(`Executed in terminal for node: ${nodeId}`, 'ExecuteActions');
      } catch (error) {
        logger.error('Failed to execute in terminal', error as Error, 'ExecuteActions');
        throw error;
      }
    },
  };
}
