import { useEffect, RefObject } from 'react';
import { registerTreeContainer, unregisterTreeContainer } from '../../../services/treeContainerRegistry';
import { initializeKeyboardServices } from '../../../services/keyboard/keyboard';
import type { TreeStore } from '../../../store/tree/treeStore';

export function useReviewKeyboard(
  containerRef: RefObject<HTMLDivElement | null>,
  store: TreeStore | null
): void {
  useEffect(() => {
    if (!containerRef.current || !store) return;
    const container = containerRef.current;
    registerTreeContainer(container, store);
    return () => unregisterTreeContainer(container);
  }, [containerRef, store]);

  useEffect(() => {
    if (!containerRef.current) return;
    return initializeKeyboardServices(containerRef.current);
  }, [containerRef]);
}
