import { create } from 'zustand';
import { Node, NodeStatus, NodeTypeConfig } from '../../shared/types';

interface TreeState {
  nodes: Record<string, Node>;
  rootNodeId: string;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  selectedNodeId: string | null;
  editingNodeId: string | null;

  initialize: (nodes: Record<string, Node>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  selectNode: (nodeId: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: () => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  deleteNode: (nodeId: string) => void;
}

export const useTreeStore = create<TreeState>((set) => ({
  nodes: {},
  rootNodeId: '',
  nodeTypeConfig: {},
  selectedNodeId: null,
  editingNodeId: null,

  initialize: (nodes, rootNodeId, nodeTypeConfig) => set({ nodes, rootNodeId, nodeTypeConfig }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  startEdit: (nodeId) => set({ editingNodeId: nodeId }),

  finishEdit: () => set({ editingNodeId: null }),

  updateContent: (nodeId, content) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...state.nodes[nodeId],
          content,
        },
      },
    })),

  updateStatus: (nodeId, status) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...state.nodes[nodeId],
          metadata: {
            ...state.nodes[nodeId].metadata,
            status,
          },
        },
      },
    })),

  deleteNode: (nodeId) =>
    set((state) => {
      const newNodes = { ...state.nodes };
      delete newNodes[nodeId];
      return { nodes: newNodes };
    }),
}));
