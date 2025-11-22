import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { TreeState } from '../../../store/tree/treeStore';

/**
 * Hook to access the active tree store from outside the TreeStoreContext.
 * Uses useSyncExternalStore to properly subscribe to store changes.
 */
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

/**
 * Hook to get just the actions from the active tree store.
 * Actions are stable references so this is safe to use in callbacks.
 */
export function useActiveTreeActions(): TreeState['actions'] | null {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  if (!activeFilePath) return null;
  const store = storeManager.getStoreForFile(activeFilePath);
  return store.getState().actions;
}
