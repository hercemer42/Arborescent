import { useSyncExternalStore, useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

export function useViewMenuState() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const subscribe = useCallback((callback: () => void) => {
    if (!activeFilePath) return () => {};
    const store = storeManager.getStoreForFile(activeFilePath);
    return store.subscribe(callback);
  }, [activeFilePath]);

  const blueprintModeEnabled = useSyncExternalStore(
    subscribe,
    () => {
      if (!activeFilePath) return false;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().blueprintModeEnabled;
    },
    () => false
  );

  const summaryModeEnabled = useSyncExternalStore(
    subscribe,
    () => {
      if (!activeFilePath) return false;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().summaryModeEnabled;
    },
    () => false
  );

  const handleToggleBlueprintMode = useCallback(() => {
    if (!activeFilePath) return;
    const store = storeManager.getStoreForFile(activeFilePath);
    store.getState().actions.toggleBlueprintMode();
  }, [activeFilePath]);

  const handleToggleSummaryMode = useCallback(() => {
    if (!activeFilePath) return;
    const store = storeManager.getStoreForFile(activeFilePath);
    store.getState().actions.toggleSummaryMode();
  }, [activeFilePath]);

  return {
    hasActiveFile: !!activeFilePath,
    blueprintModeEnabled,
    summaryModeEnabled,
    handleToggleBlueprintMode,
    handleToggleSummaryMode,
  };
}
