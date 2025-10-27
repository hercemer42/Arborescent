import { TreeNode } from '../../../../shared/types';
import { DeletedNodeEntry } from '../treeStore';
import {
  isLastRootLevelNode,
  getParentNode,
  getVisibleChildren,
  findPreviousVisibleNode,
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
  timestamp: number,
  deleteBufferId: string
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  let updatedNodes = { ...nodes };

  for (const childId of node.children) {
    updatedNodes = recursivelySoftDelete(childId, updatedNodes, timestamp, deleteBufferId);
  }

  // Only soft-delete if not already deleted (preserve existing deletion metadata)
  if (!node.metadata.deleted) {
    updatedNodes[nodeId] = {
      ...node,
      metadata: {
        ...node.metadata,
        deleted: true,
        deletedAt: timestamp,
        deleteBufferId,
      },
    };
  }

  return updatedNodes;
}

function recursivelyUndelete(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  deleteBufferId: string
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  let updatedNodes = { ...nodes };

  for (const childId of node.children) {
    updatedNodes = recursivelyUndelete(childId, updatedNodes, deleteBufferId);
  }

  // Only undelete if it belongs to this buffer entry
  if (node.metadata.deleteBufferId === deleteBufferId) {
    const { deleted, deletedAt, deleteBufferId: _deleteBufferId, ...remainingMetadata } = node.metadata;
    void deleted;
    void deletedAt;
    void _deleteBufferId;
    updatedNodes[nodeId] = {
      ...node,
      metadata: remainingMetadata,
    };
  }

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
  nodeId: string,
  deleteBufferId: string
): { updatedBuffer: DeletedNodeEntry[]; nodesToPurge: DeletedNodeEntry[] } {
  const newDeletedEntry: DeletedNodeEntry = {
    rootNodeId: nodeId,
    deletedAt: Date.now(),
    deleteBufferId,
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
  const deleteBufferId = uuidv4();
  const updatedNodes = recursivelySoftDelete(nodeId, nodes, timestamp, deleteBufferId);
  const { updatedBuffer, nodesToPurge } = addDeletedNodeToBuffer(deletedNodes, nodeId, deleteBufferId);
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

    const visibleChildren = getVisibleChildren(node.children, nodes);
    if (visibleChildren.length > 0 && !confirmed) {
      return false;
    }

    const parentInfo = getParentNode(nodeId, state);
    if (!parentInfo) return true;

    const { parentId, parent } = parentInfo;

    if (isLastRootLevelNode(parentId, rootNodeId, parent)) {
      clearNodeContent(nodeId, node, nodes, set, triggerAutosave);
      return true;
    }

    // Find previous visible node BEFORE deletion (so the node is still in its parent's children)
    const nextSelectedNodeId = findPreviousVisibleNode(
      nodeId,
      nodes,
      rootNodeId,
      state.ancestorRegistry
    );

    const { finalNodes, updatedBuffer } = performDeletion(nodeId, nodes, deletedNodes);

    // If no previous node, move to parent (unless parent is root)
    const finalSelectedNodeId = nextSelectedNodeId || (parentId !== rootNodeId ? parentId : null);

    set({
      nodes: finalNodes,
      selectedNodeId: finalSelectedNodeId,
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

    const updatedNodes = recursivelyUndelete(deletedNodeId, nodes, lastDeleted.deleteBufferId);

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
