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
import { MarkCutCommand } from '../commands/MarkCutCommand';
import { CreateNodeCommand } from '../commands/CreateNodeCommand';
import { Command } from '../commands/Command';
import { logger } from '../../../services/logger';
import { writeToClipboard, readFromClipboard } from '../../../services/clipboardService';
import { VisualEffectsActions } from './visualEffectsActions';
import { notifyError } from '../../../services/notification';
import { useClipboardCacheStore, ClipboardCacheContent } from '../../clipboard/clipboardCacheStore';
import { useHyperlinkClipboardStore } from '../../clipboard/hyperlinkClipboardStore';
import { useToastStore } from '../../toast/toastStore';
import { AncestorRegistry } from '../../../services/ancestry';
import { v4 as uuidv4 } from 'uuid';

export interface ClipboardActions {
  cutNodes: () => Promise<'cut' | 'no-selection'>;
  copyNodes: () => Promise<'copied' | 'no-selection'>;
  pasteNodes: () => Promise<'pasted' | 'no-content' | 'blocked' | 'cancelled'>;
  deleteSelectedNodes: () => 'deleted' | 'no-selection';
  copyAsHyperlink: () => 'copied' | 'no-selection';
  pasteAsHyperlink: () => 'pasted' | 'no-content';
  hasHyperlinkCache: () => boolean;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  multiSelectedNodeIds: Set<string>;
  currentFilePath: string | null;
};

type StoreActions = {
  executeCommand: (command: Command) => void;
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
  autoSave?: () => void;
};

type StoreSetter = (partial: Partial<StoreState>) => void;

function selectionContainsRoot(nodeIds: string[], nodes: Record<string, TreeNode>): boolean {
  return nodeIds.some((id) => nodes[id]?.metadata.isRoot === true);
}

function getRootLevelSelections(
  nodeIds: string[],
  ancestorRegistry: Record<string, string[]>
): string[] {
  const selectionSet = new Set(nodeIds);
  return nodeIds.filter((nodeId) => {
    const ancestors = ancestorRegistry[nodeId] || [];
    return !ancestors.some((ancestorId) => selectionSet.has(ancestorId));
  });
}

type SelectionResult =
  | { type: 'multi'; nodeIds: string[] }
  | { type: 'single'; nodeId: string }
  | { type: 'none' };

function getSelection(state: StoreState): SelectionResult {
  const { activeNodeId, nodes, multiSelectedNodeIds, ancestorRegistry, rootNodeId } = state;

  if (multiSelectedNodeIds.size > 0) {
    const rootLevelIds = getRootLevelSelections(
      Array.from(multiSelectedNodeIds),
      ancestorRegistry
    );
    const sortedIds = sortNodeIdsByTreeOrder(rootLevelIds, rootNodeId, nodes, ancestorRegistry);
    return { type: 'multi', nodeIds: sortedIds };
  }

  if (activeNodeId && nodes[activeNodeId]) {
    return { type: 'single', nodeId: activeNodeId };
  }

  return { type: 'none' };
}

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

function flashNodes(
  nodeIds: string | string[],
  visualEffects: VisualEffectsActions
): void {
  visualEffects.flashNode(nodeIds, 'light');
}

function getNodeIdsFromSelection(selection: SelectionResult): string[] {
  if (selection.type === 'multi') return selection.nodeIds;
  if (selection.type === 'single') return [selection.nodeId];
  return [];
}

function containsBlueprintNodes(nodesMap: Record<string, TreeNode>): boolean {
  return Object.values(nodesMap).some((node) => node.metadata.isBlueprint === true);
}

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

function isInvalidMoveTarget(
  nodeIds: string[],
  targetParentId: string,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): boolean {
  if (nodeIds.includes(targetParentId)) {
    return true;
  }
  const targetAncestors = ancestorRegistry[targetParentId] || [];
  if (nodeIds.some((id) => targetAncestors.includes(id))) {
    return true;
  }
  const firstNodeParent = getParentId(nodeIds[0], ancestorRegistry, rootNodeId);
  const allSameParent = nodeIds.every(
    (id) => getParentId(id, ancestorRegistry, rootNodeId) === firstNodeParent
  );
  if (allSameParent && firstNodeParent === targetParentId) {
    return true;
  }
  return false;
}

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

  if (isInvalidMoveTarget(nodesToMove, targetParentId, state.rootNodeId, state.ancestorRegistry)) {
    clearCutState();
    logger.info('Paste cancelled - invalid move target', 'ClipboardActions');
    return 'cancelled';
  }

  const cutNodesMap: Record<string, TreeNode> = {};
  for (const id of nodesToMove) {
    cutNodesMap[id] = state.nodes[id];
  }

  if (!isTargetBlueprint(targetParentId, state.nodes) && containsBlueprintNodes(cutNodesMap)) {
    useToastStore.getState().addToast(
      'Cannot move blueprint nodes into a non-blueprint parent',
      'error'
    );
    return 'blocked';
  }

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
    return null;
  }

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

function isExternalUrl(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function handleExternalUrlPaste(
  url: string,
  ctx: PasteContext
): PasteResult {
  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects } = ctx;
  const trimmedUrl = url.trim();

  const newNodeId = uuidv4();
  const targetParent = state.nodes[targetParentId];
  const position = targetParent ? targetParent.children.length : 0;

  const command = new CreateNodeCommand(
    newNodeId,
    targetParentId,
    position,
    trimmedUrl,
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
    {
      isExternalLink: true,
      externalUrl: trimmedUrl,
    }
  );

  actions.executeCommand(command);
  visualEffects.flashNode(newNodeId, 'light');

  logger.info('Pasted external URL as link node', 'ClipboardActions');
  return 'pasted';
}

async function handleExternalPaste(ctx: PasteContext): Promise<PasteResult> {
  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects } = ctx;

  const clipboardText = await readFromClipboard('ClipboardActions:paste');
  if (!clipboardText) return 'no-content';

  if (isExternalUrl(clipboardText)) {
    return handleExternalUrlPaste(clipboardText, ctx);
  }

  const parsed = parseMarkdown(clipboardText);

  if (parsed.rootNodes.length === 0) {
    return 'no-content';
  }

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

  logger.info(`Pasted ${parsed.rootNodes.length} node(s) from clipboard`, 'ClipboardActions');
  return 'pasted';
}

export const createClipboardActions = (
  get: () => StoreState,
  set: StoreSetter,
  getActions: () => StoreActions,
  visualEffects: VisualEffectsActions,
  triggerAutosave?: () => void
): ClipboardActions => {
  function clearCutState(): void {
    const cache = useClipboardCacheStore.getState().getCache();
    const cutIds = cache?.allCutNodeIds || [];

    if (cutIds.length > 0) {
      const state = get();
      const updatedNodes = { ...state.nodes };
      for (const nodeId of cutIds) {
        const node = updatedNodes[nodeId];
        if (node) {
          const { transient, ...restMetadata } = node.metadata;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { isCut, ...restTransient } = transient || {};
          const newMetadata =
            Object.keys(restTransient).length > 0
              ? { ...restMetadata, transient: restTransient }
              : restMetadata;
          updatedNodes[nodeId] = { ...node, metadata: newMetadata };
        }
      }
      set({ nodes: updatedNodes });
    }

    useClipboardCacheStore.getState().clearCache();
  }

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

    clearCutState();

    const allCutIds = getNodeAndDescendantIds(nodeIds, state.nodes);
    const actions = getActions();
    const command = new MarkCutCommand(
      allCutIds,
      () => ({ nodes: get().nodes }),
      (partial) => set(partial as Partial<StoreState>)
    );
    actions.executeCommand(command);

    useClipboardCacheStore.getState().setCache(nodeIds, true, markdown, allCutIds);

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

    clearCutState();

    const nodeIds = getNodeIdsFromSelection(selection);
    useClipboardCacheStore.getState().setCache(nodeIds, false, markdown);

    flashNodes(nodeIds, visualEffects);

    logger.info(`Copied ${nodeIds.length} node(s)`, 'ClipboardActions');
    return 'copied';
  }

  async function pasteNodes(): Promise<PasteResult> {
    const state = get();
    const targetParentId = state.activeNodeId || state.rootNodeId;
    if (!targetParentId) return 'no-content';

    const targetParent = state.nodes[targetParentId];
    const isLinkNode = targetParent?.metadata.isHyperlink === true || targetParent?.metadata.isExternalLink === true;
    if (isLinkNode) {
      useToastStore.getState().addToast('Cannot paste into a link node', 'error');
      return 'no-content';
    }

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

    const clipboardText = await readFromClipboard('ClipboardActions:paste');
    const cacheIsValid = cache && clipboardText === cache.clipboardText;

    if (cacheIsValid) {
      const cutResult = handleCutPaste(cache, ctx);
      if (cutResult !== null) return cutResult;

      const copyResult = handleCopyPaste(cache, ctx);
      if (copyResult !== null) return copyResult;
    }

    const hyperlinkResult = pasteAsHyperlink();
    if (hyperlinkResult === 'pasted') return 'pasted';

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

    const cache = useClipboardCacheStore.getState().getCache();
    const cutIds = cache?.allCutNodeIds || [];
    if (cutIds.length > 0 && nodeIds.some((id) => cutIds.includes(id))) {
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

  function copyAsHyperlink(): 'copied' | 'no-selection' {
    const state = get();
    const { activeNodeId, nodes, currentFilePath } = state;

    if (!activeNodeId) return 'no-selection';
    if (!currentFilePath) return 'no-selection';

    const node = nodes[activeNodeId];
    if (!node) return 'no-selection';

    useHyperlinkClipboardStore.getState().setCache(activeNodeId, node.content, currentFilePath);

    flashNodes(activeNodeId, visualEffects);
    logger.info('Copied node as hyperlink', 'ClipboardActions');
    return 'copied';
  }

  function pasteAsHyperlink(): 'pasted' | 'no-content' {
    const hyperlinkCache = useHyperlinkClipboardStore.getState().getCache();
    if (!hyperlinkCache) return 'no-content';

    const state = get();
    const { currentFilePath } = state;

    if (!currentFilePath || hyperlinkCache.sourceFilePath !== currentFilePath) {
      return 'no-content';
    }

    const targetParentId = state.activeNodeId || state.rootNodeId;
    if (!targetParentId) return 'no-content';

    const targetParent = state.nodes[targetParentId];
    if (!targetParent) return 'no-content';

    const isLinkNode = targetParent.metadata.isHyperlink === true || targetParent.metadata.isExternalLink === true;
    if (isLinkNode) {
      useToastStore.getState().addToast('Cannot add hyperlink as child of a link node', 'error');
      return 'no-content';
    }

    const newNodeId = uuidv4();
    const position = targetParent.children.length;

    const command = new CreateNodeCommand(
      newNodeId,
      targetParentId,
      position,
      hyperlinkCache.content, // Use the snapshot content
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
      {
        isHyperlink: true,
        linkedNodeId: hyperlinkCache.nodeId,
      }
    );

    getActions().executeCommand(command);
    flashNodes(newNodeId, visualEffects);

    logger.info('Pasted hyperlink', 'ClipboardActions');
    return 'pasted';
  }

  function hasHyperlinkCache(): boolean {
    return useHyperlinkClipboardStore.getState().hasCache();
  }

  return {
    cutNodes,
    copyNodes,
    pasteNodes,
    deleteSelectedNodes,
    copyAsHyperlink,
    pasteAsHyperlink,
    hasHyperlinkCache,
  };
};
