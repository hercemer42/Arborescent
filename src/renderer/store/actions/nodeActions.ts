import { TreeNode, NodeStatus } from '../../../shared/types';
import { AncestorRegistry } from '../../services/registryService';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  deleteNode: (nodeId: string) => void;
  setCursorPosition: (position: number) => void;
  setRememberedCursorColumn: (column: number | null) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedCursorColumn: number | null;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

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

  setRememberedCursorColumn: (column: number | null) => {
    set({ rememberedCursorColumn: column });
  },
});
