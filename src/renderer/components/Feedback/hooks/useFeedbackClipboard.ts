import { useEffect, useState, useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import type { ContentSource } from '../../../store/tree/actions/collaborateActions';

/**
 * Hook to monitor clipboard and file watcher for valid Arborescent markdown content
 * Orchestrates between store methods and services to process incoming content
 */
export function useFeedbackClipboard(collaboratingNodeId: string | null) {
  const [hasFeedbackContent, setHasFeedbackContent] = useState<boolean>(false);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  // Handle incoming feedback content from any source
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

  // Listen for clipboard content detection
  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      handleFeedbackContent(content, 'clipboard');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  // Listen for file content detection (from terminal collaboration workflow)
  useEffect(() => {
    const cleanup = window.electron.onFeedbackFileContentDetected((content: string) => {
      handleFeedbackContent(content, 'file');
    });

    return cleanup;
  }, [handleFeedbackContent]);

  // Clear feedback store for this file when collaboration is cancelled
  useEffect(() => {
    if (!collaboratingNodeId && activeFilePath) {
      feedbackTreeStore.clearFile(activeFilePath);
      setHasFeedbackContent(false);
    }
  }, [collaboratingNodeId, activeFilePath]);

  // Check if feedback store already has content (e.g., restored by restoreFeedbackState)
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

  // Manage clipboard monitor based on collaboration state
  // Start when we have a collaboration awaiting content, stop when we have content
  useEffect(() => {
    if (collaboratingNodeId && !hasFeedbackContent) {
      // Collaboration in progress but no content yet - start monitoring
      window.electron.startClipboardMonitor();
    } else {
      // Either no collaboration or already have content - stop monitoring
      window.electron.stopClipboardMonitor();
    }

    return () => {
      // Cleanup: stop monitoring when unmounting
      window.electron.stopClipboardMonitor();
    };
  }, [collaboratingNodeId, hasFeedbackContent]);

  return hasFeedbackContent;
}
