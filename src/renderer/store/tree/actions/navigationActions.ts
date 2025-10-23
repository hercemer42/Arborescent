import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata, findPreviousVisibleNode, findNextVisibleNode } from '../../../utils/nodeHelpers';

export interface NavigationActions {
  moveUp: (cursorPosition?: number, rememberedVisualX?: number | null) => void;
  moveDown: (cursorPosition?: number, rememberedVisualX?: number | null) => void;
  moveBack: () => void;
  moveForward: () => void;
  toggleNode: (nodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function selectNode(
  nextNodeId: string,
  cursorPosition?: number,
  rememberedVisualX?: number | null
): Partial<StoreState> {
  const update: Partial<StoreState> = { selectedNodeId: nextNodeId };

  if (cursorPosition !== undefined) {
    update.cursorPosition = cursorPosition;
  }
  if (rememberedVisualX !== undefined) {
    update.rememberedVisualX = rememberedVisualX;
  }

  return update;
}

export const createNavigationActions = (
  get: () => StoreState,
  set: StoreSetter
): NavigationActions => {
  return {
    moveUp: (cursorPosition?: number, rememberedVisualX?: number | null) => {
      const { selectedNodeId, nodes, rootNodeId, ancestorRegistry } = get();
      if (!selectedNodeId) return;

      const nextNodeId = findPreviousVisibleNode(selectedNodeId, nodes, rootNodeId, ancestorRegistry);
      if (nextNodeId) {
        set(selectNode(nextNodeId, cursorPosition, rememberedVisualX));
      }
    },

    moveDown: (cursorPosition?: number, rememberedVisualX?: number | null) => {
      const { selectedNodeId, nodes, rootNodeId, ancestorRegistry } = get();
      if (!selectedNodeId) {
        const root = nodes[rootNodeId];
        if (root && root.children.length > 0) {
          set({
            selectedNodeId: root.children[0],
            cursorPosition: 0,
            rememberedVisualX: null,
          });
        }
        return;
      }

      const nextNodeId = findNextVisibleNode(selectedNodeId, nodes, rootNodeId, ancestorRegistry);
      if (nextNodeId) {
        set(selectNode(nextNodeId, cursorPosition, rememberedVisualX));
      }
    },

    moveBack: () => {
      const { selectedNodeId, nodes, rootNodeId, ancestorRegistry } = get();
      if (!selectedNodeId) return;

      const nextNodeId = findPreviousVisibleNode(selectedNodeId, nodes, rootNodeId, ancestorRegistry);
      if (nextNodeId) {
        const nextNode = nodes[nextNodeId];
        set({
          selectedNodeId: nextNodeId,
          cursorPosition: nextNode?.content.length ?? 0,
          rememberedVisualX: null,
        });
      }
    },

    moveForward: () => {
      const { selectedNodeId, nodes, rootNodeId, ancestorRegistry } = get();
      if (!selectedNodeId) return;

      const nextNodeId = findNextVisibleNode(selectedNodeId, nodes, rootNodeId, ancestorRegistry);
      if (nextNodeId) {
        set({
          selectedNodeId: nextNodeId,
          cursorPosition: 0,
          rememberedVisualX: null,
        });
      }
    },

    toggleNode: (nodeId: string) => {
      const { nodes } = get();
      const node = nodes[nodeId];
      if (!node) return;

      const newExpanded = !(node.metadata.expanded ?? true);
      const updatedNodes = updateNodeMetadata(nodes, nodeId, { expanded: newExpanded });
      set({
        nodes: updatedNodes,
      });
    },
  };
};
