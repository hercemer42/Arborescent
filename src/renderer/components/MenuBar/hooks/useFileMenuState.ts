import { useFilesStore } from '../../../store/files/filesStore';

interface FileMenuState {
  hasActiveFile: boolean;
}

/**
 * Hook to derive enabled/disabled states for File menu items.
 * Subscribes to relevant store state and returns boolean flags.
 */
export function useFileMenuState(): FileMenuState {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  return {
    hasActiveFile: activeFilePath !== null,
  };
}
