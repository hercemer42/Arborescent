import { Node, NodeStatus } from '../../../shared/types';

export interface NodeActions {
  selectAndEdit: (nodeId: string) => void;
  saveNodeContent: (nodeId: string, content: string) => void;
  selectNode: (nodeId: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: () => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  deleteNode: (nodeId: string) => void;
}

type StoreState = { nodes: Record<string, Node>; selectedNodeId: string | null; editingNodeId: string | null };
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

export const createNodeActions = (
  get: () => StoreState,
  set: StoreSetter
): NodeActions => ({
  selectAndEdit: (nodeId: string) => {
    const { selectedNodeId, editingNodeId } = get();
    set({ selectedNodeId: nodeId });
    if (selectedNodeId === nodeId && !editingNodeId) {
      set({ editingNodeId: nodeId });
    }
  },

  saveNodeContent: (nodeId: string, content: string) => {
    const { nodes } = get();
    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...nodes[nodeId],
          content,
        },
      },
      editingNodeId: null,
    });
  },

  selectNode: (nodeId: string) => {
    set({ selectedNodeId: nodeId });
  },

  startEdit: (nodeId: string) => {
    set({ editingNodeId: nodeId });
  },

  finishEdit: () => {
    set({ editingNodeId: null });
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
});
