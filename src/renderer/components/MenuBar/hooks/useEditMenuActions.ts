import { useCallback } from 'react';
import { useActiveTreeActions, useActiveTreeStore } from './useActiveTreeStore';
import { logger } from '../../../services/logger';
import { hasTextSelection, isContentEditableFocused } from '../../../utils/selectionUtils';

interface EditMenuActions {
  handleUndo: () => void;
  handleRedo: () => void;
  handleCut: () => Promise<void>;
  handleCopy: () => Promise<void>;
  handlePaste: () => Promise<void>;
  handleDelete: () => void;
  handleToggleStatus: () => void;
  handleIndent: () => void;
  handleOutdent: () => void;
  handleSelectAll: () => void;
}

export function useEditMenuActions(): EditMenuActions {
  const actions = useActiveTreeActions();
  const treeState = useActiveTreeStore();

  const handleUndo = useCallback(() => {
    if (!actions) return;
    actions.undo();
    logger.info('Undo executed from menu', 'EditMenu');
  }, [actions]);

  const handleRedo = useCallback(() => {
    if (!actions) return;
    actions.redo();
    logger.info('Redo executed from menu', 'EditMenu');
  }, [actions]);

  const handleCut = useCallback(async () => {
    if (!actions) return;

    if (hasTextSelection()) {
      document.execCommand('cut');
      return;
    }

    await actions.cutNodes();
  }, [actions]);

  const handleCopy = useCallback(async () => {
    if (!actions) return;

    if (hasTextSelection()) {
      document.execCommand('copy');
      return;
    }

    await actions.copyNodes();
  }, [actions]);

  const handlePaste = useCallback(async () => {
    if (!actions) return;

    const result = await actions.pasteNodes();

    if (result === 'no-content' && isContentEditableFocused()) {
      document.execCommand('paste');
    }
  }, [actions]);

  const handleDelete = useCallback(() => {
    if (!actions) return;
    actions.deleteSelectedNodes();
  }, [actions]);

  const handleToggleStatus = useCallback(() => {
    if (!actions || !treeState?.activeNodeId) return;
    actions.toggleStatus(treeState.activeNodeId);
  }, [actions, treeState?.activeNodeId]);

  const handleIndent = useCallback(() => {
    if (!actions || !treeState?.activeNodeId) return;
    actions.indentNode(treeState.activeNodeId);
  }, [actions, treeState?.activeNodeId]);

  const handleOutdent = useCallback(() => {
    if (!actions || !treeState?.activeNodeId) return;
    actions.outdentNode(treeState.activeNodeId);
  }, [actions, treeState?.activeNodeId]);

  const handleSelectAll = useCallback(() => {
    if (!actions) return;
    actions.selectAllNodes();
  }, [actions]);

  return {
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    handleToggleStatus,
    handleIndent,
    handleOutdent,
    handleSelectAll,
  };
}
