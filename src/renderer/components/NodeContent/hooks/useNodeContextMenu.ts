import { useState } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { TreeNode, NodeContext, PluginContextMenuItem } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { usePluginStore } from '../../../store/plugins/pluginStore';
import { PluginCommandRegistry } from '../../../../../plugins/core/renderer/CommandRegistry';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useTerminalActions } from '../../Terminal/hooks/useTerminalActions';
import { useFeedbackActions } from '../../Feedback/hooks/useFeedbackActions';
import { usePanelStore } from '../../../store/panel/panelStore';
import { logger } from '../../../services/logger';
import { writeToClipboard } from '../../../services/clipboardService';
import { exportNodeAsMarkdown } from '../../../utils/markdown';
import { hasAncestorWithPluginSession } from '../../../utils/nodeHelpers';

export function useNodeContextMenu(node: TreeNode) {
  const treeType = useStore((state) => state.treeType);
  const isFeedbackTree = treeType === 'feedback';
  const deleteNode = useStore((state) => state.actions.deleteNode);
  const nodes = useStore((state) => state.nodes);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const collaboratingNodeId = useStore((state) => state.collaboratingNodeId);
  const collaborate = useStore((state) => state.actions.collaborate);
  const collaborateInTerminal = useStore((state) => state.actions.collaborateInTerminal);
  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const store = useActiveTreeStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pluginMenuItems, setPluginMenuItems] = useState<ContextMenuItem[]>([]);

  const { sendToTerminal, executeInTerminal } = useTerminalActions();
  const { handleCancel } = useFeedbackActions();
  const showTerminal = usePanelStore((state) => state.showTerminal);

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isFeedbackTree) return;
    setContextMenu({ x: e.clientX, y: e.clientY });

    const hasAncestorSession = hasAncestorWithPluginSession(node.id, nodes, ancestorRegistry);
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
    showTerminal();
    await sendToTerminal(node, nodes);
  };

  const handleExecuteInTerminal = async () => {
    showTerminal();
    await executeInTerminal(node, nodes);
  };

  const handleCopyToClipboard = async () => {
    const formattedContent = exportNodeAsMarkdown(node, nodes);
    await writeToClipboard(formattedContent, 'ContextMenu');
  };

  const handleCollaborate = async () => {
    try {
      await collaborate(node.id);
      // Don't show feedback panel here - let the user stay in their current view
      // Panel will be shown when clipboard content is detected
    } catch (error) {
      logger.error('Failed to start collaboration', error as Error, 'Context Menu');
    }
  };

  const handleCollaborateInTerminal = async () => {
    const terminalId = await useTerminalStore.getState().openTerminal();
    if (!terminalId) {
      logger.error('Failed to create terminal', new Error('No terminal available'), 'Context Menu');
      return;
    }

    try {
      showTerminal();
      await collaborateInTerminal(node.id, terminalId);
    } catch (error) {
      logger.error('Failed to collaborate in terminal', error as Error, 'Context Menu');
    }
  };

  const handleCancelCollaboration = async () => {
    await handleCancel();
  };

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

  const isNodeBeingCollaborated = collaboratingNodeId === node.id;

  const baseMenuItems: ContextMenuItem[] = [
    {
      label: 'Copy to Clipboard',
      onClick: handleCopyToClipboard,
      disabled: false,
    },
    {
      label: 'Send to Terminal',
      onClick: handleSendToTerminal,
      disabled: false,
    },
    {
      label: 'Execute in Terminal',
      onClick: handleExecuteInTerminal,
      disabled: false,
    },
    {
      label: 'Collaborate',
      onClick: handleCollaborate,
      disabled: !!collaboratingNodeId,
    },
    {
      label: 'Collaborate in terminal',
      onClick: handleCollaborateInTerminal,
      disabled: !!collaboratingNodeId,
    },
    ...(isNodeBeingCollaborated ? [{
      label: 'Cancel collaboration',
      onClick: handleCancelCollaboration,
      disabled: false,
    }] : []),
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
