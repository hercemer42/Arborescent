import { TreeNode } from '../../../../shared/types';
import { exportNodeAsMarkdown, exportMultipleNodesAsMarkdown, parseMarkdown } from '../../../utils/markdown';
import { findPreviousNode, cloneNodesWithNewIds, sortNodeIdsByTreeOrder } from '../../../utils/nodeHelpers';
import { CutMultipleNodesCommand } from '../commands/CutMultipleNodesCommand';
import { DeleteMultipleNodesCommand } from '../commands/DeleteMultipleNodesCommand';
import { PasteNodesCommand } from '../commands/PasteNodesCommand';
import { Command } from '../commands/Command';
import { logger } from '../../../services/logger';
import { writeToClipboard, readFromClipboard } from '../../../services/clipboardService';
import { VisualEffectsActions } from './visualEffectsActions';
import { notifyError } from '../../../services/notification';
import { useClipboardCacheStore } from '../../clipboard/clipboardCacheStore';
import { useToastStore } from '../../toast/toastStore';

export interface ClipboardActions {
  /**
   * Cut selected nodes to clipboard.
   * Returns 'cut' if nodes were cut, 'no-selection' if nothing selected.
   */
  cutNodes: () => Promise<'cut' | 'no-selection'>;

  /**
   * Copy selected nodes to clipboard.
   * Returns 'copied' if nodes were copied, 'no-selection' if nothing selected.
   */
  copyNodes: () => Promise<'copied' | 'no-selection'>;

  /**
   * Paste nodes from clipboard as children of active node (or root).
   * Returns 'pasted' if nodes were pasted, 'no-content' if clipboard had no valid nodes.
   */
  pasteNodes: () => Promise<'pasted' | 'no-content'>;

  /**
   * Delete selected nodes (multi-selection or single active node).
   * Returns 'deleted' if nodes were deleted, 'no-selection' if nothing selected.
   */
  deleteSelectedNodes: () => 'deleted' | 'no-selection';
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null;
  multiSelectedNodeIds: Set<string>;
};

type StoreActions = {
  executeCommand: (command: Command) => void;
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
  autoSave?: () => void;
};

type StoreSetter = (partial: Partial<StoreState>) => void;

/**
 * Check if any nodes in selection have isRoot metadata.
 * Returns true if root node is in the selection (indicates a bug).
 */
function selectionContainsRoot(nodeIds: string[], nodes: Record<string, TreeNode>): boolean {
  return nodeIds.some((id) => nodes[id]?.metadata.isRoot === true);
}

/**
 * Filter a selection to only include "root level" nodes.
 * Removes any nodes whose ancestor is also in the selection.
 * This prevents duplicates when exporting/cloning hierarchies.
 */
function getRootLevelSelections(
  nodeIds: string[],
  ancestorRegistry: Record<string, string[]>
): string[] {
  const selectionSet = new Set(nodeIds);
  return nodeIds.filter((nodeId) => {
    const ancestors = ancestorRegistry[nodeId] || [];
    // Keep this node only if none of its ancestors are in the selection
    return !ancestors.some((ancestorId) => selectionSet.has(ancestorId));
  });
}

type SelectionResult =
  | { type: 'multi'; nodeIds: string[] }
  | { type: 'single'; nodeId: string }
  | { type: 'none' };

/**
 * Get the current selection - either multi-selected nodes or single active node.
 * For multi-selection, filters to root-level nodes only (removes descendants)
 * and sorts by tree order.
 */
function getSelection(state: StoreState): SelectionResult {
  const { activeNodeId, nodes, multiSelectedNodeIds, ancestorRegistry, rootNodeId } = state;

  if (multiSelectedNodeIds.size > 0) {
    // Filter to only root-level selections (exclude nodes whose ancestors are also selected)
    const rootLevelIds = getRootLevelSelections(
      Array.from(multiSelectedNodeIds),
      ancestorRegistry
    );
    // Sort by tree order (not selection order)
    const sortedIds = sortNodeIdsByTreeOrder(rootLevelIds, rootNodeId, nodes, ancestorRegistry);
    return { type: 'multi', nodeIds: sortedIds };
  }

  if (activeNodeId && nodes[activeNodeId]) {
    return { type: 'single', nodeId: activeNodeId };
  }

  return { type: 'none' };
}

/**
 * Export nodes as markdown - handles both single and multi-selection.
 */
function exportSelectionAsMarkdown(
  selection: SelectionResult,
  nodes: Record<string, TreeNode>
): string | null {
  if (selection.type === 'multi') {
    return exportMultipleNodesAsMarkdown(selection.nodeIds, nodes);
  }
  if (selection.type === 'single') {
    const node = nodes[selection.nodeId];
    return node ? exportNodeAsMarkdown(node, nodes) : null;
  }
  return null;
}


/**
 * Flash one or more nodes with visual feedback.
 */
function flashNodes(
  nodeIds: string | string[],
  visualEffects: VisualEffectsActions
): void {
  visualEffects.flashNode(nodeIds, 'light');
}

/**
 * Strip blueprint flags from nodes if pasting into a non-blueprint parent.
 * Returns true if any flags were stripped.
 */
function stripBlueprintFlagsIfNeeded(
  nodesMap: Record<string, TreeNode>,
  targetParentId: string,
  existingNodes: Record<string, TreeNode>
): boolean {
  const targetParent = existingNodes[targetParentId];
  const targetIsBlueprint = targetParent?.metadata.isBlueprint === true;

  if (targetIsBlueprint) {
    return false;
  }

  let strippedAny = false;
  for (const nodeId of Object.keys(nodesMap)) {
    const node = nodesMap[nodeId];
    if (node.metadata.isBlueprint) {
      delete node.metadata.isBlueprint;
      delete node.metadata.blueprintIcon;
      delete node.metadata.blueprintColor;
      strippedAny = true;
    }
  }

  return strippedAny;
}

/**
 * Get all node IDs from a selection (as array).
 */
function getNodeIdsFromSelection(selection: SelectionResult): string[] {
  if (selection.type === 'multi') return selection.nodeIds;
  if (selection.type === 'single') return [selection.nodeId];
  return [];
}

export const createClipboardActions = (
  get: () => StoreState,
  set: StoreSetter,
  getActions: () => StoreActions,
  visualEffects: VisualEffectsActions,
  triggerAutosave?: () => void
): ClipboardActions => {
  /**
   * Execute deletion for multi-selection using a command.
   */
  function executeMultiNodeDelete(
    nodeIds: string[],
    CommandClass: typeof CutMultipleNodesCommand | typeof DeleteMultipleNodesCommand
  ): void {
    const actions = getActions();
    visualEffects.startDeleteAnimation(nodeIds, () => {
      const currentState = get();
      const command = new CommandClass(
        nodeIds,
        () => ({
          nodes: currentState.nodes,
          rootNodeId: currentState.rootNodeId,
          ancestorRegistry: currentState.ancestorRegistry,
        }),
        (partial) => set(partial as Partial<StoreState>),
        findPreviousNode,
        triggerAutosave
      );
      actions.executeCommand(command);
    });
  }

  /**
   * Execute deletion for a single node.
   */
  function executeSingleNodeDelete(nodeId: string): void {
    const actions = getActions();
    visualEffects.startDeleteAnimation(nodeId, () => {
      actions.deleteNode(nodeId, true);
    });
  }

  async function cutNodes(): Promise<'cut' | 'no-selection'> {
    const state = get();
    const selection = getSelection(state);

    if (selection.type === 'none') return 'no-selection';

    // Check for root node in selection (should never happen, indicates a bug)
    const nodeIds = getNodeIdsFromSelection(selection);
    if (selectionContainsRoot(nodeIds, state.nodes)) {
      logger.error('Attempted to cut root node - this indicates a bug', undefined, 'ClipboardActions');
      notifyError('Cannot modify root node', undefined, 'ClipboardActions:cut');
      return 'no-selection';
    }

    const markdown = exportSelectionAsMarkdown(selection, state.nodes);
    if (!markdown) return 'no-selection';

    const success = await writeToClipboard(markdown, 'ClipboardActions:cut');
    if (!success) return 'no-selection';

    // Cache node IDs for internal paste (nodes looked up at paste time)
    useClipboardCacheStore.getState().setCache(nodeIds);

    if (selection.type === 'multi') {
      executeMultiNodeDelete(selection.nodeIds, CutMultipleNodesCommand);
    } else {
      executeSingleNodeDelete(selection.nodeId);
    }

    return 'cut';
  }

  async function copyNodes(): Promise<'copied' | 'no-selection'> {
    const state = get();
    const selection = getSelection(state);

    if (selection.type === 'none') return 'no-selection';

    const markdown = exportSelectionAsMarkdown(selection, state.nodes);
    if (!markdown) return 'no-selection';

    const success = await writeToClipboard(markdown, 'ClipboardActions:copy');
    if (!success) return 'no-selection';

    // Cache node IDs for internal paste (nodes looked up at paste time)
    const nodeIds = getNodeIdsFromSelection(selection);
    useClipboardCacheStore.getState().setCache(nodeIds);

    flashNodes(nodeIds, visualEffects);

    return 'copied';
  }

  async function pasteNodes(): Promise<'pasted' | 'no-content'> {
    const state = get();
    const actions = getActions();
    const targetParentId = state.activeNodeId || state.rootNodeId;
    if (!targetParentId) return 'no-content';

    // Check if we have cached node IDs from internal copy/cut
    const cache = useClipboardCacheStore.getState().getCache();
    if (cache && cache.rootNodeIds.length > 0) {
      // Clone from current nodes with new IDs (preserves full metadata)
      const { newRootNodes, newNodesMap } = cloneNodesWithNewIds(
        cache.rootNodeIds,
        state.nodes
      );

      // If cached nodes still exist, use them
      if (newRootNodes.length > 0) {
        // Strip blueprint flags if pasting into non-blueprint parent
        const strippedBlueprint = stripBlueprintFlagsIfNeeded(newNodesMap, targetParentId, state.nodes);
        if (strippedBlueprint) {
          useToastStore.getState().addToast('Blueprint status removed from pasted nodes', 'info');
        }

        const command = new PasteNodesCommand(
          newRootNodes,
          newNodesMap,
          targetParentId,
          () => {
            const currentState = get();
            return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId, ancestorRegistry: currentState.ancestorRegistry };
          },
          (partial) => set(partial as Partial<StoreState>),
          triggerAutosave,
          true // skipPrepare - nodes already have unique IDs from cloneNodesWithNewIds
        );

        actions.executeCommand(command);
        flashNodes(command.getPastedRootIds(), visualEffects);

        logger.info(`Pasted ${newRootNodes.length} node(s) from internal cache`, 'ClipboardActions');
        return 'pasted';
      }

      // Cached nodes no longer exist, clear cache and fall through to clipboard
      useClipboardCacheStore.getState().clearCache();
    }

    // Fall back to parsing system clipboard markdown (external paste)
    const clipboardText = await readFromClipboard('ClipboardActions:paste');
    if (!clipboardText) return 'no-content';

    const parsed = parseMarkdown(clipboardText);
    if (parsed.rootNodes.length === 0) return 'no-content';

    // Strip blueprint flags if pasting into non-blueprint parent
    const strippedBlueprint = stripBlueprintFlagsIfNeeded(parsed.allNodes, targetParentId, state.nodes);
    if (strippedBlueprint) {
      useToastStore.getState().addToast('Blueprint status removed from pasted nodes', 'info');
    }

    const command = new PasteNodesCommand(
      parsed.rootNodes,
      parsed.allNodes,
      targetParentId,
      () => {
        const currentState = get();
        return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId, ancestorRegistry: currentState.ancestorRegistry };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave
    );

    actions.executeCommand(command);
    flashNodes(command.getPastedRootIds(), visualEffects);

    logger.info(`Pasted ${parsed.rootNodes.length} node(s) from clipboard markdown`, 'ClipboardActions');
    return 'pasted';
  }

  function deleteSelectedNodes(): 'deleted' | 'no-selection' {
    const state = get();
    const selection = getSelection(state);

    if (selection.type === 'none') return 'no-selection';

    // Check for root node in selection (should never happen, indicates a bug)
    const nodeIds = getNodeIdsFromSelection(selection);
    if (selectionContainsRoot(nodeIds, state.nodes)) {
      logger.error('Attempted to delete root node - this indicates a bug', undefined, 'ClipboardActions');
      notifyError('Cannot modify root node', undefined, 'ClipboardActions:delete');
      return 'no-selection';
    }

    logger.info(`Deleted ${nodeIds.length} node(s)`, 'ClipboardActions');

    if (selection.type === 'multi') {
      executeMultiNodeDelete(selection.nodeIds, DeleteMultipleNodesCommand);
    } else {
      executeSingleNodeDelete(selection.nodeId);
    }

    return 'deleted';
  }

  return {
    cutNodes,
    copyNodes,
    pasteNodes,
    deleteSelectedNodes,
  };
};
