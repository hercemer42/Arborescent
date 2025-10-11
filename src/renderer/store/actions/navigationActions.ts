import { Node } from '../../../shared/types';

export interface NavigationActions {
  moveUp: () => void;
  moveDown: () => void;
}

type StoreState = { nodes: Record<string, Node>; rootNodeId: string; selectedNodeId: string | null };
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
        set({ selectedNodeId: flatList[currentIndex - 1] });
      }
    },

    moveDown: () => {
      const { selectedNodeId } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;
      if (currentIndex < flatList.length - 1) {
        set({ selectedNodeId: flatList[currentIndex + 1] });
      } else if (currentIndex === -1 && flatList.length > 0) {
        set({ selectedNodeId: flatList[0] });
      }
    },
  };
};
