import { useCallback, useState, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

export type DropPosition = 'before' | 'after' | 'child';

export function useNodeDragDrop(nodeId: string, nodeRef: React.RefObject<HTMLDivElement | null>) {
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: nodeId,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: nodeId,
    data: {
      dropPosition: dropPosition,
    },
  });

  useEffect(() => {
    if (!isOver || !nodeRef.current) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!nodeRef.current) return;

      const rect = nodeRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      const topThreshold = height * 0.25;
      const bottomThreshold = height * 0.75;

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
      setDropPosition(null);
    };
  }, [isOver, nodeRef]);

  const setRefs = useCallback((element: HTMLDivElement | null) => {
    nodeRef.current = element;
    setDraggableRef(element);
    setDroppableRef(element);
  }, [nodeRef, setDraggableRef, setDroppableRef]);

  return {
    isDragging,
    isOver,
    dropPosition: isOver ? (dropPosition ?? 'child') : null,
    setRefs,
    attributes,
    listeners,
  };
}
