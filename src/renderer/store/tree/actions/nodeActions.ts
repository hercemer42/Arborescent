import { TreeNode, NodeStatus } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry, buildAncestorRegistry } from '../../../utils/ancestry';
import { v4 as uuidv4 } from 'uuid';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  createSiblingNode: (currentNodeId: string) => void;
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
  }

  function setCursorPosition(position: number): void {
    set({ cursorPosition: position });
  }

  function setRememberedVisualX(visualX: number | null): void {
    set({ rememberedVisualX: visualX });
  }

  function createSiblingNode(currentNodeId: string): void {
    const { nodes, rootNodeId, ancestorRegistry } = get();
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();
    const newNode: TreeNode = {
      id: newNodeId,
      content: '',
      children: [],
      metadata: { status: '☐' },
    };

    const ancestors = ancestorRegistry[currentNodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];

    if (parent) {
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
    triggerAutosave?.();
  }

  return {
    selectNode,
    updateContent,
    updateStatus,
    setCursorPosition,
    setRememberedVisualX,
    createSiblingNode,
  };
};
