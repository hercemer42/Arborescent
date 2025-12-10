import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { TreeState } from '../../../store/tree/treeStore';

export function useActiveTreeStore(): TreeState | null {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  return useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState();
    },
    () => null
  );
}

export function useActiveTreeActions(): TreeState['actions'] | null {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  if (!activeFilePath) return null;
  const store = storeManager.getStoreForFile(activeFilePath);
  return store.getState().actions;
}
