import { useCallback } from 'react';
import { DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';

export function useTreeDragDrop() {
  const store = useActiveTreeStore();

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag (avoids conflicts with click)
      },
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const { actions, selectedNodeIds } = store.getState();
    const draggedNodeId = active.id as string;
    const targetNodeId = over.id as string;

    // Get drop position from the droppable's data
    const dropPosition = over.data.current?.dropPosition as 'before' | 'after' | 'child' | null;

    // Determine which nodes to move
    const nodesToMove = selectedNodeIds.has(draggedNodeId) && selectedNodeIds.size > 0
      ? actions.getNodesToMove()  // Move all selected nodes (filtered to avoid duplicates)
      : [draggedNodeId];           // Just move the dragged node

    // Move each node based on drop zone
    const dropZone = dropPosition || 'child';
    nodesToMove.forEach((nodeId) => {
      actions.dropNode(nodeId, targetNodeId, dropZone);
    });

    // Clear selection after drop
    if (selectedNodeIds.size > 0) {
      actions.clearSelection();
    }
  }, [store]);

  return {
    sensors,
    handleDragEnd,
  };
}
