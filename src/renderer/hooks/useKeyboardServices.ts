import { useEffect, RefObject } from 'react';
import { initializeNavigationService, initializeEditingService } from '../services/keyboard/keyboard';
import { initializeUIService } from '../services/keyboard/uiService';

// Force full reload on HMR - keyboard event listeners don't survive partial updates cleanly
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}

export interface KeyboardServicesOptions {
  /** Include global UI service (cut/copy/paste, save, etc.). Default: false */
  includeUIService?: boolean;
}

/**
 * Hook that initializes keyboard navigation and editing services for a container.
 * Optionally includes the global UI service for clipboard operations.
 */
export function useKeyboardServices(
  containerRef: RefObject<HTMLElement | null>,
  options: KeyboardServicesOptions = {}
): void {
  const { includeUIService = false } = options;

  // Navigation and editing services scoped to container
  useEffect(() => {
    if (!containerRef.current) return;
    const cleanupNav = initializeNavigationService(containerRef.current);
    const cleanupEdit = initializeEditingService(containerRef.current);
    return () => {
      cleanupNav();
      cleanupEdit();
    };
  }, [containerRef]);

  // UI service (cut/copy/paste, save, etc.) works globally
  useEffect(() => {
    if (!includeUIService) return;
    return initializeUIService(window);
  }, [includeUIService]);
}
