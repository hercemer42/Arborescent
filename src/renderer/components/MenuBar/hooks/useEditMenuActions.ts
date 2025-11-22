import { useCallback } from 'react';
import { useActiveTreeStore, useActiveTreeActions } from './useActiveTreeStore';
import { exportNodeAsMarkdown, parseMarkdown } from '../../../utils/markdown';
import { logger } from '../../../services/logger';
import { PasteNodesCommand } from '../../../store/tree/commands/PasteNodesCommand';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

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
  const treeState = useActiveTreeStore();
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
    if (!treeState || !actions) return;

    // If text is selected in contenteditable, let browser handle it
    if (hasTextSelection()) {
      document.execCommand('cut');
      return;
    }

    const { activeNodeId, nodes } = treeState;

    // No text selected - cut the active node
    if (!activeNodeId) return;

    const node = nodes[activeNodeId];
    if (!node) return;

    // Export node as markdown and copy to clipboard
    const markdown = exportNodeAsMarkdown(node, nodes);
    try {
      await navigator.clipboard.writeText(markdown);
      logger.info(`Cut node to clipboard: ${activeNodeId}`, 'EditMenu');

      // Start delete animation - deletion will happen when animation completes
      actions.startDeleteAnimation(activeNodeId, () => {
        actions.deleteNode(activeNodeId, true);
      });
    } catch (error) {
      logger.error('Failed to cut node', error as Error, 'EditMenu');
    }
  }, [treeState, actions]);

  const handleCopy = useCallback(async () => {
    if (!treeState || !actions) return;

    // If text is selected in contenteditable, let browser handle it
    if (hasTextSelection()) {
      document.execCommand('copy');
      return;
    }

    const { activeNodeId, nodes } = treeState;

    // No text selected - copy the active node
    if (!activeNodeId) return;

    const node = nodes[activeNodeId];
    if (!node) return;

    // Export node as markdown and copy to clipboard
    const markdown = exportNodeAsMarkdown(node, nodes);
    try {
      await navigator.clipboard.writeText(markdown);
      logger.info(`Copied node to clipboard: ${activeNodeId}`, 'EditMenu');

      // Flash the node to indicate successful copy
      actions.flashNode(activeNodeId, 'light');
    } catch (error) {
      logger.error('Failed to copy node', error as Error, 'EditMenu');
    }
  }, [treeState, actions]);

  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();

      // Check if clipboard contains markdown-formatted nodes
      const parsed = parseMarkdown(clipboardText);

      // If no valid nodes parsed, fall through to default paste behavior
      if (parsed.rootNodes.length === 0) {
        if (isContentEditableFocused()) {
          document.execCommand('paste');
        }
        return;
      }

      // Get the active file and store to execute the command
      const activeFilePath = useFilesStore.getState().activeFilePath;
      if (!activeFilePath) return;

      const store = storeManager.getStoreForFile(activeFilePath);
      const state = store.getState();
      const { activeNodeId, rootNodeId, actions } = state;

      // Determine parent node for pasting
      const targetParentId = activeNodeId || rootNodeId;
      if (!targetParentId) return;

      // Create and execute the paste command
      const command = new PasteNodesCommand(
        parsed.rootNodes,
        parsed.allNodes,
        targetParentId,
        () => {
          const currentState = store.getState();
          return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId };
        },
        (partial) => store.setState(partial),
        () => actions.autoSave?.()
      );

      actions.executeCommand(command);

      // Flash the pasted nodes
      const pastedIds = command.getPastedRootIds();
      for (const nodeId of pastedIds) {
        actions.flashNode(nodeId, 'light');
      }

      logger.info(`Pasted ${parsed.rootNodes.length} node(s) from clipboard`, 'EditMenu');
    } catch (error) {
      logger.error('Failed to paste', error as Error, 'EditMenu');
    }
  }, []);

  const handleDelete = useCallback(() => {
    if (!treeState || !actions) return;

    const { activeNodeId, nodes } = treeState;

    if (!activeNodeId) return;

    const node = nodes[activeNodeId];
    if (!node) return;

    // Start delete animation - deletion will happen when animation completes
    actions.startDeleteAnimation(activeNodeId, () => {
      // Pass confirmed=true to skip confirmation for nodes with children
      // The menu action is intentional, so we don't need to confirm
      actions.deleteNode(activeNodeId, true);
    });

    logger.info(`Deleted node: ${activeNodeId}`, 'EditMenu');
  }, [treeState, actions]);

  return {
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
  };
}
