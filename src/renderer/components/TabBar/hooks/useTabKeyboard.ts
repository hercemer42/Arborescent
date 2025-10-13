import { useEffect } from 'react';
import { useTabsStore } from '../../../store/tabs/tabsStore';
import { storeManager } from '../../../store/storeManager';
import { matchesHotkey } from '../../../data/hotkeyConfig';

export function useTabKeyboard() {
  const closeActiveFile = useTabsStore((state) => state.closeActiveFile);
  const activeFilePath = useTabsStore((state) => state.activeFilePath);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (matchesHotkey(event, 'file', 'closeTab')) {
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
