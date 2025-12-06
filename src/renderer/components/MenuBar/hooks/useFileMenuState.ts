import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

interface FileMenuState {
  hasActiveFile: boolean;
  hasBlueprintNodes: boolean;
}

/**
 * Hook to derive enabled/disabled states for File menu items.
 * Subscribes to relevant store state and returns boolean flags.
 */
export function useFileMenuState(): FileMenuState {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const hasBlueprintNodes = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return false;
      const store = storeManager.getStoreForFile(activeFilePath);
      const { nodes, rootNodeId } = store.getState();
      const rootNode = nodes[rootNodeId];
      if (!rootNode) return false;
      return rootNode.children.some((childId) => nodes[childId]?.metadata.isBlueprint);
    },
    () => false
  );

  return {
    hasActiveFile: activeFilePath !== null,
    hasBlueprintNodes,
  };
}
