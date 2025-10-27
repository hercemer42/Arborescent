import { TreeNode } from '../../../../shared/types';
import { DeletedNodeEntry } from '../treeStore';
import {
  calculateNextSelection,
  isLastRootLevelNode,
  getParentNode,
} from '../../../utils/nodeHelpers';

export const MAX_DELETED_NODES = 10;

export interface NodeDeletionActions {
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
  undeleteNode: () => boolean;
  purgeOldDeletedNodes: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  deletedNodes: DeletedNodeEntry[];
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function recursivelySoftDelete(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  timestamp: number
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  let updatedNodes = { ...nodes };

  for (const childId of node.children) {
    updatedNodes = recursivelySoftDelete(childId, updatedNodes, timestamp);
  }

  updatedNodes[nodeId] = {
    ...node,
    metadata: {
      ...node.metadata,
      deleted: true,
      deletedAt: timestamp,
    },
  };

  return updatedNodes;
}

function recursivelyUndelete(
  nodeId: string,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  let updatedNodes = { ...nodes };

  for (const childId of node.children) {
    updatedNodes = recursivelyUndelete(childId, updatedNodes);
  }

  const { deleted, deletedAt, ...remainingMetadata } = node.metadata;
  void deleted;
  void deletedAt;
  updatedNodes[nodeId] = {
    ...node,
    metadata: remainingMetadata,
  };

  return updatedNodes;
}

function permanentlyDeleteNode(
  nodeId: string,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  let updatedNodes = { ...nodes };

  for (const childId of node.children) {
    updatedNodes = permanentlyDeleteNode(childId, updatedNodes);
  }

  delete updatedNodes[nodeId];

  return updatedNodes;
}

function clearNodeContent(
  nodeId: string,
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
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

function addDeletedNodeToBuffer(
  deletedNodes: DeletedNodeEntry[],
  nodeId: string
): { updatedBuffer: DeletedNodeEntry[]; nodesToPurge: DeletedNodeEntry[] } {
  const newDeletedEntry: DeletedNodeEntry = {
    rootNodeId: nodeId,
    deletedAt: Date.now(),
  };

  const updatedDeletedNodes = [...deletedNodes, newDeletedEntry];
  const nodesToPurge = updatedDeletedNodes.length > MAX_DELETED_NODES
    ? updatedDeletedNodes.slice(0, updatedDeletedNodes.length - MAX_DELETED_NODES)
    : [];

  const updatedBuffer = updatedDeletedNodes.slice(-MAX_DELETED_NODES);

  return { updatedBuffer, nodesToPurge };
}

function applyBufferPurge(
  nodes: Record<string, TreeNode>,
  nodesToPurge: DeletedNodeEntry[]
): Record<string, TreeNode> {
  let updatedNodes = nodes;
  for (const entry of nodesToPurge) {
    updatedNodes = permanentlyDeleteNode(entry.rootNodeId, updatedNodes);
  }
  return updatedNodes;
}

function performDeletion(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  deletedNodes: DeletedNodeEntry[]
): { finalNodes: Record<string, TreeNode>; updatedBuffer: DeletedNodeEntry[] } {
  const timestamp = Date.now();
  const updatedNodes = recursivelySoftDelete(nodeId, nodes, timestamp);
  const { updatedBuffer, nodesToPurge } = addDeletedNodeToBuffer(deletedNodes, nodeId);
  const finalNodes = applyBufferPurge(updatedNodes, nodesToPurge);
  return { finalNodes, updatedBuffer };
}

export const createNodeDeletionActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): NodeDeletionActions => {
  function deleteNode(nodeId: string, confirmed = false): boolean {
    const state = get();
    const { nodes, rootNodeId, deletedNodes } = state;
    const node = nodes[nodeId];
    if (!node) return true;

    if (node.children.length > 0 && !confirmed) {
      return false;
    }

    const parentInfo = getParentNode(nodeId, state);
    if (!parentInfo) return true;

    const { parentId, parent } = parentInfo;

    if (isLastRootLevelNode(parentId, rootNodeId, parent)) {
      clearNodeContent(nodeId, node, nodes, set, triggerAutosave);
      return true;
    }

    const { finalNodes, updatedBuffer } = performDeletion(nodeId, nodes, deletedNodes);
    const nextSelectedNodeId = calculateNextSelection(nodeId, parentId, rootNodeId, parent, finalNodes);

    set({
      nodes: finalNodes,
      selectedNodeId: nextSelectedNodeId,
      cursorPosition: 0,
      deletedNodes: updatedBuffer,
    });
    triggerAutosave?.();

    return true;
  }

  function undeleteNode(): boolean {
    const state = get();
    const { deletedNodes, nodes } = state;

    if (deletedNodes.length === 0) return false;

    const lastDeleted = deletedNodes[deletedNodes.length - 1];
    const deletedNodeId = lastDeleted.rootNodeId;
    const deletedNode = nodes[deletedNodeId];

    if (!deletedNode || !deletedNode.metadata.deleted) return false;

    const updatedNodes = recursivelyUndelete(deletedNodeId, nodes);

    set({
      nodes: updatedNodes,
      selectedNodeId: deletedNodeId,
      cursorPosition: 0,
      deletedNodes: deletedNodes.slice(0, -1),
    });

    return true;
  }

  function purgeOldDeletedNodes(): void {
    const state = get();
    const { nodes, deletedNodes } = state;

    let updatedNodes = nodes;
    for (const entry of deletedNodes) {
      updatedNodes = permanentlyDeleteNode(entry.rootNodeId, updatedNodes);
    }

    set({
      nodes: updatedNodes,
      deletedNodes: [],
    });
  }

  return {
    deleteNode,
    undeleteNode,
    purgeOldDeletedNodes,
  };
};
