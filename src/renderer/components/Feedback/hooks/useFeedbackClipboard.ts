import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import type { ContentSource } from '../../../store/tree/actions/sendActions';

export function useFeedbackClipboard(collaboratingNodeId: string | null) {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const hasFeedbackContent = useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    () => activeFilePath ? feedbackTreeStore.hasFeedback(activeFilePath) : false,
  );

  const handleFeedbackContent = useCallback(async (content: string, source: ContentSource, skipSave: boolean = false) => {
    if (!collaboratingNodeId) return;

    const collaboratingStore = storeManager.getAllStores().find(
      s => s.getState().collaboratingNodeId === collaboratingNodeId
    );
    if (!collaboratingStore) return;

    await collaboratingStore.getState().actions.processIncomingFeedbackContent(content, source, skipSave);
  }, [collaboratingNodeId]);

  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      handleFeedbackContent(content, 'clipboard');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  useEffect(() => {
    const cleanup = window.electron.onFeedbackFileContentDetected((filePath: string, content: string) => {
      for (const store of storeManager.getAllStores()) {
        const nodeId = store.getState().actions.findNodeIdByFeedbackFilePath?.(filePath);
        if (nodeId) {
          store.getState().actions.handleAutonomousFeedback?.(nodeId, content);
          return;
        }
      }

      handleFeedbackContent(content, 'file');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  useEffect(() => {
    if (!collaboratingNodeId && activeFilePath) {
      feedbackTreeStore.clearFile(activeFilePath);
    }
  }, [collaboratingNodeId, activeFilePath]);

  useEffect(() => {
    if (collaboratingNodeId && !hasFeedbackContent) {
      window.electron.startClipboardMonitor();
    } else {
      window.electron.stopClipboardMonitor();
    }

    return () => {
      window.electron.stopClipboardMonitor();
    };
  }, [collaboratingNodeId, hasFeedbackContent]);

  return hasFeedbackContent;
}
