import { TreeNode } from '../../../../shared/types';
import { exportNodeAsMarkdown, exportMultipleNodesAsMarkdown, parseMarkdown } from '../../../utils/markdown';
import {
  cloneNodesWithNewIds,
  sortNodeIdsByTreeOrder,
  findPreviousNode,
  getNodeAndDescendantIds,
  getParentId,
} from '../../../utils/nodeHelpers';
import { DeleteMultipleNodesCommand } from '../commands/DeleteMultipleNodesCommand';
import { PasteNodesCommand } from '../commands/PasteNodesCommand';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';
import { Command } from '../commands/Command';
import { logger } from '../../../services/logger';
import { writeToClipboard, readFromClipboard } from '../../../services/clipboardService';
import { VisualEffectsActions } from './visualEffectsActions';
import { notifyError } from '../../../services/notification';
import { useClipboardCacheStore, ClipboardCacheContent } from '../../clipboard/clipboardCacheStore';
import { useToastStore } from '../../toast/toastStore';
import { AncestorRegistry } from '../../../services/ancestry';

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
   * Returns 'pasted' if nodes were pasted/moved, 'no-content' if clipboard had no valid nodes,
   * 'blocked' if blueprint validation failed, 'cancelled' if pasting cut nodes into same parent.
   */
  pasteNodes: () => Promise<'pasted' | 'no-content' | 'blocked' | 'cancelled'>;

  /**
   * Delete selected nodes (multi-selection or single active node).
   * Returns 'deleted' if nodes were deleted, 'no-selection' if nothing selected.
   */
  deleteSelectedNodes: () => 'deleted' | 'no-selection';
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  multiSelectedNodeIds: Set<string>;
  cutNodeIds: Set<string>;
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
 * Get all node IDs from a selection (as array).
 */
function getNodeIdsFromSelection(selection: SelectionResult): string[] {
  if (selection.type === 'multi') return selection.nodeIds;
  if (selection.type === 'single') return [selection.nodeId];
  return [];
}

/**
 * Check if any nodes in the map have the isBlueprint flag.
 */
function containsBlueprintNodes(nodesMap: Record<string, TreeNode>): boolean {
  return Object.values(nodesMap).some((node) => node.metadata.isBlueprint === true);
}

/**
 * Check if the target parent is a blueprint node.
 */
function isTargetBlueprint(targetParentId: string, nodes: Record<string, TreeNode>): boolean {
  const targetParent = nodes[targetParentId];
  return targetParent?.metadata.isBlueprint === true;
}

type PasteResult = 'pasted' | 'no-content' | 'blocked' | 'cancelled';

interface PasteContext {
  state: StoreState;
  targetParentId: string;
  actions: StoreActions;
  get: () => StoreState;
  set: StoreSetter;
  triggerAutosave?: () => void;
  visualEffects: VisualEffectsActions;
  clearCutState: () => void;
}

/**
 * Handle cut-paste (move operation).
 * Returns null if this handler doesn't apply.
 */
function handleCutPaste(
  cache: ClipboardCacheContent,
  ctx: PasteContext
): PasteResult | null {
  if (!cache.isCut || cache.rootNodeIds.length === 0) {
    return null;
  }

  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects, clearCutState } = ctx;
  const nodesToMove = cache.rootNodeIds.filter((id) => state.nodes[id]);

  if (nodesToMove.length === 0) {
    clearCutState();
    return 'no-content';
  }

  // Build map of cut nodes for blueprint validation
  const cutNodesMap: Record<string, TreeNode> = {};
  for (const id of nodesToMove) {
    cutNodesMap[id] = state.nodes[id];
  }

  // Blueprint validation: block moving blueprint nodes into non-blueprint parent
  if (!isTargetBlueprint(targetParentId, state.nodes) && containsBlueprintNodes(cutNodesMap)) {
    useToastStore.getState().addToast(
      'Cannot move blueprint nodes into a non-blueprint parent',
      'error'
    );
    return 'blocked';
  }

  // Check if pasting into same parent (no-op, just cancel cut)
  const firstNodeParent = getParentId(nodesToMove[0], state.ancestorRegistry, state.rootNodeId);
  const allSameParent = nodesToMove.every(
    (id) => getParentId(id, state.ancestorRegistry, state.rootNodeId) === firstNodeParent
  );

  if (allSameParent && firstNodeParent === targetParentId) {
    clearCutState();
    logger.info('Paste cancelled - nodes already in target parent', 'ClipboardActions');
    return 'cancelled';
  }

  // Move each node to the new parent
  for (const nodeId of nodesToMove) {
    const targetParent = state.nodes[targetParentId];
    const newPosition = targetParent ? targetParent.children.length : 0;

    const command = new MoveNodeCommand(
      nodeId,
      targetParentId,
      newPosition,
      () => {
        const currentState = get();
        return {
          nodes: currentState.nodes,
          rootNodeId: currentState.rootNodeId,
          ancestorRegistry: currentState.ancestorRegistry,
        };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave
    );

    actions.executeCommand(command);
  }

  clearCutState();
  flashNodes(nodesToMove, visualEffects);

  logger.info(`Moved ${nodesToMove.length} node(s)`, 'ClipboardActions');
  return 'pasted';
}

/**
 * Handle copy-paste (clone operation) from internal cache.
 * Returns null if this handler doesn't apply.
 */
function handleCopyPaste(
  cache: ClipboardCacheContent,
  ctx: PasteContext
): PasteResult | null {
  if (cache.isCut || cache.rootNodeIds.length === 0) {
    return null;
  }

  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects } = ctx;
  const { newRootNodes, newNodesMap } = cloneNodesWithNewIds(cache.rootNodeIds, state.nodes);

  if (newRootNodes.length === 0) {
    useClipboardCacheStore.getState().clearCache();
    return null; // Fall through to external paste
  }

  // Blueprint validation
  if (!isTargetBlueprint(targetParentId, state.nodes) && containsBlueprintNodes(newNodesMap)) {
    useToastStore.getState().addToast(
      'Cannot paste blueprint nodes into a non-blueprint parent',
      'error'
    );
    return 'blocked';
  }

  const command = new PasteNodesCommand(
    newRootNodes,
    newNodesMap,
    targetParentId,
    () => {
      const currentState = get();
      return {
        nodes: currentState.nodes,
        rootNodeId: currentState.rootNodeId,
        ancestorRegistry: currentState.ancestorRegistry,
      };
    },
    (partial) => set(partial as Partial<StoreState>),
    triggerAutosave,
    true
  );

  actions.executeCommand(command);
  flashNodes(command.getPastedRootIds(), visualEffects);

  logger.info(`Pasted ${newRootNodes.length} node(s) from internal cache`, 'ClipboardActions');
  return 'pasted';
}

/**
 * Handle external paste from system clipboard markdown.
 */
async function handleExternalPaste(ctx: PasteContext): Promise<PasteResult> {
  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects } = ctx;

  const clipboardText = await readFromClipboard('ClipboardActions:paste');
  if (!clipboardText) return 'no-content';

  const parsed = parseMarkdown(clipboardText);
  if (parsed.rootNodes.length === 0) return 'no-content';

  // Blueprint validation
  if (!isTargetBlueprint(targetParentId, state.nodes) && containsBlueprintNodes(parsed.allNodes)) {
    useToastStore.getState().addToast(
      'Cannot paste blueprint nodes into a non-blueprint parent',
      'error'
    );
    return 'blocked';
  }

  const command = new PasteNodesCommand(
    parsed.rootNodes,
    parsed.allNodes,
    targetParentId,
    () => {
      const currentState = get();
      return {
        nodes: currentState.nodes,
        rootNodeId: currentState.rootNodeId,
        ancestorRegistry: currentState.ancestorRegistry,
      };
    },
    (partial) => set(partial as Partial<StoreState>),
    triggerAutosave
  );

  actions.executeCommand(command);
  flashNodes(command.getPastedRootIds(), visualEffects);

  logger.info(`Pasted ${parsed.rootNodes.length} node(s) from clipboard markdown`, 'ClipboardActions');
  return 'pasted';
}

export const createClipboardActions = (
  get: () => StoreState,
  set: StoreSetter,
  getActions: () => StoreActions,
  visualEffects: VisualEffectsActions,
  triggerAutosave?: () => void
): ClipboardActions => {
  /**
   * Clear any existing cut state (used when cutting/copying new nodes).
   */
  function clearCutState(): void {
    const state = get();
    if (state.cutNodeIds.size > 0) {
      set({ cutNodeIds: new Set() });
    }
    useClipboardCacheStore.getState().clearCache();
  }

  /**
   * Execute deletion for multi-selection using a command.
   */
  function executeMultiNodeDelete(nodeIds: string[]): void {
    const actions = getActions();
    visualEffects.startDeleteAnimation(nodeIds, () => {
      const currentState = get();
      const command = new DeleteMultipleNodesCommand(
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

    // Clear any previous cut state before marking new nodes
    clearCutState();

    // Mark nodes as cut (including all descendants)
    const allCutIds = getNodeAndDescendantIds(nodeIds, state.nodes);
    set({ cutNodeIds: new Set(allCutIds) });

    // Cache the root node IDs for paste operation
    useClipboardCacheStore.getState().setCache(nodeIds, true);

    logger.info(`Cut ${nodeIds.length} node(s)`, 'ClipboardActions');
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

    // Clear any previous cut state
    clearCutState();

    // Cache node IDs for internal paste
    const nodeIds = getNodeIdsFromSelection(selection);
    useClipboardCacheStore.getState().setCache(nodeIds, false);

    flashNodes(nodeIds, visualEffects);

    logger.info(`Copied ${nodeIds.length} node(s)`, 'ClipboardActions');
    return 'copied';
  }

  async function pasteNodes(): Promise<PasteResult> {
    const state = get();
    const targetParentId = state.activeNodeId || state.rootNodeId;
    if (!targetParentId) return 'no-content';

    const cache = useClipboardCacheStore.getState().getCache();
    const ctx: PasteContext = {
      state,
      targetParentId,
      actions: getActions(),
      get,
      set,
      triggerAutosave,
      visualEffects,
      clearCutState,
    };

    // Try cut-paste first
    if (cache) {
      const cutResult = handleCutPaste(cache, ctx);
      if (cutResult !== null) return cutResult;

      // Try copy-paste from cache
      const copyResult = handleCopyPaste(cache, ctx);
      if (copyResult !== null) return copyResult;
    }

    // Fall back to external clipboard
    return handleExternalPaste(ctx);
  }

  function deleteSelectedNodes(): 'deleted' | 'no-selection' {
    const state = get();
    const selection = getSelection(state);

    if (selection.type === 'none') return 'no-selection';

    const nodeIds = getNodeIdsFromSelection(selection);
    if (selectionContainsRoot(nodeIds, state.nodes)) {
      logger.error('Attempted to delete root node - this indicates a bug', undefined, 'ClipboardActions');
      notifyError('Cannot modify root node', undefined, 'ClipboardActions:delete');
      return 'no-selection';
    }

    // Clear cut state if we're deleting cut nodes
    const cutNodeIds = state.cutNodeIds;
    if (nodeIds.some((id) => cutNodeIds.has(id))) {
      clearCutState();
    }

    logger.info(`Deleted ${nodeIds.length} node(s)`, 'ClipboardActions');

    if (selection.type === 'multi') {
      executeMultiNodeDelete(nodeIds);
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
