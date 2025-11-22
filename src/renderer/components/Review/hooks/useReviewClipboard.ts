import { useEffect, useState, useCallback, useRef } from 'react';
import { logger } from '../../../services/logger';
import { loadReviewContent } from '../../../services/review/reviewTempFileService';
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
  const hasAttemptedRestore = useRef<string | null>(null);

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
      hasAttemptedRestore.current = null;
    }
  }, [reviewingNodeId, activeFilePath]);

  // Restore review content from temp file on app restart
  // This runs when reviewingNodeId is set but we don't have content yet
  useEffect(() => {
    if (!reviewingNodeId || !activeFilePath || hasReviewContent) {
      return;
    }

    // Only attempt restore once per reviewingNodeId
    if (hasAttemptedRestore.current === reviewingNodeId) {
      return;
    }
    hasAttemptedRestore.current = reviewingNodeId;

    // Check node metadata for temp file info
    const store = storeManager.getStoreForFile(activeFilePath);
    const node = store.getState().nodes[reviewingNodeId];

    if (!node?.metadata.reviewTempFile || !node?.metadata.reviewContentHash) {
      logger.info('No temp file metadata to restore from', 'ReviewClipboard');
      return;
    }

    // Load and process the content
    loadReviewContent(
      node.metadata.reviewTempFile as string,
      node.metadata.reviewContentHash as string
    ).then((content) => {
      if (content) {
        logger.info('Restoring review content from temp file', 'ReviewClipboard');
        handleReviewContent(content, 'restore', true);
      } else {
        logger.warn('Failed to load review content from temp file', 'ReviewClipboard');
      }
    }).catch((error) => {
      logger.error('Failed to restore review content', error as Error, 'ReviewClipboard');
    });
  }, [reviewingNodeId, activeFilePath, hasReviewContent, handleReviewContent]);

  return hasReviewContent;
}
