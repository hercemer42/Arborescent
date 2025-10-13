import { useEffect, useCallback } from 'react';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { storeManager } from '../../store/storeManager';
import { hotkeyService } from '../../services/hotkeyService';

export function useTabListeners() {
  const closeActiveFile = useTabsStore((state) => state.closeActiveFile);
  const activeFilePath = useTabsStore((state) => state.activeFilePath);

  const handleCloseTab = useCallback(async () => {
    if (activeFilePath) {
      await storeManager.closeFile(activeFilePath);
      closeActiveFile();
    }
  }, [activeFilePath, closeActiveFile]);

  useEffect(() => {
    const unregisterCloseTab = hotkeyService.register('file.closeTab', handleCloseTab);

    return () => {
      unregisterCloseTab();
    };
  }, [handleCloseTab]);
}
