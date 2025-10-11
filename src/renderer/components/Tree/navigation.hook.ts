import { useEffect, useCallback } from 'react';
import { Node } from '../../../shared/types';
import { hotkeyService } from '../../services/hotkeyService';

export function useKeyboardNavigation(
  nodes: Record<string, Node>,
  rootNodeId: string,
  selectedNodeId: string | null,
  onSelectNode: (nodeId: string) => void
) {
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
      onSelectNode(flatList[currentIndex - 1]);
    }
  }, [selectedNodeId, getFlatNodeList, onSelectNode]);

  const moveDown = useCallback(() => {
    const flatList = getFlatNodeList();
    const currentIndex = selectedNodeId ? flatList.indexOf(selectedNodeId) : -1;
    if (currentIndex < flatList.length - 1) {
      onSelectNode(flatList[currentIndex + 1]);
    } else if (currentIndex === -1 && flatList.length > 0) {
      onSelectNode(flatList[0]);
    }
  }, [selectedNodeId, getFlatNodeList, onSelectNode]);

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
