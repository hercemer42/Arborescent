import { setActiveStore as setActiveStoreShared, initializeMouseHandlers } from './shared';
import { initializeNavigationService } from './navigationService';
import { initializeEditingService } from './editingService';
import { initializeUIService } from './uiService';
import type { TreeStore } from '../../store/tree/treeStore';

/**
 * Main keyboard service entry point
 * Initializes navigation, editing, and UI services
 */

// Re-export setActiveStore for convenience
export function setActiveStore(store: TreeStore | null): void {
  setActiveStoreShared(store);
}

/**
 * Initializes all keyboard services (navigation, editing, UI, and mouse handlers)
 * @param target - The element to attach keyboard listeners to (defaults to window)
 */
export function initializeKeyboardServices(target: HTMLElement | Window = window): () => void {
  const cleanupNav = initializeNavigationService(target);
  const cleanupEdit = initializeEditingService(target);
  const cleanupUI = initializeUIService(target);
  const cleanupMouse = initializeMouseHandlers(target);

  // Return combined cleanup function
  return () => {
    cleanupNav();
    cleanupEdit();
    cleanupUI();
    cleanupMouse();
  };
}

// For backwards compatibility, export the old function name
export const initializeKeyboardNavigation = initializeKeyboardServices;

// Also export individual services if needed
export { initializeNavigationService } from './navigationService';
export { initializeEditingService } from './editingService';
export { initializeUIService } from './uiService';
export { resetRememberedPosition } from './shared';
