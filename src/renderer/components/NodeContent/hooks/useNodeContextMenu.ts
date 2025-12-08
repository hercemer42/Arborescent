import { useState, useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { TreeNode, NodeContext, PluginContextMenuItem } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { usePluginStore } from '../../../store/plugins/pluginStore';
import { PluginCommandRegistry } from '../../../../../plugins/core/renderer/CommandRegistry';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useFeedbackActions } from '../../Feedback/hooks/useFeedbackActions';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useFilesStore } from '../../../store/files/filesStore';
import { buildBlueprintSubmenu } from './useBlueprintSubmenu';
import { logger } from '../../../services/logger';
import { writeToClipboard } from '../../../services/clipboardService';
import { exportNodeAsMarkdown } from '../../../utils/markdown';
import { hasAncestorWithPluginSession } from '../../../utils/nodeHelpers';
import { buildCollaborateSubmenu } from './useCollaborateSubmenu';
import { buildExecuteSubmenu } from './useExecuteSubmenu';
import { getPositionFromPoint } from '../../../utils/position';
import { useIconPickerStore } from '../../../store/iconPicker/iconPickerStore';

export function useNodeContextMenu(node: TreeNode) {
  const treeType = useStore((state) => state.treeType);
  const isFeedbackTree = treeType === 'feedback';
  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const store = useActiveTreeStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuItems, setMenuItems] = useState<ContextMenuItem[]>([]);

  const { handleCancel } = useFeedbackActions();
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const openIconPicker = useIconPickerStore((state) => state.open);
  const activeFile = useFilesStore((state) => state.getActiveFile());
  const openZoomTab = useFilesStore((state) => state.openZoomTab);
  const isZoomTab = !!activeFile?.zoomSource;

  function convertToContextMenuItem(
    item: PluginContextMenuItem,
    targetNode: TreeNode
  ): ContextMenuItem {
    return {
      label: item.label,
      onClick: () => {
        const state = store.getState();
        PluginCommandRegistry.execute(item.id, {
          node: targetNode,
          actions: state.actions,
          nodes: state.nodes,
        });
      },
      disabled: item.disabled,
      danger: false,
    };
  }

  // Build all menu items when context menu is opened (lazy evaluation)
  const buildMenuItems = useCallback(async () => {
    const state = store.getState();
    const { nodes, ancestorRegistry, collaboratingNodeId, contextDeclarations, actions } = state;

    // Plugin items
    const hasAncestorSession = hasAncestorWithPluginSession(node.id, nodes, ancestorRegistry);
    const nodeContext: NodeContext = { hasAncestorSession };

    const pluginResults = await Promise.all(
      enabledPlugins.map(async (plugin) => {
        const result = await plugin.extensionPoints.provideNodeContextMenuItems?.(
          node,
          nodeContext
        );
        return result || [];
      })
    );
    const pluginItems = pluginResults.flat().map((item) => convertToContextMenuItem(item, node));

    // Compute context-related values
    const isNodeBeingCollaborated = collaboratingNodeId === node.id;
    const collaborateDisabled = !!collaboratingNodeId;

    // Handlers
    const handleCollaborate = async () => {
      try {
        await actions.collaborate(node.id);
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
        await actions.collaborateInTerminal(node.id, terminalId);
      } catch (error) {
        logger.error('Failed to collaborate in terminal', error as Error, 'Context Menu');
      }
    };

    const handleExecuteInBrowser = async () => {
      try {
        await actions.executeInBrowser(node.id);
      } catch (error) {
        logger.error('Failed to execute in browser', error as Error, 'Context Menu');
      }
    };

    const handleExecuteInTerminal = async () => {
      try {
        await actions.executeInTerminalWithContext(node.id);
      } catch (error) {
        logger.error('Failed to execute in terminal', error as Error, 'Context Menu');
      }
    };

    const handleDelete = () => {
      const deleted = actions.deleteNode(node.id);
      if (!deleted) {
        const confirmed = window.confirm(
          'This node has children. Deleting it will also delete all its children. Are you sure?'
        );
        if (confirmed) {
          actions.deleteNode(node.id, true);
        }
      }
    };

    const handleCopyToClipboard = async () => {
      const currentNodes = store.getState().nodes;
      const formattedContent = exportNodeAsMarkdown(node, currentNodes);
      await writeToClipboard(formattedContent, 'ContextMenu');
    };

    const handleZoom = () => {
      if (!activeFile || isZoomTab) return;
      openZoomTab(activeFile.path, node.id, node.content);
    };

    // Wrap setActiveContext to rebuild menu items after selection
    const handleSetActiveContext = async (nodeId: string, contextId: string | null, actionType?: 'execute' | 'collaborate') => {
      actions.setActiveContext(nodeId, contextId, actionType);
      // Rebuild menu items to reflect new selection state
      const newItems = await buildMenuItems();
      setMenuItems(newItems);
    };

    // Wrap setAppliedContext to rebuild menu items after selection
    const handleSetAppliedContext = async (contextId: string | null) => {
      actions.setAppliedContext(node.id, contextId);
      // Rebuild menu items to reflect new selection state
      const newItems = await buildMenuItems();
      setMenuItems(newItems);
    };

    const handleDeclareAsContext = () => {
      openIconPicker(null, (selection) => {
        actions.declareAsContext(node.id, selection.icon, selection.color);
      });
    };

    // Build submenus
    const executeSubmenu = buildExecuteSubmenu({
      node,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onExecuteInBrowser: handleExecuteInBrowser,
      onExecuteInTerminal: handleExecuteInTerminal,
      onSetActiveContext: handleSetActiveContext,
    });

    const collaborateSubmenu = buildCollaborateSubmenu({
      node,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onCollaborate: handleCollaborate,
      onCollaborateInTerminal: handleCollaborateInTerminal,
      onSetActiveContext: handleSetActiveContext,
    });

    // Use fresh node from state for blueprint menu (needed for keepOpenOnClick to show updated checkboxes)
    const freshNode = nodes[node.id] || node;
    const blueprintMenuItem = buildBlueprintSubmenu({
      node: freshNode,
      getNodes: () => store.getState().nodes,
      getAncestorRegistry: () => store.getState().ancestorRegistry,
      contextDeclarations,
      onAddToBlueprint: () => actions.addToBlueprint(node.id),
      onAddToBlueprintWithDescendants: () => actions.addToBlueprint(node.id, true),
      onRemoveFromBlueprint: () => actions.removeFromBlueprint(node.id, true),
      onDeclareAsContext: handleDeclareAsContext,
      onRemoveContextDeclaration: () => actions.removeContextDeclaration(node.id),
      onSetAppliedContext: handleSetAppliedContext,
    });

    const isHyperlink = node.metadata.isHyperlink === true;

    // Base menu items - hyperlinks have limited options
    const baseMenuItems: ContextMenuItem[] = [
      // Execute/Collaborate hidden for hyperlinks - they're just references
      ...(!isHyperlink ? [{
        label: 'Execute',
        submenu: executeSubmenu,
      }] : []),
      ...(!isHyperlink ? [{
        label: 'Collaborate',
        submenu: collaborateSubmenu,
        disabled: collaborateDisabled,
      }] : []),
      ...(isNodeBeingCollaborated ? [{
        label: 'Cancel collaboration',
        onClick: handleCancel,
        disabled: false,
      }] : []),
      // Blueprint menu hidden for hyperlinks
      ...(!isHyperlink && blueprintMenuItem ? [blueprintMenuItem] : []),
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Select',
            onClick: () => actions.toggleNodeSelection(node.id),
          },
          {
            label: 'Copy',
            onClick: () => actions.copyNodes(),
          },
          // Copy as Hyperlink - only for non-hyperlink nodes
          ...(!isHyperlink ? [{
            label: 'Copy as Hyperlink',
            onClick: () => actions.copyAsHyperlink(),
          }] : []),
          {
            label: 'Cut',
            onClick: () => actions.cutNodes(),
          },
          // Paste hidden for hyperlinks - no children allowed
          ...(!isHyperlink ? [{
            label: 'Paste',
            onClick: () => actions.pasteNodes(),
          }] : []),
          {
            label: 'Delete',
            onClick: handleDelete,
            danger: true,
          },
        ],
      },
      {
        label: 'Copy to Clipboard',
        onClick: handleCopyToClipboard,
        disabled: false,
      },
      // Zoom hidden for hyperlinks - they're single-line references
      ...(!isZoomTab && !isHyperlink ? [{
        label: 'Zoom',
        onClick: handleZoom,
        disabled: false,
      }] : []),
    ];

    return [...pluginItems, ...baseMenuItems];
  }, [node, store, enabledPlugins, showTerminal, handleCancel, openIconPicker, activeFile, isZoomTab, openZoomTab]);

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
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

    // Build menu items lazily when menu is opened
    const items = await buildMenuItems();
    setMenuItems(items);
  }, [node.id, store, isFeedbackTree, buildMenuItems]);

  const handleDelete = useCallback(() => {
    const { actions } = store.getState();
    const deleted = actions.deleteNode(node.id);
    if (!deleted) {
      const confirmed = window.confirm(
        'This node has children. Deleting it will also delete all its children. Are you sure?'
      );
      if (confirmed) {
        actions.deleteNode(node.id, true);
      }
    }
  }, [node.id, store]);

  return {
    contextMenu,
    contextMenuItems: menuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu: () => setContextMenu(null),
  };
}
