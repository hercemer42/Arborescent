import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';
import { getBrowserReviewNodeId } from '../../store/tree/reviews';

// Always-mounted, renders nothing. Hosts the clipboard monitor for the active file's exclusive
// browser review — the only review whose proposition arrives via the clipboard (terminal/MCP
// reviews deliver out-of-band) — so it is captured without a dedicated panel.
export function ClipboardReviewMonitor() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const browserReviewNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      return storeManager.getStoreForFile(activeFilePath).subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      return getBrowserReviewNodeId(storeManager.getStoreForFile(activeFilePath).getState().reviews);
    },
    () => null,
  );

  useFeedbackClipboard(browserReviewNodeId);

  return null;
}
