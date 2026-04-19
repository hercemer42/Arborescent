import { useState, useCallback, useRef, useEffect } from 'react';
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
import { buildWorkflowSubmenu, buildWorkflowExecutionItems, buildWorkflowNavigationItems } from './useWorkflowSubmenu';
import { buildSetContextSubmenu } from './useSetContextSubmenu';
import { buildEditSubmenu, prependSpellItems } from './menuBuilders/editSubmenu';
import { logger } from '../../../services/logger';
import { useStepConfigDialogStore } from '../../../store/stepConfigDialog/stepConfigDialogStore';
import { getWorkflowStepPosition } from '../../../utils/workflowHelpers';
import { useToastStore } from '../../../store/toast/toastStore';
import { getAppliedContextIdWithInheritance, resolveContextMode, resolveSendContextName } from '../../../utils/nodeHelpers';
import { ContextMode } from '../../../store/tree/treeStore';
import { getPositionFromPoint } from '../../../utils/position';
import { useCustomizeDialogStore } from '../../../store/customizeDialog/customizeDialogStore';
import { useSpellcheck } from './useSpellcheck';
import { waitForSpellcheckUpdate, useSpellcheckStore } from '../../../store/spellcheck/spellcheckStore';

export function useNodeContextMenu(node: TreeNode) {
  const treeType = useStore((state) => state.treeType);
  const isFeedbackTree = treeType === 'feedback';
  const store = useActiveTreeStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuItems, setMenuItems] = useState<ContextMenuItem[]>([]);
  const menuOpenRef = useRef(false);
  const buildMenuItemsRef = useRef<() => Promise<ContextMenuItem[]>>(async () => []);

  const { captureWordAtPoint, buildSpellMenuItems } = useSpellcheck();
  const { handleCancel } = useFeedbackActions();
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const openCustomizeDialog = useCustomizeDialogStore((state) => state.open);
  const activeFile = useFilesStore((state) => state.getActiveFile());
  const openZoomTab = useFilesStore((state) => state.openZoomTab);
  const isZoomTab = !!activeFile?.zoomSource;

  const buildMenuItems = useCallback(async () => {
    const state = store.getState();
    const { nodes, ancestorRegistry, collaboratingNodeId, contextDeclarations, actions } = state;

    const spellItems = buildSpellMenuItems();

    const isNodeBeingCollaborated = collaboratingNodeId === node.id;

    const handleSendInTerminal = async (mode: ContextMode) => {
      const terminalId = await useTerminalStore.getState().openTerminal();
      if (!terminalId) {
        logger.error('Failed to create terminal', new Error('No terminal available'), 'Context Menu');
        return;
      }
      try {
        showTerminal();
        await actions.collaborateInTerminal(node.id, terminalId, mode);
      } catch (error) {
        logger.error('Failed to send to terminal', error as Error, 'Context Menu');
      }
    };

    const handleSendInBrowser = async (mode: ContextMode) => {
      try {
        await actions.collaborate(node.id, mode);
      } catch (error) {
        logger.error('Failed to send to browser', error as Error, 'Context Menu');
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

    const handleSetAppliedContext = async (contextId: string | null) => {
      actions.setAppliedContext(node.id, contextId);
      const newItems = await buildMenuItemsRef.current();
      setMenuItems(newItems);
    };

    const freshNode = nodes[node.id] || node;

    const handleDeclareAsContext = () => {
      const existingIcon = freshNode.metadata.blueprintIcon as string | undefined;
      const existingColor = freshNode.metadata.blueprintColor as string | undefined;
      const existingMode = (freshNode.metadata.contextMode as 'collaborate' | 'execute') || 'collaborate';
      openCustomizeDialog(existingIcon || null, (selection) => {
        actions.declareAsContext(node.id, selection.icon, selection.color, selection.mode);
      }, existingColor || null, { showModeToggle: true, selectedMode: existingMode });
    };

    const appliedContextId = getAppliedContextIdWithInheritance(node.id, nodes, ancestorRegistry);
    const sendMode: ContextMode = resolveContextMode(appliedContextId, nodes, contextDeclarations);

    const handleSend = async () => {
      const activeContent = usePanelStore.getState().activeContent;

      if (activeContent === 'terminal') {
        await handleSendInTerminal(sendMode);
      } else if (activeContent === 'browser') {
        await handleSendInBrowser(sendMode);
      } else if (activeContent === 'feedback') {
        const hasTerminal = useTerminalStore.getState().terminals.length > 0;
        if (hasTerminal) {
          await handleSendInTerminal(sendMode);
        } else {
          useToastStore.getState().addToast('Open a terminal or browser first', 'warning');
        }
      } else {
        useToastStore.getState().addToast('Open a terminal or browser first', 'warning');
      }
    };

    const sendContextName = resolveSendContextName(appliedContextId, nodes);

    const setContextSubmenuItems = buildSetContextSubmenu({
      node: freshNode,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onSetAppliedContext: handleSetAppliedContext,
    });

    const handleSetContextMode = async (mode: ContextMode) => {
      const icon = freshNode.metadata.blueprintIcon as string | undefined;
      const color = freshNode.metadata.blueprintColor as string | undefined;
      actions.declareAsContext(node.id, icon, color, mode);
      const newItems = await buildMenuItemsRef.current();
      setMenuItems(newItems);
    };

    const blueprintMenuItem = buildBlueprintSubmenu({
      node: freshNode,
      getNodes: () => store.getState().nodes,
      getAncestorRegistry: () => store.getState().ancestorRegistry,
      onAddToBlueprint: () => actions.addToBlueprint(node.id),
      onAddToBlueprintWithDescendants: () => actions.addToBlueprint(node.id, true),
      onRemoveFromBlueprint: () => actions.removeFromBlueprint(node.id, true),
      onDeclareAsContext: handleDeclareAsContext,
      onRemoveContextDeclaration: () => actions.removeContextDeclaration(node.id),
      onSetContextMode: handleSetContextMode,
      onDeclareAsWorkflow: () => actions.declareAsWorkflow(node.id),
      onRemoveFromWorkflow: () => actions.removeFromWorkflow(node.id),
    });

    const statusMenuItem = buildStatusSubmenu({
      node: freshNode,
      onMarkAllAsComplete: () => actions.markAllAsComplete(node.id),
      onMarkAllAsIncomplete: () => actions.markAllAsIncomplete(node.id),
    });

    const getTerminalId = () => useTerminalStore.getState().openTerminal();
    const workflowMenuItem = buildWorkflowSubmenu({
      node: freshNode,
      nodes,
      ancestorRegistry,
      onRemoveFromWorkflow: () => actions.removeFromWorkflow(node.id),
      onConfigureStep: () => useStepConfigDialogStore.getState().open(node.id),
    });

    const autoStartAfterMove = (nodeId: string) => {
      const freshState = store.getState();
      const position = getWorkflowStepPosition(nodeId, freshState.nodes, freshState.ancestorRegistry);
      if (!position) return;
      const stepNode = freshState.nodes[position.currentStepId];
      const stepType = stepNode?.metadata.stepType as string | undefined;
      if (stepType === 'autonomous' || stepType === 'checkpoint') {
        void getTerminalId().then(tid => actions.startWorkflow(nodeId, tid));
      }
    };

    const workflowNavigationItems = buildWorkflowNavigationItems({
      node: freshNode,
      nodes,
      ancestorRegistry,
      collaboratingNodeId,
      workflowExecutionStates: state.workflowExecutionStates,
      onMoveToNextStep: () => { actions.moveToNextStep(node.id); autoStartAfterMove(node.id); },
      onMoveToPreviousStep: () => { actions.moveToPreviousStep(node.id); autoStartAfterMove(node.id); },
    });

    const workflowExecutionItems = buildWorkflowExecutionItems({
      node: freshNode,
      nodes,
      ancestorRegistry,
      workflowExecutionStates: state.workflowExecutionStates,
      onStartWorkflow: () => getTerminalId().then(tid => actions.startWorkflow(node.id, tid)),
      onStopWorkflow: () => actions.stopWorkflow(node.id),
      onContinueWorkflow: () => getTerminalId().then(tid => actions.continueWorkflow(node.id, tid)),
    });

    const isHyperlink = freshNode.metadata.isHyperlink === true;
    const isExternalLink = freshNode.metadata.isExternalLink === true;
    const externalUrl = freshNode.metadata.externalUrl as string | undefined;

    const baseMenuItems: ContextMenuItem[] = [
      ...workflowExecutionItems,
      ...workflowNavigationItems,
      ...(isExternalLink && externalUrl ? [{
        label: 'Open in external browser',
        onClick: () => {
          window.electron.openExternal(externalUrl).catch(() => {
            logger.error('Failed to open external link', new Error('openExternal failed'), 'Context Menu');
          });
        },
      }] : []),
      ...(!isHyperlink && !isExternalLink ? [{
        label: 'Send',
        tooltip: sendContextName
          ? `${sendMode === 'execute' ? 'Execute' : 'Collaborate'}: ${sendContextName}`
          : sendMode === 'execute' ? 'Execute' : 'Collaborate',
        onClick: handleSend,
      }] : []),
      ...(isNodeBeingCollaborated ? [{
        label: 'Cancel collaboration',
        onClick: handleCancel,
        disabled: false,
      }] : []),
      ...(!isHyperlink && !isExternalLink && setContextSubmenuItems ? [{
        label: 'Apply context',
        submenu: setContextSubmenuItems,
      }] : []),
      ...(!isHyperlink && !isExternalLink && blueprintMenuItem ? [blueprintMenuItem] : []),
      ...(!isHyperlink && !isExternalLink && workflowMenuItem ? [workflowMenuItem] : []),
      buildEditSubmenu({
        onSelect: () => actions.toggleNodeSelection(node.id),
        onCopy: () => actions.copyNodes(),
        onCopyAsHyperlink: isHyperlink ? undefined : () => actions.copyAsHyperlink(),
        onCut: () => actions.cutNodes(),
        onPaste: isHyperlink ? undefined : () => actions.pasteNodes(),
        onDelete: handleDelete,
      }),
      ...(!isExternalLink && statusMenuItem ? [statusMenuItem] : []),
      ...(!isZoomTab && !isHyperlink && !isExternalLink ? [{
        label: 'Zoom',
        onClick: handleZoom,
        disabled: false,
      }] : []),
    ];

    return prependSpellItems(baseMenuItems, spellItems);
  }, [node, store, showTerminal, handleCancel, openCustomizeDialog, activeFile, isZoomTab, openZoomTab, buildSpellMenuItems]);
  useEffect(() => {
    buildMenuItemsRef.current = buildMenuItems;
  }, [buildMenuItems]);

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

    const editSubmenu = buildEditSubmenu({
      onSelect: () => actions.toggleNodeSelection(node.id),
      onCopy: () => actions.copyNodes(),
      onCut: () => actions.cutNodes(),
      onPaste: () => actions.pasteNodes(),
      onDelete: handleDelete,
    });

    return prependSpellItems([editSubmenu], spellItems);
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
