import type { TreeNode } from '../../../../shared/types';
import type { AncestorRegistry } from '../../../utils/ancestry';
import { parseMarkdown } from '../../../utils/markdown';
import { cloneNodesWithNewIds, findPreviousNode } from '../../../utils/nodeHelpers';
import {
  flashNodes,
  containsBlueprintNodes,
  isTargetBlueprint,
  isInvalidMoveTarget,
} from './clipboardHelpers';
import { DeleteMultipleNodesCommand } from '../commands/DeleteMultipleNodesCommand';
import { PasteNodesCommand } from '../commands/PasteNodesCommand';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';
import { CreateNodeCommand } from '../commands/CreateNodeCommand';
import { Command } from '../commands/Command';
import { logger } from '../../../services/logger';
import { readFromClipboard } from '../../../services/clipboardService';
import { VisualEffectsActions } from './visualEffectsActions';
import { useClipboardCacheStore, ClipboardCacheContent } from '../../clipboard/clipboardCacheStore';
import { useToastStore } from '../../toast/toastStore';
import { v4 as uuidv4 } from 'uuid';
import { storeManager } from '../../storeManager';
import { notifyMovementDisruption } from './workflowDisruption';

/**
 * Paste orchestration for clipboardActions. Each entry point takes a
 * PasteContext bag (state, target, command dispatcher, clear hook) and
 * returns a PasteResult discriminator. The main factory picks which
 * handler to run based on the clipboard-cache content.
 *
 * Extracted from clipboardActions so the factory code reads as
 * "wire up actions, delegate paste behavior" instead of hiding 400 lines
 * of paste state machines in between.
 */

export type PasteResult = 'pasted' | 'no-content' | 'blocked' | 'cancelled';

interface PasteStoreState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  currentFilePath: string | null;
}

interface PasteStoreActions {
  executeCommand: (command: Command) => void;
  autoSave?: () => void;
}

export interface PasteContext {
  state: PasteStoreState;
  targetParentId: string;
  actions: PasteStoreActions;
  get: () => PasteStoreState;
  set: (partial: Partial<PasteStoreState>) => void;
  triggerAutosave?: () => void;
  visualEffects: VisualEffectsActions;
  clearCutState: () => void;
}

export function handleCutPaste(
  cache: ClipboardCacheContent,
  ctx: PasteContext,
): PasteResult | null {
  if (!cache.isCut || cache.rootNodeIds.length === 0) {
    return null;
  }

  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects, clearCutState } = ctx;

  const isCrossFileCut = cache.sourceFilePath && cache.sourceFilePath !== state.currentFilePath;

  if (isCrossFileCut) {
    return handleCrossFileCutPaste(cache, ctx);
  }

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
    clearCutState();
    useToastStore.getState().addToast(
      'Cannot move blueprint nodes into a non-blueprint parent',
      'error',
    );
    return 'blocked';
  }

  clearCutState();

  for (const nodeId of nodesToMove) {
    const preState = get();
    const preAncestors = preState.ancestorRegistry[nodeId] || [];
    const preParentId = preAncestors[preAncestors.length - 1] || preState.rootNodeId;

    const currentNodes = preState.nodes;
    const targetParent = currentNodes[targetParentId];
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
      (partial) => set(partial),
      triggerAutosave,
    );

    actions.executeCommand(command);

    if (targetParentId !== preParentId) {
      notifyMovementDisruption(get, nodeId);
    }
  }

  flashNodes(nodesToMove, visualEffects);

  logger.info(`Moved ${nodesToMove.length} node(s)`, 'ClipboardActions');
  return 'pasted';
}

export function handleCrossFileCutPaste(
  cache: ClipboardCacheContent,
  ctx: PasteContext,
): PasteResult {
  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects, clearCutState } = ctx;

  const sourceStore = storeManager.getStoreForFile(cache.sourceFilePath!);
  const sourceState = sourceStore.getState();
  const sourceNodes = sourceState.nodes;

  const { newRootNodes, newNodesMap, idMapping } = cloneNodesWithNewIds(cache.rootNodeIds, sourceNodes);

  if (newRootNodes.length === 0) {
    clearCutState();
    return 'no-content';
  }

  const finalNodesMap = remapNodeReferences(newNodesMap, state.nodes, idMapping);

  if (!isTargetBlueprint(targetParentId, state.nodes) && containsBlueprintNodes(finalNodesMap)) {
    clearCutState();
    useToastStore.getState().addToast(
      'Cannot move blueprint nodes into a non-blueprint parent',
      'error',
    );
    return 'blocked';
  }

  const pasteCommand = new PasteNodesCommand(
    newRootNodes,
    finalNodesMap,
    targetParentId,
    () => {
      const currentState = get();
      return {
        nodes: currentState.nodes,
        rootNodeId: currentState.rootNodeId,
        ancestorRegistry: currentState.ancestorRegistry,
      };
    },
    (partial) => set(partial),
    triggerAutosave,
    true,
    true,
  );

  actions.executeCommand(pasteCommand);
  flashNodes(pasteCommand.getPastedRootIds(), visualEffects);

  clearCutState();

  const deleteCommand = new DeleteMultipleNodesCommand(
    cache.rootNodeIds,
    () => ({
      nodes: sourceStore.getState().nodes,
      rootNodeId: sourceStore.getState().rootNodeId,
      ancestorRegistry: sourceStore.getState().ancestorRegistry,
    }),
    (partial) => sourceStore.setState(partial),
    findPreviousNode,
    sourceStore.getState().actions.autoSave,
  );

  sourceStore.getState().actions.executeCommand(deleteCommand);

  logger.info(`Moved ${newRootNodes.length} node(s) across files`, 'ClipboardActions');
  return 'pasted';
}

function getSourceNodes(
  cache: ClipboardCacheContent,
  currentFilePath: string | null,
  currentNodes: Record<string, TreeNode>,
): Record<string, TreeNode> | null {
  if (!cache.sourceFilePath || cache.sourceFilePath === currentFilePath) {
    return currentNodes;
  }

  const sourceStore = storeManager.getStoreForFile(cache.sourceFilePath);
  if (!sourceStore) {
    return null;
  }

  return sourceStore.getState().nodes;
}

/**
 * When nodes cross a file boundary, their metadata may reference ids
 * that only exist in the source file. Remap appliedContextId and
 * linkedNodeId through the idMapping produced by cloneNodesWithNewIds,
 * or strip them if the referenced id has no match on either side.
 */
function remapNodeReferences(
  nodesMap: Record<string, TreeNode>,
  targetNodes: Record<string, TreeNode>,
  idMapping: Record<string, string>,
): Record<string, TreeNode> {
  const result: Record<string, TreeNode> = {};

  for (const [id, node] of Object.entries(nodesMap)) {
    const metadata = { ...node.metadata };

    if (metadata.transient) {
      delete metadata.transient;
    }

    const appliedContextId = metadata.appliedContextId as string | undefined;
    if (appliedContextId) {
      const remappedContextId = idMapping[appliedContextId];
      if (remappedContextId) {
        metadata.appliedContextId = remappedContextId;
      } else if (!targetNodes[appliedContextId]) {
        delete metadata.appliedContextId;
      }
    }

    const linkedNodeId = metadata.linkedNodeId as string | undefined;
    if (linkedNodeId) {
      const remappedLinkId = idMapping[linkedNodeId];
      if (remappedLinkId) {
        metadata.linkedNodeId = remappedLinkId;
      } else if (!targetNodes[linkedNodeId]) {
        delete metadata.linkedNodeId;
        delete metadata.isHyperlink;
      }
    }

    result[id] = { ...node, metadata };
  }

  return result;
}

export function handleCopyPaste(
  cache: ClipboardCacheContent,
  ctx: PasteContext,
): PasteResult | null {
  if (cache.isCut || cache.rootNodeIds.length === 0) {
    return null;
  }

  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects } = ctx;

  const sourceNodes = getSourceNodes(cache, state.currentFilePath, state.nodes);
  if (!sourceNodes) {
    return null;
  }

  const { newRootNodes, newNodesMap, idMapping } = cloneNodesWithNewIds(cache.rootNodeIds, sourceNodes);

  if (newRootNodes.length === 0) {
    useClipboardCacheStore.getState().clearCache();
    return null;
  }

  const isCrossFilePaste = cache.sourceFilePath && cache.sourceFilePath !== state.currentFilePath;
  const finalNodesMap = isCrossFilePaste
    ? remapNodeReferences(newNodesMap, state.nodes, idMapping)
    : newNodesMap;

  if (!isTargetBlueprint(targetParentId, state.nodes) && containsBlueprintNodes(finalNodesMap)) {
    useToastStore.getState().addToast(
      'Cannot paste blueprint nodes into a non-blueprint parent',
      'error',
    );
    return 'blocked';
  }

  const command = new PasteNodesCommand(
    newRootNodes,
    finalNodesMap,
    targetParentId,
    () => {
      const currentState = get();
      return {
        nodes: currentState.nodes,
        rootNodeId: currentState.rootNodeId,
        ancestorRegistry: currentState.ancestorRegistry,
      };
    },
    (partial) => set(partial),
    triggerAutosave,
    true,
    !!isCrossFilePaste,
  );

  actions.executeCommand(command);
  flashNodes(command.getPastedRootIds(), visualEffects);

  logger.info(`Pasted ${newRootNodes.length} node(s)`, 'ClipboardActions');
  return 'pasted';
}

function isExternalUrl(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function handleExternalUrlPaste(url: string, ctx: PasteContext): PasteResult {
  const { state, targetParentId, actions, get, set, triggerAutosave, visualEffects } = ctx;
  const trimmedUrl = url.trim();

  const newNodeId = uuidv4();
  const targetParent = state.nodes[targetParentId];
  const position = targetParent ? targetParent.children.length : 0;
  const isTargetParentBlueprint = targetParent?.metadata.isBlueprint === true;

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
    (partial) => set(partial),
    triggerAutosave,
    isTargetParentBlueprint ? { isBlueprint: true } : {},
  );

  actions.executeCommand(command);
  visualEffects.flashNode(newNodeId, 'light');

  logger.info('Pasted external URL as inline-text node', 'ClipboardActions');
  return 'pasted';
}

export async function handleExternalPaste(ctx: PasteContext): Promise<PasteResult> {
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
      'error',
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
    (partial) => set(partial),
    triggerAutosave,
  );

  actions.executeCommand(command);
  flashNodes(command.getPastedRootIds(), visualEffects);

  logger.info(`Pasted ${parsed.rootNodes.length} node(s) from clipboard`, 'ClipboardActions');
  return 'pasted';
}
