import { useEffect } from 'react';
import { useTabsStore } from '../../../store/tabs/tabsStore';
import { storeManager } from '../../../store/storeManager';

export function useTabKeyboard() {
  const closeActiveFile = useTabsStore((state) => state.closeActiveFile);
  const activeFilePath = useTabsStore((state) => state.activeFilePath);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === 'w' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        if (activeFilePath) {
          await storeManager.closeFile(activeFilePath);
          closeActiveFile();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFilePath, closeActiveFile]);
}
