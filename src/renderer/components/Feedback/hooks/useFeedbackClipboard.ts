import { useEffect, useState, useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import type { ContentSource } from '../../../store/tree/actions/collaborateActions';

export function useFeedbackClipboard(collaboratingNodeId: string | null) {
  const [hasFeedbackContent, setHasFeedbackContent] = useState<boolean>(false);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const handleFeedbackContent = useCallback(async (content: string, source: ContentSource, skipSave: boolean = false) => {
    if (!collaboratingNodeId || !activeFilePath) {
      return;
    }

    const store = storeManager.getStoreForFile(activeFilePath);
    const result = await store.getState().actions.processIncomingFeedbackContent(content, source, skipSave);
    if (result.success) {
      setHasFeedbackContent(true);
    }
  }, [collaboratingNodeId, activeFilePath]);

  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      handleFeedbackContent(content, 'clipboard');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  useEffect(() => {
    const cleanup = window.electron.onFeedbackFileContentDetected((content: string) => {
      handleFeedbackContent(content, 'file');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  useEffect(() => {
    if (!collaboratingNodeId && activeFilePath) {
      feedbackTreeStore.clearFile(activeFilePath);
      setHasFeedbackContent(false);
    }
  }, [collaboratingNodeId, activeFilePath]);

  useEffect(() => {
    if (collaboratingNodeId && activeFilePath && !hasFeedbackContent) {
      const feedbackStore = feedbackTreeStore.getStoreForFile(activeFilePath);
      if (feedbackStore) {
        try {
          const { nodes, rootNodeId } = feedbackStore.getState();
          const hasNodes = rootNodeId && nodes[rootNodeId]?.children?.length > 0;
          if (hasNodes) {
            setHasFeedbackContent(true);
          }
        } catch {
          // Store not ready yet
        }
      }
    }
  }, [collaboratingNodeId, activeFilePath, hasFeedbackContent]);

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
