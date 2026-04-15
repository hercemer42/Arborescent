import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import { useToastStore } from '../../../store/toast/toastStore';
import type { ContentSource } from '../../../store/tree/actions/sendActions';

function findActiveCollaboratingStore() {
  return storeManager.getAllStores().find(s => s.getState().collaboratingNodeId !== null);
}

export function useFeedbackClipboard(collaboratingNodeId: string | null) {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const hasFeedbackContent = useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    () => activeFilePath ? feedbackTreeStore.hasFeedback(activeFilePath) : false,
  );

  const handleFeedbackContent = useCallback(async (content: string, source: ContentSource, skipSave: boolean = false) => {
    const collaboratingStore = findActiveCollaboratingStore();
    if (!collaboratingStore) return;

    await collaboratingStore.getState().actions.processIncomingFeedbackContent(content, source, skipSave);
  }, []);

  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      handleFeedbackContent(content, 'clipboard');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  useEffect(() => {
    const cleanup = window.electron.onFeedbackFileContentDetected((filePath: string, content: string) => {
      for (const { filePath: storePath, store } of storeManager.getAllStoreEntries()) {
        const nodeId = store.getState().actions.findNodeIdByFeedbackFilePath?.(filePath);
        if (nodeId) {
          store.getState().actions.handleAutonomousFeedback?.(nodeId, content);
          if (activeFilePath && storePath !== activeFilePath) {
            useToastStore.getState().addToast('A session completed in another file', 'info');
          }
          return;
        }
      }

      handleFeedbackContent(content, 'file');
    });

    return cleanup;
  }, [handleFeedbackContent, activeFilePath]);

  useEffect(() => {
    if (collaboratingNodeId && !hasFeedbackContent) {
      window.electron.startClipboardMonitor();
    }

    return () => {
      // Switching files should not interrupt a session in another file.
      const anySessionActive = storeManager.getAllStores().some(
        s => s.getState().collaboratingNodeId !== null
      );
      if (!anySessionActive) {
        window.electron.stopClipboardMonitor();
      }
    };
  }, [collaboratingNodeId, hasFeedbackContent]);

  return hasFeedbackContent;
}
