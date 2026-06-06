import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import { useToastStore } from '../../../store/toast/toastStore';
import { resolveToSourceFilePath } from '../../../utils/zoomPath';
import type { ContentSource } from '../../../store/tree/actions/sendActions';

function findActiveCollaboratingEntry() {
  return storeManager
    .getAllStoreEntries()
    .find((entry) => entry.store.getState().collaboratingNodeId !== null);
}

function displayNameFor(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export function useFeedbackClipboard(collaboratingNodeId: string | null) {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const hasFeedbackContent = useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    () => activeFilePath ? feedbackTreeStore.hasFeedback(activeFilePath) : false,
  );

  const handleClipboardFeedback = useCallback(async (content: string, source: ContentSource) => {
    const entry = findActiveCollaboratingEntry();
    if (!entry) return;

    const ownerFilePath = entry.filePath;
    const isOwnerActive = ownerFilePath === resolveToSourceFilePath(activeFilePath);

    await entry.store.getState().actions.processIncomingFeedbackContent(content, source);

    if (!isOwnerActive) {
      useToastStore.getState().addToast(
        `Feedback ready in ${displayNameFor(ownerFilePath)}`,
        'info',
      );
    }
  }, [activeFilePath]);

  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      void handleClipboardFeedback(content, 'clipboard');
    });

    return cleanup;
  }, [handleClipboardFeedback]);

  useEffect(() => {
    if (collaboratingNodeId && !hasFeedbackContent) {
      void window.electron.startClipboardMonitor();
    }

    return () => {
      // Switching files should not interrupt a session in another file.
      const anySessionActive = storeManager.getAllStores().some(
        s => s.getState().collaboratingNodeId !== null
      );
      if (!anySessionActive) {
        void window.electron.stopClipboardMonitor();
      }
    };
  }, [collaboratingNodeId, hasFeedbackContent]);

  return hasFeedbackContent;
}
