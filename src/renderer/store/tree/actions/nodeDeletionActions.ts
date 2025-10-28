import { TreeNode } from '../../../../shared/types';
import { DeletedNodeEntry, DeletedNodeInfo } from '../treeStore';
import {
  isLastRootLevelNode,
  getParentNode,
  findPreviousNode,
  captureNodePosition,
} from '../../../utils/nodeHelpers';
import { v4 as uuidv4 } from 'uuid';

export const MAX_DELETED_NODES = 10;

export interface NodeDeletionActions {
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
  undeleteNode: () => boolean;
  purgeOldDeletedNodes: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  deletedNodesMap: Record<string, DeletedNodeInfo>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  deletedNodes: DeletedNodeEntry[];
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function createDeletedNodeInfo(
  node: TreeNode,
  parentId: string,
  originalPosition: number,
  timestamp: number,
  deleteBufferId: string,
  existingInfo?: DeletedNodeInfo
): DeletedNodeInfo {
  return {
    node: { ...node },
    originalParentId: existingInfo?.originalParentId || parentId,
    originalPosition: existingInfo?.originalPosition ?? originalPosition,
    deleteBufferId: existingInfo?.deleteBufferId || deleteBufferId,
    deletedAt: existingInfo?.deletedAt || timestamp,
  };
}

function recursivelyMoveToDeletedMap(
  nodeId: string,
  state: StoreState,
  timestamp: number,
  deleteBufferId: string
): { updatedNodes: Record<string, TreeNode>; updatedDeletedNodesMap: Record<string, DeletedNodeInfo> } {
  const { nodes, deletedNodesMap } = state;
  const node = nodes[nodeId];
  if (!node) return { updatedNodes: nodes, updatedDeletedNodesMap: deletedNodesMap };

  let updatedNodes = { ...nodes };
  let updatedDeletedNodesMap = { ...deletedNodesMap };

  const { parentId, originalPosition } = captureNodePosition(nodeId, state);

  for (const childId of node.children) {
    const result = recursivelyMoveToDeletedMap(
      childId,
      { ...state, nodes: updatedNodes, deletedNodesMap: updatedDeletedNodesMap },
      timestamp,
      deleteBufferId
    );
    updatedNodes = result.updatedNodes;
    updatedDeletedNodesMap = result.updatedDeletedNodesMap;
  }

  const existingInfo = updatedDeletedNodesMap[nodeId];
  updatedDeletedNodesMap[nodeId] = createDeletedNodeInfo(
    node,
    parentId,
    originalPosition,
    timestamp,
    deleteBufferId,
    existingInfo
  );

  delete updatedNodes[nodeId];

  return { updatedNodes, updatedDeletedNodesMap };
}

function recursivelyRestoreFromDeletedMap(
  nodeId: string,
  state: StoreState,
  deleteBufferId: string
): { updatedNodes: Record<string, TreeNode>; updatedDeletedNodesMap: Record<string, DeletedNodeInfo> } {
  const { nodes, deletedNodesMap } = state;
  const deletedInfo = deletedNodesMap[nodeId];
  if (!deletedInfo) return { updatedNodes: nodes, updatedDeletedNodesMap: deletedNodesMap };

  let updatedNodes = { ...nodes };
  let updatedDeletedNodesMap = { ...deletedNodesMap };

  if (deletedInfo.deleteBufferId === deleteBufferId) {
    const { node, originalParentId, originalPosition } = deletedInfo;

    updatedNodes[nodeId] = { ...node };
    updatedNodes = restoreNodeToParent(nodeId, originalParentId, originalPosition, updatedNodes);

    delete updatedDeletedNodesMap[nodeId];

    for (const childId of node.children) {
      const result = recursivelyRestoreFromDeletedMap(
        childId,
        { ...state, nodes: updatedNodes, deletedNodesMap: updatedDeletedNodesMap },
        deleteBufferId
      );
      updatedNodes = result.updatedNodes;
      updatedDeletedNodesMap = result.updatedDeletedNodesMap;
    }
  }

  return { updatedNodes, updatedDeletedNodesMap };
}

function restoreNodeToParent(
  nodeId: string,
  parentId: string,
  originalPosition: number,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const parent = nodes[parentId];
  if (!parent) return nodes;

  if (parent.children.includes(nodeId)) return nodes;

  const updatedChildren = [...parent.children];
  updatedChildren.splice(originalPosition, 0, nodeId);

  return {
    ...nodes,
    [parentId]: {
      ...parent,
      children: updatedChildren,
    },
  };
}

function removeNodeFromParent(
  nodeId: string,
  parentId: string,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const parent = nodes[parentId];
  if (!parent) return nodes;

  return {
    ...nodes,
    [parentId]: {
      ...parent,
      children: parent.children.filter(id => id !== nodeId),
    },
  };
}

function permanentlyDeleteFromMap(
  nodeId: string,
  deletedNodesMap: Record<string, DeletedNodeInfo>
): Record<string, DeletedNodeInfo> {
  const deletedInfo = deletedNodesMap[nodeId];
  if (!deletedInfo) return deletedNodesMap;

  let updatedMap = { ...deletedNodesMap };

  for (const childId of deletedInfo.node.children) {
    updatedMap = permanentlyDeleteFromMap(childId, updatedMap);
  }

  delete updatedMap[nodeId];

  return updatedMap;
}

function clearNodeContent(
  nodeId: string,
  state: StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
  const { nodes } = state;
  const node = nodes[nodeId];
  if (!node) return;

  const updatedNodes = {
    ...nodes,
    [nodeId]: {
      ...node,
      content: '',
    },
  };

  set({
    nodes: updatedNodes,
    selectedNodeId: nodeId,
    cursorPosition: 0,
  });
  triggerAutosave?.();
}

function createBufferEntry(nodeId: string, deleteBufferId: string): DeletedNodeEntry {
  return {
    rootNodeId: nodeId,
    deletedAt: Date.now(),
    deleteBufferId,
  };
}

function calculateNodesToPurge(
  deletedNodes: DeletedNodeEntry[],
  newEntry: DeletedNodeEntry
): DeletedNodeEntry[] {
  const updatedDeletedNodes = [...deletedNodes, newEntry];
  if (updatedDeletedNodes.length <= MAX_DELETED_NODES) return [];

  return updatedDeletedNodes.slice(0, updatedDeletedNodes.length - MAX_DELETED_NODES);
}

function addDeletedNodeToBuffer(
  deletedNodes: DeletedNodeEntry[],
  nodeId: string,
  deleteBufferId: string
): { updatedBuffer: DeletedNodeEntry[]; nodesToPurge: DeletedNodeEntry[] } {
  const newEntry = createBufferEntry(nodeId, deleteBufferId);
  const updatedDeletedNodes = [...deletedNodes, newEntry];
  const nodesToPurge = calculateNodesToPurge(deletedNodes, newEntry);
  const updatedBuffer = updatedDeletedNodes.slice(-MAX_DELETED_NODES);

  return { updatedBuffer, nodesToPurge };
}

function applyBufferPurge(
  deletedNodesMap: Record<string, DeletedNodeInfo>,
  nodesToPurge: DeletedNodeEntry[]
): Record<string, DeletedNodeInfo> {
  let updatedMap = deletedNodesMap;
  for (const entry of nodesToPurge) {
    updatedMap = permanentlyDeleteFromMap(entry.rootNodeId, updatedMap);
  }
  return updatedMap;
}

function performDeletion(
  nodeId: string,
  state: StoreState
): {
  finalNodes: Record<string, TreeNode>;
  finalDeletedNodesMap: Record<string, DeletedNodeInfo>;
  updatedBuffer: DeletedNodeEntry[];
} {
  const { ancestorRegistry, rootNodeId, deletedNodes } = state;
  const timestamp = Date.now();
  const deleteBufferId = uuidv4();

  const { updatedNodes, updatedDeletedNodesMap } = recursivelyMoveToDeletedMap(
    nodeId,
    state,
    timestamp,
    deleteBufferId
  );

  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1] || rootNodeId;
  const finalNodes = removeNodeFromParent(nodeId, parentId, updatedNodes);

  const { updatedBuffer, nodesToPurge } = addDeletedNodeToBuffer(deletedNodes, nodeId, deleteBufferId);
  const finalDeletedNodesMap = applyBufferPurge(updatedDeletedNodesMap, nodesToPurge);

  return { finalNodes, finalDeletedNodesMap, updatedBuffer };
}

function executeDeletionWithStateUpdate(
  nodeId: string,
  parentId: string,
  state: StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
  const { nodes, rootNodeId, ancestorRegistry } = state;
  const nextSelectedNodeId = findPreviousNode(nodeId, nodes, rootNodeId, ancestorRegistry);
  const { finalNodes, finalDeletedNodesMap, updatedBuffer } = performDeletion(nodeId, state);
  const finalSelectedNodeId = nextSelectedNodeId || (parentId !== rootNodeId ? parentId : null);

  set({
    nodes: finalNodes,
    deletedNodesMap: finalDeletedNodesMap,
    selectedNodeId: finalSelectedNodeId,
    cursorPosition: 0,
    deletedNodes: updatedBuffer,
  });
  triggerAutosave?.();
}

export const createNodeDeletionActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): NodeDeletionActions => {

  function deleteNode(nodeId: string, confirmed = false): boolean {
    const state = get();
    const { nodes, rootNodeId } = state;
    const node = nodes[nodeId];
    if (!node) return true;

    if (node.children.length > 0 && !confirmed) return false;

    const parentInfo = getParentNode(nodeId, state);
    if (!parentInfo) return true;

    const { parentId, parent } = parentInfo;

    if (isLastRootLevelNode(parentId, rootNodeId, parent)) {
      clearNodeContent(nodeId, state, set, triggerAutosave);
      return true;
    }

    executeDeletionWithStateUpdate(nodeId, parentId, state, set, triggerAutosave);
    return true;
  }

  function undeleteNode(): boolean {
    const state = get();
    const { deletedNodes, deletedNodesMap } = state;

    if (deletedNodes.length === 0) return false;

    const lastDeleted = deletedNodes[deletedNodes.length - 1];
    const deletedNodeId = lastDeleted.rootNodeId;
    const deletedInfo = deletedNodesMap[deletedNodeId];

    if (!deletedInfo) return false;

    const { updatedNodes, updatedDeletedNodesMap } = recursivelyRestoreFromDeletedMap(
      deletedNodeId,
      state,
      lastDeleted.deleteBufferId
    );

    set({
      nodes: updatedNodes,
      deletedNodesMap: updatedDeletedNodesMap,
      selectedNodeId: deletedNodeId,
      cursorPosition: 0,
      deletedNodes: deletedNodes.slice(0, -1),
    });

    return true;
  }

  function purgeOldDeletedNodes(): void {
    const state = get();
    const { deletedNodesMap, deletedNodes } = state;

    let updatedDeletedNodesMap = deletedNodesMap;
    for (const entry of deletedNodes) {
      updatedDeletedNodesMap = permanentlyDeleteFromMap(entry.rootNodeId, updatedDeletedNodesMap);
    }

    set({
      deletedNodesMap: updatedDeletedNodesMap,
      deletedNodes: [],
    });
  }

  return {
    deleteNode,
    undeleteNode,
    purgeOldDeletedNodes,
  };
};
