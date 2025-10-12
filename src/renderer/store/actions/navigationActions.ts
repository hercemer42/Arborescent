import { TreeNode } from '../../../shared/types';

export interface NavigationActions {
  moveUp: () => void;
  moveDown: () => void;
  moveToPrevious: () => void;
  moveToNext: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

export const createNavigationActions = (
  get: () => StoreState,
  set: StoreSetter
): NavigationActions => {
  const getFlatNodeList = (): string[] => {
    const { nodes, rootNodeId } = get();
    const result: string[] = [];
    const traverse = (nodeId: string) => {
      result.push(nodeId);
      const node = nodes[nodeId];
      if (node && node.children.length > 0) {
        node.children.forEach((childId) => traverse(childId));
      }
    };
    traverse(rootNodeId);
    return result;
  };

  return {
    moveUp: () => {
      const { selectedNodeId } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;

      if (currentIndex > 0) {
        const nextNodeId = flatList[currentIndex - 1];
        set({
          selectedNodeId: nextNodeId,
        });
      }
    },

    moveDown: () => {
      const { selectedNodeId } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;

      if (currentIndex < flatList.length - 1) {
        const nextNodeId = flatList[currentIndex + 1];
        set({
          selectedNodeId: nextNodeId,
        });
      } else if (currentIndex === -1 && flatList.length > 0) {
        set({
          selectedNodeId: flatList[0],
          cursorPosition: 0,
          rememberedVisualX: null,
        });
      }
    },

    moveToPrevious: () => {
      const { selectedNodeId, nodes } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;

      if (currentIndex > 0) {
        const nextNodeId = flatList[currentIndex - 1];
        const nextNode = nodes[nextNodeId];
        set({
          selectedNodeId: nextNodeId,
          cursorPosition: nextNode?.content.length ?? 0,
          rememberedVisualX: null,
        });
      }
    },

    moveToNext: () => {
      const { selectedNodeId } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;

      if (currentIndex < flatList.length - 1) {
        const nextNodeId = flatList[currentIndex + 1];
        set({
          selectedNodeId: nextNodeId,
          cursorPosition: 0,
          rememberedVisualX: null,
        });
      }
    },
  };
};
