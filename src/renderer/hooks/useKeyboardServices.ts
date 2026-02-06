import { useEffect, RefObject } from 'react';
import { initializeNavigationService, initializeEditingService } from '../services/keyboard/keyboard';
import { initializeUIService } from '../services/keyboard/uiService';
import { KeyboardServicesOptions } from '../services/keyboard/types';

// Keyboard listeners don't survive HMR partial updates
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}

export function useKeyboardServices(
  containerRef: RefObject<HTMLElement | null>,
  options: KeyboardServicesOptions = {}
): void {
  const { includeUIService = false, isInitialized = true } = options;

  useEffect(() => {
    if (!containerRef.current || !isInitialized) return;
    
    const cleanupNav = initializeNavigationService(containerRef.current);
    const cleanupEdit = initializeEditingService(containerRef.current);
    
    return () => {
      cleanupNav();
      cleanupEdit();
    };
  }, [containerRef, isInitialized]);

  useEffect(() => {
    if (!includeUIService || !isInitialized) return;
    return initializeUIService(window);
  }, [includeUIService, isInitialized]);
}
