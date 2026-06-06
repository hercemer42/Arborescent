import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';

// Always-mounted, renders nothing. Hosts the clipboard-review monitor for the active file's
// collaboration so browser and clipboard reviews are captured without a dedicated panel.
export function ClipboardReviewMonitor() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const collaboratingNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      return storeManager.getStoreForFile(activeFilePath).subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      return storeManager.getStoreForFile(activeFilePath).getState().collaboratingNodeId;
    },
    () => null,
  );

  useFeedbackClipboard(collaboratingNodeId);

  return null;
}
