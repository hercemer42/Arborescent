import { useCallback } from 'react';
import { useActiveTreeActions } from './useActiveTreeStore';
import { logger } from '../../../services/logger';

/**
 * Check if there's text selected in an active contenteditable element
 */
function hasTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  // Check if selection is within a contenteditable
  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;

  const element = anchorNode.nodeType === Node.TEXT_NODE
    ? anchorNode.parentElement
    : anchorNode as Element;

  return element?.closest('[contenteditable="true"]') !== null;
}

/**
 * Check if a contenteditable element is currently focused
 */
function isContentEditableFocused(): boolean {
  const activeElement = document.activeElement;
  return activeElement?.getAttribute('contenteditable') === 'true';
}

interface EditMenuActions {
  handleUndo: () => void;
  handleRedo: () => void;
  handleCut: () => Promise<void>;
  handleCopy: () => Promise<void>;
  handlePaste: () => Promise<void>;
  handleDelete: () => void;
}

/**
 * Hook providing action handlers for Edit menu items.
 * Handles the logic for determining whether to use default browser behavior
 * or custom tree operations.
 */
export function useEditMenuActions(): EditMenuActions {
  const actions = useActiveTreeActions();

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

    // If text is selected in contenteditable, let browser handle it
    if (hasTextSelection()) {
      document.execCommand('cut');
      return;
    }

    await actions.cutNodes();
  }, [actions]);

  const handleCopy = useCallback(async () => {
    if (!actions) return;

    // If text is selected in contenteditable, let browser handle it
    if (hasTextSelection()) {
      document.execCommand('copy');
      return;
    }

    await actions.copyNodes();
  }, [actions]);

  const handlePaste = useCallback(async () => {
    if (!actions) return;

    const result = await actions.pasteNodes();

    // If no valid markdown nodes, fall through to default paste behavior
    if (result === 'no-content' && isContentEditableFocused()) {
      document.execCommand('paste');
    }
  }, [actions]);

  const handleDelete = useCallback(() => {
    if (!actions) return;
    actions.deleteSelectedNodes();
  }, [actions]);

  return {
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
  };
}
