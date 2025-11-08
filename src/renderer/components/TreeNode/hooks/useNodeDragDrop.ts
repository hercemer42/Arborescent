import { useCallback, useState, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

export type DropPosition = 'before' | 'after' | 'child';

export function useNodeDragDrop(nodeId: string, nodeRef: React.RefObject<HTMLDivElement | null>) {
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  // Setup draggable
  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: nodeId,
  });

  // Setup droppable
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: nodeId,
    data: {
      dropPosition: dropPosition,
    },
  });

  // Track mouse movement to determine drop position
  useEffect(() => {
    if (!isOver || !nodeRef.current) {
      setDropPosition(null);
      return;
    }

    // Set default to 'child' immediately to avoid gap
    setDropPosition('child');

    const handleMouseMove = (e: MouseEvent) => {
      if (!nodeRef.current) return;

      const rect = nodeRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      // Calculate which zone we're in (35% top/bottom, 30% middle)
      const topThreshold = height * 0.35;
      const bottomThreshold = height * 0.65;

      if (y <= topThreshold) {
        setDropPosition('before');
      } else if (y >= bottomThreshold) {
        setDropPosition('after');
      } else {
        setDropPosition('child');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOver]);

  // Combine refs
  const setRefs = useCallback((element: HTMLDivElement | null) => {
    nodeRef.current = element;
    setDraggableRef(element);
    setDroppableRef(element);
  }, [setDraggableRef, setDroppableRef]);

  return {
    isDragging,
    isOver,
    dropPosition: isOver ? dropPosition : null,
    setRefs,
    attributes,
    listeners,
  };
}
