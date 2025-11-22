import { useEffect, RefObject } from 'react';
import { registerTreeContainer, unregisterTreeContainer } from '../../../services/treeContainerRegistry';
import { initializeNavigationService, initializeEditingService } from '../../../services/keyboard/keyboard';
import { initializeUIService } from '../../../services/keyboard/uiService';
import type { TreeStore } from '../../../store/tree/treeStore';

export function useWorkspaceKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  store: TreeStore | null
): void {
  useEffect(() => {
    if (!containerRef.current || !store) return;
    const container = containerRef.current;
    registerTreeContainer(container, store);
    return () => unregisterTreeContainer(container);
  }, [containerRef, store]);

  // Navigation and editing services need to be scoped to workspace container
  useEffect(() => {
    if (!containerRef.current) return;
    const cleanupNav = initializeNavigationService(containerRef.current);
    const cleanupEdit = initializeEditingService(containerRef.current);
    return () => {
      cleanupNav();
      cleanupEdit();
    };
  }, [containerRef]);

  // UI service (cut/copy/paste, save, etc.) should work globally
  // even when focus is outside workspace (e.g., after multi-selection blur)
  useEffect(() => {
    return initializeUIService(window);
  }, []);
}
