import { useCallback } from 'react';
import { useActiveTreeActions, useActiveTreeStore } from './useActiveTreeStore';
import { logger } from '../../../services/logger';
import {
  getSelectionNodeId,
  hasTextSelection,
  isContentEditableFocused,
  isSelectionInContentEditable,
  isSelectionInRichContent,
  selectionSpansSingleNode,
} from '../../../utils/selectionUtils';
import { copySelectionText, cutSelectionFromNodeContent } from '../../../services/partialTextClipboard';

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
  const activeNodeId = treeState?.activeNodeId ?? null;

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
      if (!selectionSpansSingleNode()) {
        await actions.cutNodes();
        return;
      }
      if (isSelectionInContentEditable()) {
        document.execCommand('cut');
        return;
      }

      const selectionText = window.getSelection()?.toString() ?? '';
      if (!selectionText) return;

      if (isSelectionInRichContent()) {
        await copySelectionText(selectionText);
        return;
      }

      const nodeId = getSelectionNodeId();
      if (!nodeId) {
        await copySelectionText(selectionText);
        return;
      }

      const node = treeState?.nodes[nodeId];
      if (!node) {
        await copySelectionText(selectionText);
        return;
      }

      await cutSelectionFromNodeContent(selectionText, node.content, (newContent) => {
        actions.updateContent(nodeId, newContent);
      });
      return;
    }

    await actions.cutNodes();
  }, [actions, treeState]);

  const handleCopy = useCallback(async () => {
    if (!actions) return;

    if (hasTextSelection()) {
      if (!selectionSpansSingleNode()) {
        await actions.copyNodes();
        return;
      }
      if (isSelectionInContentEditable()) {
        document.execCommand('copy');
        return;
      }

      const selectionText = window.getSelection()?.toString() ?? '';
      if (selectionText) {
        await copySelectionText(selectionText);
      }
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
    if (!actions || !activeNodeId) return;
    actions.toggleStatus(activeNodeId);
  }, [actions, activeNodeId]);

  const handleIndent = useCallback(() => {
    if (!actions || !activeNodeId) return;
    actions.indentNode(activeNodeId);
  }, [actions, activeNodeId]);

  const handleOutdent = useCallback(() => {
    if (!actions || !activeNodeId) return;
    actions.outdentNode(activeNodeId);
  }, [actions, activeNodeId]);

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
