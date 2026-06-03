import { TreeNode } from '../../../../shared/types';
import { getNodeAndDescendantIds } from '../../../utils/nodeHelpers';
import {
  getSelection,
  selectionContainsRoot,
  exportSelectionAsMarkdown,
  getNodeIdsFromSelection,
  flashNodes,
} from './clipboardHelpers';
import {
  handleCutPaste,
  handleCopyPaste,
  handleExternalPaste,
  type PasteContext,
  type PasteResult,
} from './clipboardPasteHandlers';
import { MarkCutCommand } from '../commands/MarkCutCommand';
import { CreateNodeCommand } from '../commands/CreateNodeCommand';
import { Command } from '../commands/Command';
import { logger } from '../../../services/logger';
import { writeToClipboard, readFromClipboard } from '../../../services/clipboardService';
import { VisualEffectsActions } from './visualEffectsActions';
import { notifyError } from '../../../services/notification';
import { useClipboardCacheStore } from '../../clipboard/clipboardCacheStore';
import { useHyperlinkClipboardStore } from '../../clipboard/hyperlinkClipboardStore';
import { useToastStore } from '../../toast/toastStore';
import { AncestorRegistry } from '../../../utils/ancestry';
import { v4 as uuidv4 } from 'uuid';
import { storeManager } from '../../storeManager';

export interface ClipboardActions {
  cutNodes: () => Promise<'cut' | 'no-selection'>;
  copyNodes: () => Promise<'copied' | 'no-selection'>;
  pasteNodes: () => Promise<'pasted' | 'no-content' | 'blocked' | 'cancelled'>;
  deleteSelectedNodes: () => 'deleted' | 'no-selection';
  copyAsHyperlink: () => Promise<'copied' | 'no-selection'>;
  pasteAsHyperlink: (currentClipboardText: string) => 'pasted' | 'no-content';
  hasHyperlinkCache: () => boolean;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  multiSelectedNodeIds: Set<string>;
  currentFilePath: string | null;
  blueprintModeEnabled: boolean;
  workflowSessionMap?: Record<string, string>;
};

type StoreActions = {
  executeCommand: (command: Command) => void;
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
  deleteNodes: (nodeIds: string[]) => void;
  autoSave?: () => void;
};

type StoreSetter = (partial: Partial<StoreState>) => void;

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
      const currentState = get();
      const sourceFilePath = cache?.sourceFilePath;
      const currentFilePath = currentState.currentFilePath;

      const targetStore = sourceFilePath && sourceFilePath !== currentFilePath
        ? storeManager.getStoreForFile(sourceFilePath)
        : null;

      const targetNodes = targetStore ? targetStore.getState().nodes : currentState.nodes;
      const updatedNodes = { ...targetNodes };

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

      if (targetStore) {
        targetStore.setState({ nodes: updatedNodes });
      } else {
        set({ nodes: updatedNodes });
      }
    }

    useClipboardCacheStore.getState().clearCache();
  }

  function executeMultiNodeDelete(nodeIds: string[]): void {
    const actions = getActions();
    visualEffects.startDeleteAnimation(nodeIds, () => {
      actions.deleteNodes(nodeIds);
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

    useClipboardCacheStore.getState().setCache(nodeIds, true, markdown, allCutIds, state.currentFilePath || undefined);
    useHyperlinkClipboardStore.getState().clearCache();

    logger.info(`Cut ${nodeIds.length} node(s)`, 'ClipboardActions');
    return 'cut';
  }

  async function copyNodes(): Promise<'copied' | 'no-selection'> {
    const state = get();
    const selection = getSelection(state);

    if (selection.type === 'none') return 'no-selection';

    const nodeIds = getNodeIdsFromSelection(selection);

    if (state.blueprintModeEnabled) {
      const hasNonBlueprint = nodeIds.some(id => !state.nodes[id]?.metadata.isBlueprint);
      if (hasNonBlueprint) {
        useToastStore.getState().addToast('Cannot copy a non-blueprint branch in blueprint mode', 'error');
        return 'no-selection';
      }
    }

    const markdown = exportSelectionAsMarkdown(selection, state.nodes);
    if (!markdown) return 'no-selection';

    const success = await writeToClipboard(markdown, 'ClipboardActions:copy');
    if (!success) return 'no-selection';

    clearCutState();

    useClipboardCacheStore.getState().setCache(nodeIds, false, markdown, undefined, state.currentFilePath || undefined);
    useHyperlinkClipboardStore.getState().clearCache();

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
      useToastStore.getState().addToast('Cannot paste into a link branch', 'error');
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

    const hyperlinkResult = pasteAsHyperlink(clipboardText || '');
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

  async function copyAsHyperlink(): Promise<'copied' | 'no-selection'> {
    const state = get();
    const { activeNodeId, nodes, currentFilePath } = state;

    if (!activeNodeId) return 'no-selection';
    if (!currentFilePath) return 'no-selection';

    const node = nodes[activeNodeId];
    if (!node) return 'no-selection';

    const currentClipboardText = await readFromClipboard('ClipboardActions:copyAsHyperlink') || '';

    useClipboardCacheStore.getState().clearCache();
    useHyperlinkClipboardStore.getState().setCache(activeNodeId, node.content, currentFilePath, currentClipboardText);

    flashNodes(activeNodeId, visualEffects);
    logger.info('Copied node as hyperlink', 'ClipboardActions');
    return 'copied';
  }

  function pasteAsHyperlink(currentClipboardText: string): 'pasted' | 'no-content' {
    const hyperlinkCache = useHyperlinkClipboardStore.getState().getCache();
    if (!hyperlinkCache) return 'no-content';

    if (currentClipboardText !== hyperlinkCache.clipboardTextAtCopy) {
      useHyperlinkClipboardStore.getState().clearCache();
      return 'no-content';
    }

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
      useToastStore.getState().addToast('Cannot add hyperlink as child of a link branch', 'error');
      return 'no-content';
    }

    const newNodeId = uuidv4();
    const position = targetParent.children.length;

    const command = new CreateNodeCommand(
      newNodeId,
      targetParentId,
      position,
      hyperlinkCache.content,
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
