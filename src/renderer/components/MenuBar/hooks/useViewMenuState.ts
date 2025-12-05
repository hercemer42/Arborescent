import { useSyncExternalStore, useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

export function useViewMenuState() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const blueprintModeEnabled = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return false;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().blueprintModeEnabled;
    },
    () => false
  );

  const handleToggleBlueprintMode = useCallback(() => {
    if (!activeFilePath) return;
    const store = storeManager.getStoreForFile(activeFilePath);
    store.getState().actions.toggleBlueprintMode();
  }, [activeFilePath]);

  return {
    hasActiveFile: !!activeFilePath,
    blueprintModeEnabled,
    handleToggleBlueprintMode,
  };
}
