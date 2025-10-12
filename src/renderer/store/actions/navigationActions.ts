import { TreeNode } from '../../../shared/types';

export interface NavigationActions {
  moveUp: () => void;
  moveDown: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedCursorColumn: number | null;
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
      const { selectedNodeId, nodes, cursorPosition, rememberedCursorColumn } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;

      if (currentIndex > 0) {
        const nextNodeId = flatList[currentIndex - 1];
        const nextNode = nodes[nextNodeId];
        const nextNodeLength = nextNode?.content.length || 0;
        const targetColumn = rememberedCursorColumn ?? cursorPosition;
        const newCursorPosition = Math.min(targetColumn, nextNodeLength);

        set({
          selectedNodeId: nextNodeId,
          cursorPosition: newCursorPosition,
          rememberedCursorColumn: targetColumn,
        });
      }
    },

    moveDown: () => {
      const { selectedNodeId, nodes, cursorPosition, rememberedCursorColumn } = get();
      const flatList = getFlatNodeList();
      const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;

      if (currentIndex < flatList.length - 1) {
        const nextNodeId = flatList[currentIndex + 1];
        const nextNode = nodes[nextNodeId];
        const nextNodeLength = nextNode?.content.length || 0;
        const targetColumn = rememberedCursorColumn ?? cursorPosition;
        const newCursorPosition = Math.min(targetColumn, nextNodeLength);

        set({
          selectedNodeId: nextNodeId,
          cursorPosition: newCursorPosition,
          rememberedCursorColumn: targetColumn,
        });
      } else if (currentIndex === -1 && flatList.length > 0) {
        set({
          selectedNodeId: flatList[0],
          cursorPosition: 0,
          rememberedCursorColumn: null,
        });
      }
    },
  };
};
