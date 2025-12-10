import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

export function useBlueprintModeStatus(): boolean {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  return useSyncExternalStore(
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
}
