import { useEffect, RefObject } from 'react';
import { registerTreeContainer, unregisterTreeContainer } from '../../../services/treeContainerRegistry';
import { initializeNavigationService, initializeEditingService } from '../../../services/keyboard/keyboard';
import type { TreeStore } from '../../../store/tree/treeStore';

export function useFeedbackKeyboard(
  containerRef: RefObject<HTMLDivElement | null>,
  store: TreeStore | null
): void {
  useEffect(() => {
    if (!containerRef.current || !store) return;
    const container = containerRef.current;
    registerTreeContainer(container, store);
    return () => unregisterTreeContainer(container);
  }, [containerRef, store]);

  // Navigation and editing services scoped to feedback container
  // UI service (cut/copy/paste) is handled globally by useWorkspaceKeyboard
  useEffect(() => {
    if (!containerRef.current) return;
    const cleanupNav = initializeNavigationService(containerRef.current);
    const cleanupEdit = initializeEditingService(containerRef.current);
    return () => {
      cleanupNav();
      cleanupEdit();
    };
  }, [containerRef]);
}
