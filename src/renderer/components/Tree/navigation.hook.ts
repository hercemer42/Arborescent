import { useEffect, useCallback } from 'react';
import { hotkeyService } from '../../services/hotkeyService';
import { useTreeStore } from '../../store/treeStore';

export function useKeyboardNavigation() {
  const nodes = useTreeStore((state) => state.nodes);
  const rootNodeId = useTreeStore((state) => state.rootNodeId);
  const selectedNodeId = useTreeStore((state) => state.selectedNodeId);
  const selectNode = useTreeStore((state) => state.selectNode);

  const getFlatNodeList = useCallback((): string[] => {
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
  }, [nodes, rootNodeId]);

  const moveUp = useCallback(() => {
    const flatList = getFlatNodeList();
    const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;
    if (currentIndex > 0) {
      selectNode(flatList[currentIndex - 1]);
    }
  }, [selectedNodeId, getFlatNodeList, selectNode]);

  const moveDown = useCallback(() => {
    const flatList = getFlatNodeList();
    const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;
    if (currentIndex < flatList.length - 1) {
      selectNode(flatList[currentIndex + 1]);
    } else if (currentIndex === -1 && flatList.length > 0) {
      selectNode(flatList[0]);
    }
  }, [selectedNodeId, getFlatNodeList, selectNode]);

  useEffect(() => {
    const unregisterUp = hotkeyService.register('navigation.moveUp', moveUp);
    const unregisterDown = hotkeyService.register('navigation.moveDown', moveDown);

    const handleKeyDown = (event: KeyboardEvent) => {
      hotkeyService.handleKeyDown(event);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unregisterUp();
      unregisterDown();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moveUp, moveDown]);
}
