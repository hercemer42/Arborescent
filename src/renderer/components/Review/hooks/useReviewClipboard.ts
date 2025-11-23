import { useEffect, useState, useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';
import { storeManager } from '../../../store/storeManager';
import type { ContentSource } from '../../../store/tree/actions/reviewActions';

/**
 * Hook to monitor clipboard and file watcher for valid Arborescent markdown content
 * Orchestrates between store methods and services to process incoming content
 */
export function useReviewClipboard(reviewingNodeId: string | null) {
  const [hasReviewContent, setHasReviewContent] = useState<boolean>(false);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  // Handle incoming review content from any source
  const handleReviewContent = useCallback(async (content: string, source: ContentSource, skipSave: boolean = false) => {
    if (!reviewingNodeId || !activeFilePath) {
      return;
    }

    const store = storeManager.getStoreForFile(activeFilePath);
    const result = await store.getState().actions.processIncomingReviewContent(content, source, skipSave);
    if (result.success) {
      setHasReviewContent(true);
    }
  }, [reviewingNodeId, activeFilePath]);

  // Listen for clipboard content detection
  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      handleReviewContent(content, 'clipboard');
    });

    return cleanup;
  }, [handleReviewContent]);

  // Listen for file content detection (from terminal review workflow)
  useEffect(() => {
    const cleanup = window.electron.onReviewFileContentDetected((content: string) => {
      handleReviewContent(content, 'file');
    });

    return cleanup;
  }, [handleReviewContent]);

  // Clear review store for this file when review is cancelled
  useEffect(() => {
    if (!reviewingNodeId && activeFilePath) {
      reviewTreeStore.clearFile(activeFilePath);
      setHasReviewContent(false);
    }
  }, [reviewingNodeId, activeFilePath]);

  // Check if review store already has content (e.g., restored by restoreReviewState)
  useEffect(() => {
    if (reviewingNodeId && activeFilePath && !hasReviewContent) {
      const reviewStore = reviewTreeStore.getStoreForFile(activeFilePath);
      if (reviewStore) {
        try {
          const { nodes, rootNodeId } = reviewStore.getState();
          const hasNodes = rootNodeId && nodes[rootNodeId]?.children?.length > 0;
          if (hasNodes) {
            setHasReviewContent(true);
          }
        } catch {
          // Store not ready yet
        }
      }
    }
  }, [reviewingNodeId, activeFilePath, hasReviewContent]);

  return hasReviewContent;
}
