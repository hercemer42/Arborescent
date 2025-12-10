import { useEffect, RefObject } from 'react';
import { initializeNavigationService, initializeEditingService } from '../services/keyboard/keyboard';
import { initializeUIService } from '../services/keyboard/uiService';

// Keyboard listeners don't survive HMR partial updates
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}

export interface KeyboardServicesOptions {
  includeUIService?: boolean;
}

export function useKeyboardServices(
  containerRef: RefObject<HTMLElement | null>,
  options: KeyboardServicesOptions = {}
): void {
  const { includeUIService = false } = options;

  useEffect(() => {
    if (!containerRef.current) return;
    const cleanupNav = initializeNavigationService(containerRef.current);
    const cleanupEdit = initializeEditingService(containerRef.current);
    return () => {
      cleanupNav();
      cleanupEdit();
    };
  }, [containerRef]);

  useEffect(() => {
    if (!includeUIService) return;
    return initializeUIService(window);
  }, [includeUIService]);
}
