import { useCallback, useState, useMemo } from 'react';
import { DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { useStore } from '../../../store/tree/useStore';

// Fast drop animation for snappy feel
const dropAnimation = {
  duration: 150, // Very fast drop animation
  easing: 'ease',
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

export function useTreeDragDrop() {
  const store = useActiveTreeStore();
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement to avoid accidental drags
        delay: 0,    // No time delay - activates instantly once distance threshold is met
        tolerance: 0, // No wiggle room - activates immediately at distance threshold
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const { actions, selectedNodeIds } = store.getState();
    const draggedNodeId = active.id as string;

    // Set active ID for DragOverlay
    setActiveId(draggedNodeId);

    // If dragging a non-selected node, add it to selection for immediate visual feedback
    if (!selectedNodeIds.has(draggedNodeId)) {
      actions.addToSelection([draggedNodeId]);
    }
  }, [store]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const { actions, selectedNodeIds } = store.getState();

    // Clear active ID
    setActiveId(null);

    // Clear selection after any drag ends (even if invalid)
    const shouldClearSelection = selectedNodeIds.size > 0;

    if (!over || active.id === over.id) {
      if (shouldClearSelection) {
        actions.clearSelection();
      }
      return;
    }

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
    if (shouldClearSelection) {
      actions.clearSelection();
    }
  }, [store]);

  // Calculate depth of dragged node for DragOverlay
  const draggedNodeDepth = useMemo(() => {
    return activeId ? (ancestorRegistry[activeId]?.length || 0) : 0;
  }, [activeId, ancestorRegistry]);

  return {
    sensors,
    activeId,
    draggedNodeDepth,
    dropAnimation,
    handleDragStart,
    handleDragEnd,
  };
}
