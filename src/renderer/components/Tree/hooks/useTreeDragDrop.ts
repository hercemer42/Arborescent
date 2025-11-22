import { useCallback, useState, useMemo } from 'react';
import { DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { useStore } from '../../../store/tree/useStore';
import { isValidDrop, DropZone } from '../../../utils/nodeHelpers';

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
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);

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
    const { actions, multiSelectedNodeIds } = store.getState();
    const draggedNodeId = active.id as string;

    // Set active ID for DragOverlay
    setActiveId(draggedNodeId);

    // If dragging a non-selected node, add it to selection for immediate visual feedback
    if (!multiSelectedNodeIds.has(draggedNodeId)) {
      actions.addToSelection([draggedNodeId]);
    }

    // Get all nodes that will be moved (for display in DragOverlay)
    const nodesToMove = actions.getNodesToMove();
    setDraggedNodeIds(nodesToMove);
  }, [store]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const { actions, multiSelectedNodeIds, ancestorRegistry } = store.getState();

    // Clear drag state
    setActiveId(null);
    setDraggedNodeIds([]);

    const shouldClearSelection = multiSelectedNodeIds.size > 0;

    // Early exit for invalid drops
    if (!over || active.id === over.id) {
      if (shouldClearSelection) {
        actions.clearSelection();
      }
      return;
    }

    const draggedNodeId = active.id as string;
    const targetNodeId = over.id as string;
    const dropPosition = over.data.current?.dropPosition as DropZone | null;
    const dropZone = dropPosition || 'child';

    // Determine which nodes to move
    const nodesToMove = multiSelectedNodeIds.has(draggedNodeId) && multiSelectedNodeIds.size > 0
      ? actions.getNodesToMove()
      : [draggedNodeId];

    // Execute validated drops
    nodesToMove.forEach((nodeId) => {
      if (isValidDrop(nodeId, targetNodeId, dropZone, nodesToMove, ancestorRegistry)) {
        actions.dropNode(nodeId, targetNodeId, dropZone);
      }
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
    draggedNodeIds,
    draggedNodeDepth,
    dropAnimation,
    handleDragStart,
    handleDragEnd,
  };
}
