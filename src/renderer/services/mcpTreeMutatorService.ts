import type {
  TreeMutateRequest,
  MutationRequest,
  MutationResult,
} from '../../shared/types/electronApi';
import { TreeStore } from '../store/tree/treeStore';
import { TreeNode } from '../../shared/types';
import { findStoreOwningSession } from '../store/storeOwnership';
import { syncBoundTerminalTitles } from '../store/terminal/syncBoundTerminalTitles';
import { logger } from './logger';
import {
  addNodeToRegistry,
  removeNodeFromRegistry,
  moveNodeInRegistry,
} from '../utils/ancestry';
import { getParentIdOrNull } from '../utils/parentLookup';
import { shouldInheritBlueprint } from '../utils/nodeHelpers';
import { createTreeNode } from '../utils/nodeConstruction';
import { v4 as uuidv4 } from 'uuid';

export function applyMutation(store: TreeStore, nodeId: string, request: MutationRequest): MutationResult {
  switch (request.kind) {
    case 'add-child':
      return applyAddChild(store, request);
    case 'append':
      return applyAppend(store, nodeId, request.content);
    case 'mark-complete':
      return applyMarkComplete(store, nodeId, request.status);
    case 'set-content':
      return applySetContent(store, nodeId, request.content);
    case 'delete':
      return applyDelete(store, nodeId);
    case 'move':
      return applyMove(store, nodeId, request);
    case 'set-metadata':
      return applySetMetadata(store, nodeId, request.key, request.value);
  }
}

function applyAddChild(
  store: TreeStore,
  request: Extract<MutationRequest, { kind: 'add-child' }>,
): MutationResult {
  const state = store.getState();
  const parent = state.nodes[request.parentId];
  if (!parent) return { ok: false, error: `Parent node ${request.parentId} not found` };

  // Mirror CreateNodeCommand's metadata initialization so AI-added children behave
  // identically to user-created nodes: pending status for workflow tracking and
  // blueprint inheritance from a blueprint ancestor chain.
  const metadata: Record<string, unknown> = { status: 'pending' };
  if (shouldInheritBlueprint(request.parentId, state.nodes, state.ancestorRegistry)) {
    metadata.isBlueprint = true;
  }

  const newId = uuidv4();
  const newNode = createTreeNode(newId, { content: request.content, metadata });

  const insertAt =
    request.position === undefined
      ? parent.children.length
      : Math.max(0, Math.min(request.position, parent.children.length));
  const newChildren = [...parent.children];
  newChildren.splice(insertAt, 0, newId);
  const updatedParent: TreeNode = { ...parent, children: newChildren };

  store.setState({
    nodes: { ...state.nodes, [newId]: newNode, [request.parentId]: updatedParent },
    ancestorRegistry: addNodeToRegistry(state.ancestorRegistry, newId, request.parentId),
  });
  triggerAutoSave(store);
  return { ok: true };
}

function applyAppend(store: TreeStore, nodeId: string, suffix: string): MutationResult {
  return updateNode(store, nodeId, (node) => ({
    ...node,
    content: node.content + suffix,
  }));
}

function applyMarkComplete(
  store: TreeStore,
  nodeId: string,
  status: 'completed' | 'abandoned',
): MutationResult {
  return updateNode(store, nodeId, (node) => ({
    ...node,
    metadata: { ...node.metadata, status },
  }));
}

function applySetContent(store: TreeStore, nodeId: string, content: string): MutationResult {
  return updateNode(store, nodeId, (node) => ({ ...node, content }));
}

interface StoreActionsForDelete {
  deleteNode?: (nodeId: string, confirmed?: boolean) => boolean;
}

function applyDelete(store: TreeStore, nodeId: string): MutationResult {
  const state = store.getState();
  if (nodeId === state.rootNodeId) return { ok: false, error: 'Cannot delete the root node' };
  if (nodeId === state.collaboratingNodeId) {
    return {
      ok: false,
      error: 'Cannot delete a node that is currently being collaborated on.',
    };
  }
  const node = state.nodes[nodeId];
  if (!node) return { ok: false, error: `Node ${nodeId} not found` };

  // Route through the store's deleteNode action when available. The action handles
  // workflow disruption notifications, zoom-tab cleanup, the "last root-level node →
  // clear instead" special case, and undo registration. Pass confirmed=true since the
  // AI tool call is the confirmation step.
  const actions = (state as { actions?: StoreActionsForDelete }).actions;
  if (actions?.deleteNode) {
    const succeeded = actions.deleteNode(nodeId, true);
    if (!succeeded) {
      return { ok: false, error: `Delete refused by the application (node may be in use)` };
    }
    return { ok: true };
  }

  // Fallback for environments without the action wiring (tests that hand-roll a store).
  return applyDirectDelete(store, nodeId);
}

export function applyDirectDelete(store: TreeStore, nodeId: string): MutationResult {
  const state = store.getState();
  const parentId = getParentIdOrNull(nodeId, state.ancestorRegistry);
  if (!parentId) return { ok: false, error: `Could not locate parent of ${nodeId}` };

  const nextNodes = { ...state.nodes };
  removeNodeAndDescendants(nextNodes, nodeId);
  const parent = nextNodes[parentId];
  nextNodes[parentId] = { ...parent, children: parent.children.filter((c) => c !== nodeId) };

  store.setState({
    // removeNodeFromRegistry walks the descendant chain via state.nodes (pre-mutation)
    // because nextNodes has already had the descendants stripped; passing nextNodes
    // here would silently skip the descendant ancestorRegistry cleanup.
    nodes: nextNodes,
    ancestorRegistry: removeNodeFromRegistry(state.ancestorRegistry, nodeId, state.nodes),
  });
  triggerAutoSave(store);
  return { ok: true };
}

function applyMove(
  store: TreeStore,
  nodeId: string,
  request: Extract<MutationRequest, { kind: 'move' }>,
): MutationResult {
  const state = store.getState();
  if (nodeId === state.rootNodeId) return { ok: false, error: 'Cannot move the root node' };
  const targetParent = state.nodes[request.newParentId];
  if (!targetParent) return { ok: false, error: `Target parent ${request.newParentId} not found` };
  if (request.newParentId === nodeId) return { ok: false, error: 'Cannot move node into itself' };
  if (state.ancestorRegistry[request.newParentId]?.includes(nodeId)) {
    return { ok: false, error: 'Cannot move node into one of its own descendants' };
  }
  const oldParentId = getParentIdOrNull(nodeId, state.ancestorRegistry);
  if (!oldParentId) return { ok: false, error: `Could not locate parent of ${nodeId}` };

  const nextNodes = { ...state.nodes };
  const oldParent = nextNodes[oldParentId];
  nextNodes[oldParentId] = { ...oldParent, children: oldParent.children.filter((c) => c !== nodeId) };

  // Read target after the filter so a same-parent reorder doesn't duplicate the node.
  const targetAfterFilter = nextNodes[request.newParentId];
  const position = request.position ?? targetAfterFilter.children.length;
  const insertAt = Math.max(0, Math.min(position, targetAfterFilter.children.length));
  const newChildren = [...targetAfterFilter.children];
  newChildren.splice(insertAt, 0, nodeId);
  nextNodes[request.newParentId] = { ...targetAfterFilter, children: newChildren };

  store.setState({
    nodes: nextNodes,
    ancestorRegistry: moveNodeInRegistry(
      state.ancestorRegistry,
      nodeId,
      request.newParentId,
      nextNodes,
    ),
  });
  triggerAutoSave(store);
  return { ok: true };
}

const FRAMEWORK_MANAGED_METADATA_KEYS = new Set(['sessionId', 'groupId', 'brokenChain']);

function applySetMetadata(
  store: TreeStore,
  nodeId: string,
  key: string,
  value: unknown,
): MutationResult {
  if (FRAMEWORK_MANAGED_METADATA_KEYS.has(key)) {
    return { ok: false, error: `Metadata key '${key}' is framework-managed and cannot be set via MCP` };
  }
  return updateNode(store, nodeId, (node) => ({
    ...node,
    metadata: { ...node.metadata, [key]: value },
  }));
}

function updateNode(
  store: TreeStore,
  nodeId: string,
  updater: (node: TreeNode) => TreeNode,
): MutationResult {
  const state = store.getState();
  const node = state.nodes[nodeId];
  if (!node) return { ok: false, error: `Node ${nodeId} not found` };
  const updatedNode = updater(node);
  store.setState({ nodes: { ...state.nodes, [nodeId]: updatedNode } });
  syncBoundTerminalTitles(nodeId, updatedNode);
  triggerAutoSave(store);
  return { ok: true };
}

function removeNodeAndDescendants(nodes: Record<string, TreeNode>, nodeId: string): void {
  const node = nodes[nodeId];
  if (!node) return;
  for (const childId of node.children) {
    removeNodeAndDescendants(nodes, childId);
  }
  delete nodes[nodeId];
}

interface StoreActionsWithAutosave {
  autoSave?: () => void;
}

function triggerAutoSave(store: TreeStore): void {
  const actions = (store.getState() as { actions?: StoreActionsWithAutosave }).actions;
  actions?.autoSave?.();
}

export function startMcpTreeMutatorService(): () => void {
  return window.electron.onMcpTreeMutateRequest((request: TreeMutateRequest) => {
    const result = handleRequest(request);
    void window.electron.respondToMcpTreeMutate({ requestId: request.requestId, result });
  });
}

function handleRequest(request: TreeMutateRequest): MutationResult {
  const store = findStoreOwningSession(request.sessionId);
  if (!store) {
    logger.warn(`tree-mutate: no open file owns session ${request.sessionId}`, 'McpTreeMutator');
    return { ok: false, error: `No open file owns session ${request.sessionId}` };
  }
  try {
    return applyMutation(store, request.nodeId, request.request);
  } catch (error) {
    logger.error('tree-mutate threw', error as Error, 'McpTreeMutator');
    return { ok: false, error: (error as Error).message };
  }
}
