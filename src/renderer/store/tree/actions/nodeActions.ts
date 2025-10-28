import { TreeNode, NodeStatus } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry, buildAncestorRegistry } from '../../../utils/ancestry';
import { v4 as uuidv4 } from 'uuid';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  toggleStatus: (nodeId: string) => void;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  createNode: (currentNodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

function generateId(): string {
  return uuidv4();
}

export const createNodeActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): NodeActions => {
  function selectNode(nodeId: string, cursorPosition?: number): void {
    set({
      selectedNodeId: nodeId,
      cursorPosition: cursorPosition ?? 0,
    });
  }

  function updateContent(nodeId: string, content: string): void {
    const { nodes } = get();
    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...nodes[nodeId],
          content,
        },
      },
    });
    triggerAutosave?.();
  }

  function updateStatus(nodeId: string, status: NodeStatus): void {
    const { nodes } = get();
    set({
      nodes: updateNodeMetadata(nodes, nodeId, { status }),
    });
    triggerAutosave?.();
  }

  function toggleStatus(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const currentStatus = node.metadata.status;
    const statusCycle: NodeStatus[] = ['pending', 'completed', 'failed'];

    let nextStatus: NodeStatus;
    if (!currentStatus) {
      nextStatus = 'pending';
    } else {
      const currentIndex = statusCycle.indexOf(currentStatus);
      nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    }

    set({
      nodes: updateNodeMetadata(nodes, nodeId, { status: nextStatus }),
    });
    triggerAutosave?.();
  }

  function setCursorPosition(position: number): void {
    set({ cursorPosition: position });
  }

  function setRememberedVisualX(visualX: number | null): void {
    set({ rememberedVisualX: visualX });
  }

  function createChildNodeAtFirstPosition(
    parentNodeId: string,
    newNodeId: string,
    newNode: TreeNode
  ): void {
    const { nodes, rootNodeId } = get();
    const parentNode = nodes[parentNodeId];

    const updatedChildren = [newNodeId, ...parentNode.children];
    const updatedNodes = {
      ...nodes,
      [newNodeId]: newNode,
      [parentNodeId]: {
        ...parentNode,
        children: updatedChildren,
      },
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      selectedNodeId: newNodeId,
      cursorPosition: 0,
      rememberedVisualX: null,
    });
  }

  function createSiblingNodeAfterCurrent(
    currentNodeId: string,
    newNodeId: string,
    newNode: TreeNode
  ): void {
    const { nodes, rootNodeId, ancestorRegistry } = get();

    const ancestors = ancestorRegistry[currentNodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];

    if (!parent) return;

    const currentIndex = parent.children.indexOf(currentNodeId);
    const updatedChildren = [...parent.children];
    updatedChildren.splice(currentIndex + 1, 0, newNodeId);

    const updatedNodes = {
      ...nodes,
      [newNodeId]: newNode,
      [parentId]: {
        ...parent,
        children: updatedChildren,
      },
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      selectedNodeId: newNodeId,
      cursorPosition: 0,
      rememberedVisualX: null,
    });
  }

  function createNode(currentNodeId: string): void {
    const { nodes } = get();
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();
    const newNode: TreeNode = {
      id: newNodeId,
      content: '',
      children: [],
      metadata: { status: 'pending' },
    };

    const isExpanded = currentNode.metadata.expanded ?? true;
    const hasChildren = currentNode.children.length > 0;

    if (isExpanded && hasChildren) {
      createChildNodeAtFirstPosition(currentNodeId, newNodeId, newNode);
    } else {
      createSiblingNodeAfterCurrent(currentNodeId, newNodeId, newNode);
    }

    triggerAutosave?.();
  }

  return {
    selectNode,
    updateContent,
    updateStatus,
    toggleStatus,
    setCursorPosition,
    setRememberedVisualX,
    createNode,
  };
};
