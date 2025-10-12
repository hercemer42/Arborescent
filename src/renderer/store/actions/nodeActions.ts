import { TreeNode, NodeStatus } from '../../../shared/types';
import { AncestorRegistry, buildAncestorRegistry } from '../../services/registryService';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  deleteNode: (nodeId: string) => void;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  createSiblingNode: (currentNodeId: string) => void;
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
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
  return Math.random().toString(36).substring(2, 11);
}

export const createNodeActions = (
  get: () => StoreState,
  set: StoreSetter
): NodeActions => ({
  selectNode: (nodeId: string, cursorPosition?: number) => {
    set({
      selectedNodeId: nodeId,
      cursorPosition: cursorPosition ?? 0,
    });
  },

  updateContent: (nodeId: string, content: string) => {
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
  },

  updateStatus: (nodeId: string, status: NodeStatus) => {
    const { nodes } = get();
    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...nodes[nodeId],
          metadata: {
            ...nodes[nodeId].metadata,
            status,
          },
        },
      },
    });
  },

  deleteNode: (nodeId: string) => {
    const { nodes } = get();
    const newNodes = { ...nodes };
    delete newNodes[nodeId];
    set({ nodes: newNodes });
  },

  setCursorPosition: (position: number) => {
    set({ cursorPosition: position });
  },

  setRememberedVisualX: (visualX: number | null) => {
    set({ rememberedVisualX: visualX });
  },

  createSiblingNode: (currentNodeId: string) => {
    const { nodes, rootNodeId, ancestorRegistry } = get();
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();
    const newNode: TreeNode = {
      id: newNodeId,
      type: 'task',
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
  },

  indentNode: (nodeId: string) => {
    const { nodes, rootNodeId, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const currentParentId = ancestors[ancestors.length - 1] || rootNodeId;
    const currentParent = nodes[currentParentId];
    if (!currentParent) return;

    const currentIndex = currentParent.children.indexOf(nodeId);
    if (currentIndex === 0) return;

    const newParentId = currentParent.children[currentIndex - 1];
    const newParent = nodes[newParentId];
    if (!newParent) return;

    const updatedCurrentParentChildren = currentParent.children.filter((id) => id !== nodeId);
    const updatedNewParentChildren = [...newParent.children, nodeId];

    const updatedNodes = {
      ...nodes,
      [currentParentId]: {
        ...currentParent,
        children: updatedCurrentParentChildren,
      },
      [newParentId]: {
        ...newParent,
        children: updatedNewParentChildren,
      },
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
    });
  },

  outdentNode: (nodeId: string) => {
    const { nodes, rootNodeId, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    if (ancestors.length === 0) return;

    const currentParentId = ancestors[ancestors.length - 1];
    if (currentParentId === rootNodeId) return;

    const currentParent = nodes[currentParentId];
    if (!currentParent) return;

    const grandparentId = ancestors[ancestors.length - 2] || rootNodeId;
    const grandparent = nodes[grandparentId];
    if (!grandparent) return;

    const updatedCurrentParentChildren = currentParent.children.filter((id) => id !== nodeId);
    const parentIndexInGrandparent = grandparent.children.indexOf(currentParentId);
    const updatedGrandparentChildren = [...grandparent.children];
    updatedGrandparentChildren.splice(parentIndexInGrandparent + 1, 0, nodeId);

    const updatedNodes = {
      ...nodes,
      [currentParentId]: {
        ...currentParent,
        children: updatedCurrentParentChildren,
      },
      [grandparentId]: {
        ...grandparent,
        children: updatedGrandparentChildren,
      },
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
    });
  },

  moveNodeUp: (nodeId: string) => {
    const { nodes, rootNodeId, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return;

    const currentIndex = parent.children.indexOf(nodeId);

    if (currentIndex > 0) {
      const updatedChildren = [...parent.children];
      [updatedChildren[currentIndex - 1], updatedChildren[currentIndex]] =
        [updatedChildren[currentIndex], updatedChildren[currentIndex - 1]];

      const updatedNodes = {
        ...nodes,
        [parentId]: {
          ...parent,
          children: updatedChildren,
        },
      };

      set({ nodes: updatedNodes });
    } else if (currentIndex === 0) {
      const grandparentId = ancestors[ancestors.length - 2] || rootNodeId;
      const grandparent = nodes[grandparentId];
      if (!grandparent) return;

      const parentIndexInGrandparent = grandparent.children.indexOf(parentId);
      if (parentIndexInGrandparent <= 0) return;

      const newParentId = grandparent.children[parentIndexInGrandparent - 1];
      const newParent = nodes[newParentId];
      if (!newParent) return;

      const updatedOldParentChildren = parent.children.filter((id) => id !== nodeId);
      const updatedNewParentChildren = [...newParent.children, nodeId];

      const updatedNodes = {
        ...nodes,
        [parentId]: {
          ...parent,
          children: updatedOldParentChildren,
        },
        [newParentId]: {
          ...newParent,
          children: updatedNewParentChildren,
        },
      };

      const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

      set({
        nodes: updatedNodes,
        ancestorRegistry: newAncestorRegistry,
      });
    }
  },

  moveNodeDown: (nodeId: string) => {
    const { nodes, rootNodeId, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return;

    const currentIndex = parent.children.indexOf(nodeId);
    if (currentIndex < 0) return;

    if (currentIndex < parent.children.length - 1) {
      const updatedChildren = [...parent.children];
      [updatedChildren[currentIndex], updatedChildren[currentIndex + 1]] =
        [updatedChildren[currentIndex + 1], updatedChildren[currentIndex]];

      const updatedNodes = {
        ...nodes,
        [parentId]: {
          ...parent,
          children: updatedChildren,
        },
      };

      set({ nodes: updatedNodes });
    } else if (currentIndex === parent.children.length - 1) {
      const grandparentId = ancestors[ancestors.length - 2] || rootNodeId;
      const grandparent = nodes[grandparentId];
      if (!grandparent) return;

      const parentIndexInGrandparent = grandparent.children.indexOf(parentId);
      if (parentIndexInGrandparent < 0 || parentIndexInGrandparent >= grandparent.children.length - 1) return;

      const newParentId = grandparent.children[parentIndexInGrandparent + 1];
      const newParent = nodes[newParentId];
      if (!newParent) return;

      const updatedOldParentChildren = parent.children.filter((id) => id !== nodeId);
      const updatedNewParentChildren = [nodeId, ...newParent.children];

      const updatedNodes = {
        ...nodes,
        [parentId]: {
          ...parent,
          children: updatedOldParentChildren,
        },
        [newParentId]: {
          ...newParent,
          children: updatedNewParentChildren,
        },
      };

      const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

      set({
        nodes: updatedNodes,
        ancestorRegistry: newAncestorRegistry,
      });
    }
  },
});
