import { useState } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { TreeNode, NodeContext, PluginContextMenuItem } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { usePluginStore } from '../../../store/plugins/pluginStore';
import { PluginCommandRegistry } from '../../../../../plugins/core/renderer/CommandRegistry';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useTerminalActions } from '../../Terminal/hooks/useTerminalActions';
import { formatNodeAsMarkdown } from '../../../utils/nodeFormatting';
import { logger } from '../../../services/logger';
import { usePanelStore } from '../../../store/panel/panelStore';

export function useNodeContextMenu(node: TreeNode) {
  const deleteNode = useStore((state) => state.actions.deleteNode);
  const nodes = useStore((state) => state.nodes);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const startReview = useStore((state) => state.actions.startReview);
  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);
  const showReview = usePanelStore((state) => state.showReview);
  const store = useActiveTreeStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pluginMenuItems, setPluginMenuItems] = useState<ContextMenuItem[]>([]);

  const { sendToTerminal, executeInTerminal } = useTerminalActions(activeTerminalId);

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });

    const hasAncestorSession = hasAncestorWithSession();
    const nodeContext: NodeContext = {
      hasAncestorSession,
    };

    const items = await Promise.all(
      enabledPlugins.map(async (plugin) => {
        const result = await plugin.extensionPoints.provideNodeContextMenuItems?.(
          node,
          nodeContext
        );
        return result || [];
      })
    );

    const flatItems = items.flat();
    const converted = flatItems.map((item) => convertToContextMenuItem(item, node));
    setPluginMenuItems(converted);
  };

  const handleDelete = () => {
    const deleted = deleteNode(node.id);
    if (!deleted) {
      const confirmed = window.confirm(
        'This node has children. Deleting it will also delete all its children. Are you sure?'
      );
      if (confirmed) {
        deleteNode(node.id, true);
      }
    }
  };

  const handleSendToTerminal = async () => {
    await sendToTerminal(node, nodes);
  };

  const handleExecuteInTerminal = async () => {
    await executeInTerminal(node, nodes);
  };

  const handleCopyToClipboard = async () => {
    try {
      const formattedContent = formatNodeAsMarkdown(node, nodes);
      await navigator.clipboard.writeText(formattedContent);
      logger.info('Copied to clipboard', 'Context Menu');
    } catch (error) {
      logger.error('Failed to copy to clipboard', error as Error, 'Context Menu');
    }
  };

  const handleRequestReview = async () => {
    try {
      // Copy node content to clipboard
      const formattedContent = formatNodeAsMarkdown(node, nodes);
      await navigator.clipboard.writeText(formattedContent);
      logger.info('Copied to clipboard for review', 'Context Menu');

      // Start review mode
      startReview(node.id);

      // Show review panel
      showReview();

      // Start clipboard monitoring
      await window.electron.startClipboardMonitor();
    } catch (error) {
      logger.error('Failed to request review', error as Error, 'Context Menu');
    }
  };

  const handleRequestReviewInTerminal = async () => {
    if (!activeTerminalId) {
      logger.error('No active terminal', new Error('No terminal selected'), 'Context Menu');
      return;
    }

    try {
      // Prepend instruction for Claude Code
      const instruction = 'Review the following list and update it in the same format, then copy your reply to clipboard:\n\n';
      const formattedContent = formatNodeAsMarkdown(node, nodes);
      const contentWithInstruction = instruction + formattedContent;

      // Write instruction + content to terminal
      await window.electron.terminalWrite(activeTerminalId, contentWithInstruction);

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

      logger.info('Requested review in terminal', 'Context Menu');

      // Start review mode
      startReview(node.id);

      // Show review panel
      showReview();

      // Start clipboard monitoring
      await window.electron.startClipboardMonitor();
    } catch (error) {
      logger.error('Failed to request review in terminal', error as Error, 'Context Menu');
    }
  };

  function hasAncestorWithSession(): boolean {
    const ancestors = ancestorRegistry[node.id] || [];
    return ancestors.some((ancestorId) => {
      const ancestor = nodes[ancestorId];
      return ancestor && ancestor.metadata.plugins && Object.keys(ancestor.metadata.plugins).length > 0;
    });
  }

  function convertToContextMenuItem(
    item: PluginContextMenuItem,
    node: TreeNode
  ): ContextMenuItem {
    return {
      label: item.label,
      onClick: () => {
        const state = store.getState();
        PluginCommandRegistry.execute(item.id, {
          node,
          actions: state.actions,
          nodes: state.nodes,
        });
      },
      disabled: item.disabled,
      danger: false,
    };
  }

  const baseMenuItems: ContextMenuItem[] = [
    {
      label: 'Copy to Clipboard',
      onClick: handleCopyToClipboard,
      disabled: false,
    },
    {
      label: 'Send to Terminal',
      onClick: handleSendToTerminal,
      disabled: !activeTerminalId,
    },
    {
      label: 'Execute in Terminal',
      onClick: handleExecuteInTerminal,
      disabled: !activeTerminalId,
    },
    {
      label: 'Request review',
      onClick: handleRequestReview,
      disabled: !!reviewingNodeId,
    },
    {
      label: 'Request review in terminal',
      onClick: handleRequestReviewInTerminal,
      disabled: !activeTerminalId || !!reviewingNodeId,
    },
    {
      label: 'Delete',
      onClick: handleDelete,
      danger: true,
    },
  ];

  const contextMenuItems = [...pluginMenuItems, ...baseMenuItems];

  return {
    contextMenu,
    contextMenuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu: () => setContextMenu(null),
  };
}
