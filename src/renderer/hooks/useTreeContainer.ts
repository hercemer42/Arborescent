import { useEffect, RefObject } from 'react';
import { registerTreeContainer, unregisterTreeContainer } from '../services/treeContainerRegistry';
import type { TreeStore } from '../store/tree/treeStore';

/**
 * Hook that registers a container element with a tree store.
 * This enables keyboard shortcut routing to the correct store.
 */
export function useTreeContainer(
  containerRef: RefObject<HTMLElement | null>,
  store: TreeStore | null
): void {
  useEffect(() => {
    if (!containerRef.current || !store) return;
    const container = containerRef.current;
    registerTreeContainer(container, store);
    return () => unregisterTreeContainer(container);
  }, [containerRef, store]);
}
