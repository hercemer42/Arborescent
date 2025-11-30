import { useState, useMemo } from 'react';
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
import { useContextSubmenu } from './useContextSubmenu';
import { logger } from '../../../services/logger';
import { writeToClipboard } from '../../../services/clipboardService';
import { exportNodeAsMarkdown } from '../../../utils/markdown';
import { hasAncestorWithPluginSession, getEffectiveContextIds } from '../../../utils/nodeHelpers';
import { useCollaborateSubmenu } from './useCollaborateSubmenu';
import { getPositionFromPoint } from '../../../utils/position';

export function useNodeContextMenu(node: TreeNode) {
  const treeType = useStore((state) => state.treeType);
  const isFeedbackTree = treeType === 'feedback';
  const deleteNode = useStore((state) => state.actions.deleteNode);
  const copyNodes = useStore((state) => state.actions.copyNodes);
  const cutNodes = useStore((state) => state.actions.cutNodes);
  const pasteNodes = useStore((state) => state.actions.pasteNodes);
  const toggleNodeSelection = useStore((state) => state.actions.toggleNodeSelection);
  const nodes = useStore((state) => state.nodes);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const collaboratingNodeId = useStore((state) => state.collaboratingNodeId);
  const collaborate = useStore((state) => state.actions.collaborate);
  const collaborateInTerminal = useStore((state) => state.actions.collaborateInTerminal);
  const setActiveContext = useStore((state) => state.actions.setActiveContext);
  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const store = useActiveTreeStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pluginMenuItems, setPluginMenuItems] = useState<ContextMenuItem[]>([]);

  const { executeInTerminal } = useTerminalActions();
  const { handleCancel } = useFeedbackActions();
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const { contextMenuItem } = useContextSubmenu(node);

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isFeedbackTree) return;

    // Focus the node at the right-click position
    const { actions } = store.getState();
    const wrapperElement = e.currentTarget as HTMLElement;
    const contentEditableElement = wrapperElement.querySelector('.node-text') as HTMLElement;

    if (contentEditableElement) {
      const position = getPositionFromPoint(contentEditableElement, e.clientX, e.clientY);
      actions.clearSelection();
      actions.setRememberedVisualX(null);
      actions.selectNode(node.id, position);
    }

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
  const hasEffectiveContext = useMemo(
    () => getEffectiveContextIds(node.id, nodes, ancestorRegistry).length > 0,
    [node.id, nodes, ancestorRegistry]
  );
  const collaborateDisabled = !!collaboratingNodeId || !hasEffectiveContext;
  const collaborateTooltip = !hasEffectiveContext ? 'You must add a context to collaborate' : undefined;

  const collaborateSubmenu = useCollaborateSubmenu({
    node,
    nodes,
    ancestorRegistry,
    hasEffectiveContext,
    onCollaborate: handleCollaborate,
    onCollaborateInTerminal: handleCollaborateInTerminal,
    onSetActiveContext: setActiveContext,
  });

  const baseMenuItems: ContextMenuItem[] = [
    {
      label: 'Collaborate',
      submenu: collaborateSubmenu,
      disabled: collaborateDisabled,
      disabledTooltip: collaborateTooltip,
    },
    ...(isNodeBeingCollaborated ? [{
      label: 'Cancel collaboration',
      onClick: handleCancelCollaboration,
      disabled: false,
    }] : []),
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Select',
          onClick: () => toggleNodeSelection(node.id),
        },
        {
          label: 'Copy',
          onClick: () => copyNodes(),
        },
        {
          label: 'Cut',
          onClick: () => cutNodes(),
        },
        {
          label: 'Paste',
          onClick: () => pasteNodes(),
        },
        {
          label: 'Delete',
          onClick: handleDelete,
          danger: true,
        },
      ],
    },
    ...(contextMenuItem ? [contextMenuItem] : []),
    {
      label: 'Copy to Clipboard',
      onClick: handleCopyToClipboard,
      disabled: false,
    },
    {
      label: 'Execute in Terminal',
      onClick: handleExecuteInTerminal,
      disabled: false,
    },
  ];

  const allMenuItems = [...pluginMenuItems, ...baseMenuItems];

  return {
    contextMenu,
    contextMenuItems: allMenuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu: () => setContextMenu(null),
  };
}
