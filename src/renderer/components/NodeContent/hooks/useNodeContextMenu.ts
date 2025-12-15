import { useState, useCallback, useRef, createElement } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useFeedbackActions } from '../../Feedback/hooks/useFeedbackActions';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useFilesStore } from '../../../store/files/filesStore';
import { buildBlueprintSubmenu } from './useBlueprintSubmenu';
import { buildStatusSubmenu } from './useStatusSubmenu';
import { logger } from '../../../services/logger';
import { buildCollaborateSubmenu } from './useCollaborateSubmenu';
import { buildExecuteSubmenu } from './useExecuteSubmenu';
import { getPositionFromPoint } from '../../../utils/position';
import { useIconPickerStore } from '../../../store/iconPicker/iconPickerStore';
import { useSpellcheck } from './useSpellcheck';
import { waitForSpellcheckUpdate, useSpellcheckStore } from '../../../store/spellcheck/spellcheckStore';
import { getKeyForAction } from '../../../data/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../../utils/hotkeyUtils';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { getInheritedContextId } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

interface BuildSetContextSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  onSetAppliedContext: (contextId: string | null) => void;
}

function buildSetContextSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  onSetAppliedContext,
}: BuildSetContextSubmenuParams): ContextMenuItem[] | null {
  if (contextDeclarations.length === 0) {
    return null;
  }

  const explicitContextId = node.metadata.appliedContextId as string | undefined;
  const inheritedContextId = getInheritedContextId(node.id, nodes, ancestorRegistry);

  const submenuItems: ContextMenuItem[] = [];

  const ancestors = ancestorRegistry[node.id] || [];
  const availableContexts = contextDeclarations.filter(
    ctx => ctx.nodeId !== node.id && !ancestors.includes(ctx.nodeId)
  );

  if (availableContexts.length === 0) {
    return null;
  }

  for (const context of availableContexts) {
    const contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;
    const Icon = getIconByName(context.icon);
    const isActive = context.nodeId === explicitContextId;
    const isInherited = context.nodeId === inheritedContextId;
    const isInheritedAndNoExplicit = isInherited && !explicitContextId;

    let label = contextName;
    if (isInherited) {
      label += ' (inherited)';
    }

    submenuItems.push({
      label,
      icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
      radioSelected: isInheritedAndNoExplicit ? true : isActive,
      keepOpenOnClick: true,
      disabled: isInheritedAndNoExplicit,
      onClick: () => {
        if (isInheritedAndNoExplicit) {
          return;
        }
        if (isActive) {
          onSetAppliedContext(null);
        } else if (isInherited) {
          onSetAppliedContext(null);
        } else {
          onSetAppliedContext(context.nodeId);
        }
      },
    });
  }

  if (submenuItems.length > 0) {
    submenuItems.push({ label: '-', onClick: () => {} });
    submenuItems.push({
      label: 'Close',
      onClick: () => {},
    });
  }

  return submenuItems;
}

export function useNodeContextMenu(node: TreeNode) {
  const treeType = useStore((state) => state.treeType);
  const isFeedbackTree = treeType === 'feedback';
  const store = useActiveTreeStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuItems, setMenuItems] = useState<ContextMenuItem[]>([]);
  const menuOpenRef = useRef(false);

  const { captureWordAtPoint, buildSpellMenuItems } = useSpellcheck();
  const { handleCancel } = useFeedbackActions();
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const openIconPicker = useIconPickerStore((state) => state.open);
  const activeFile = useFilesStore((state) => state.getActiveFile());
  const openZoomTab = useFilesStore((state) => state.openZoomTab);
  const isZoomTab = !!activeFile?.zoomSource;

  const buildMenuItems = useCallback(async () => {
    const state = store.getState();
    const { nodes, ancestorRegistry, collaboratingNodeId, contextDeclarations, actions } = state;

    const spellItems = buildSpellMenuItems();

    const isNodeBeingCollaborated = collaboratingNodeId === node.id;
    const collaborateDisabled = !!collaboratingNodeId;

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
          'This branch has children. Deleting it will also delete all its children. Are you sure?'
        );
        if (confirmed) {
          actions.deleteNode(node.id, true);
        }
      }
    };

    const handleZoom = () => {
      if (!activeFile || isZoomTab) return;
      openZoomTab(activeFile.path, node.id, node.content);
    };

    const handleSetActiveContext = async (nodeId: string, contextId: string | null) => {
      actions.setActiveContext(nodeId, contextId);
      const newItems = await buildMenuItems();
      setMenuItems(newItems);
    };

    const handleSetAppliedContext = async (contextId: string | null) => {
      actions.setAppliedContext(node.id, contextId);
      const newItems = await buildMenuItems();
      setMenuItems(newItems);
    };

    const handleDeclareAsContext = () => {
      openIconPicker(null, (selection) => {
        actions.declareAsContext(node.id, selection.icon, selection.color);
      });
    };

    // Get fresh node state from store (important for menu updates after context changes)
    const freshNode = nodes[node.id] || node;

    const executeSubmenu = buildExecuteSubmenu({
      node: freshNode,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onExecuteInBrowser: handleExecuteInBrowser,
      onExecuteInTerminal: handleExecuteInTerminal,
      onSetActiveContext: handleSetActiveContext,
    });

    const collaborateSubmenu = buildCollaborateSubmenu({
      node: freshNode,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onCollaborate: handleCollaborate,
      onCollaborateInTerminal: handleCollaborateInTerminal,
      onSetActiveContext: handleSetActiveContext,
    });

    const setContextSubmenu = buildSetContextSubmenu({
      node: freshNode,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onSetAppliedContext: handleSetAppliedContext,
    });
    const blueprintMenuItem = buildBlueprintSubmenu({
      node: freshNode,
      getNodes: () => store.getState().nodes,
      getAncestorRegistry: () => store.getState().ancestorRegistry,
      onAddToBlueprint: () => actions.addToBlueprint(node.id),
      onAddToBlueprintWithDescendants: () => actions.addToBlueprint(node.id, true),
      onRemoveFromBlueprint: () => actions.removeFromBlueprint(node.id, true),
      onDeclareAsContext: handleDeclareAsContext,
      onRemoveContextDeclaration: () => actions.removeContextDeclaration(node.id),
    });

    const statusMenuItem = buildStatusSubmenu({
      node: freshNode,
      onMarkAllAsComplete: () => actions.markAllAsComplete(node.id),
      onMarkAllAsIncomplete: () => actions.markAllAsIncomplete(node.id),
    });

    const isHyperlink = freshNode.metadata.isHyperlink === true;
    const isExternalLink = freshNode.metadata.isExternalLink === true;
    const externalUrl = freshNode.metadata.externalUrl as string | undefined;

    const baseMenuItems: ContextMenuItem[] = [
      ...(isExternalLink && externalUrl ? [{
        label: 'Open in external browser',
        onClick: () => {
          window.electron.openExternal(externalUrl).catch(() => {
            logger.error('Failed to open external link', new Error('openExternal failed'), 'Context Menu');
          });
        },
      }] : []),
      ...(!isHyperlink && !isExternalLink ? [{
        label: 'Execute',
        submenu: executeSubmenu,
      }] : []),
      ...(!isHyperlink && !isExternalLink ? [{
        label: 'Collaborate',
        submenu: collaborateSubmenu,
        disabled: collaborateDisabled,
      }] : []),
      ...(isNodeBeingCollaborated ? [{
        label: 'Cancel collaboration',
        onClick: handleCancel,
        disabled: false,
      }] : []),
      ...(!isHyperlink && !isExternalLink && setContextSubmenu ? [{
        label: 'Set context',
        submenu: setContextSubmenu,
      }] : []),
      ...(!isHyperlink && !isExternalLink && blueprintMenuItem ? [blueprintMenuItem] : []),
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
            shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'copy') || ''),
          },
          ...(!isHyperlink ? [{
            label: 'Copy as Hyperlink',
            onClick: () => actions.copyAsHyperlink(),
          }] : []),
          {
            label: 'Cut',
            onClick: () => actions.cutNodes(),
            shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'cut') || ''),
          },
          ...(!isHyperlink ? [{
            label: 'Paste',
            onClick: () => actions.pasteNodes(),
            shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'paste') || ''),
          }] : []),
          {
            label: 'Delete',
            onClick: handleDelete,
            danger: true,
            shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'deleteNode') || ''),
          },
        ],
      },
      ...(!isExternalLink && statusMenuItem ? [statusMenuItem] : []),
      ...(!isZoomTab && !isHyperlink && !isExternalLink ? [{
        label: 'Zoom',
        onClick: handleZoom,
        disabled: false,
      }] : []),
    ];

    if (spellItems && spellItems.length > 0) {
      return [
        ...spellItems,
        { separator: true, label: '', onClick: () => {} },
        ...baseMenuItems,
      ];
    }

    return baseMenuItems;
  }, [node, store, showTerminal, handleCancel, openIconPicker, activeFile, isZoomTab, openZoomTab, buildSpellMenuItems]);

  const buildFeedbackMenuItems = useCallback(async () => {
    const { actions } = store.getState();
    const spellItems = buildSpellMenuItems();

    const handleDelete = () => {
      const deleted = actions.deleteNode(node.id);
      if (!deleted) {
        const confirmed = window.confirm(
          'This branch has children. Deleting it will also delete all its children. Are you sure?'
        );
        if (confirmed) {
          actions.deleteNode(node.id, true);
        }
      }
    };

    const editSubmenu: ContextMenuItem = {
      label: 'Edit',
      submenu: [
        {
          label: 'Select',
          onClick: () => actions.toggleNodeSelection(node.id),
        },
        {
          label: 'Copy',
          onClick: () => actions.copyNodes(),
          shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'copy') || ''),
        },
        {
          label: 'Cut',
          onClick: () => actions.cutNodes(),
          shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'cut') || ''),
        },
        {
          label: 'Paste',
          onClick: () => actions.pasteNodes(),
          shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'paste') || ''),
        },
        {
          label: 'Delete',
          onClick: handleDelete,
          danger: true,
          shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'deleteNode') || ''),
        },
      ],
    };

    if (spellItems && spellItems.length > 0) {
      return [
        ...spellItems,
        { separator: true, label: '', onClick: () => {} },
        editSubmenu,
      ];
    }

    return [editSubmenu];
  }, [node, store, buildSpellMenuItems]);

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
    useSpellcheckStore.getState().clear();

    captureWordAtPoint(e.clientX, e.clientY);

    const { actions } = store.getState();
    const wrapperElement = e.currentTarget as HTMLElement;
    const contentEditableElement = wrapperElement.querySelector('.node-text') as HTMLElement;

    if (contentEditableElement) {
      const position = getPositionFromPoint(contentEditableElement, e.clientX, e.clientY);
      actions.clearSelection();
      actions.setRememberedVisualX(null);
      actions.selectNode(node.id, position);
    }

    menuOpenRef.current = true;

    await waitForSpellcheckUpdate();

    const items = isFeedbackTree ? await buildFeedbackMenuItems() : await buildMenuItems();
    setMenuItems(items);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [node.id, store, isFeedbackTree, buildMenuItems, buildFeedbackMenuItems, captureWordAtPoint]);

  const handleDelete = useCallback(() => {
    const { actions } = store.getState();
    const deleted = actions.deleteNode(node.id);
    if (!deleted) {
      const confirmed = window.confirm(
        'This branch has children. Deleting it will also delete all its children. Are you sure?'
      );
      if (confirmed) {
        actions.deleteNode(node.id, true);
      }
    }
  }, [node.id, store]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    menuOpenRef.current = false;
  }, []);

  return {
    contextMenu,
    contextMenuItems: menuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu,
  };
}
