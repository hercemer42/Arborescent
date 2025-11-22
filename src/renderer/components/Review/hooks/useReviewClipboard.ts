import { useEffect, useState, useCallback } from 'react';
import { parseMarkdown } from '../../../utils/markdown';
import { logger } from '../../../services/logger';
import { saveReviewContent } from '../../../services/review/reviewTempFileService';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';
import { usePanelStore } from '../../../store/panel/panelStore';

/**
 * Hook to monitor clipboard and file watcher for valid Arborescent markdown content
 * Validates content by attempting to parse it and initializes the review tree store for the active file
 * Only accepts content that parses to exactly 1 root node
 */
export function useReviewClipboard(reviewingNodeId: string | null) {
  const [hasReviewContent, setHasReviewContent] = useState<boolean>(false);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const showReview = usePanelStore((state) => state.showReview);

  // Process review content from any source (clipboard or file)
  const processReviewContent = useCallback(async (content: string, source: 'clipboard' | 'file') => {
    logger.info(`Received ${source} content, attempting to parse`, 'ReviewClipboard');

    if (!reviewingNodeId) {
      logger.warn(`Received ${source} content but no node is being reviewed`, 'ReviewClipboard');
      return;
    }

    if (!activeFilePath) {
      logger.warn(`Received ${source} content but no active file`, 'ReviewClipboard');
      return;
    }

    // Try to parse the content - only accept if it parses successfully
    try {
      const { rootNodes, allNodes } = parseMarkdown(content);

      // Must parse to exactly 1 root node with valid structure
      if (rootNodes.length === 1) {
        logger.info(`Successfully parsed ${source} content as Arborescent markdown`, 'ReviewClipboard');

        // Create a hidden root node (like the main workspace) so the parsed root is visible
        const parsedRootNode = rootNodes[0];
        const hiddenRootId = 'review-root';
        const nodesWithHiddenRoot = {
          ...allNodes,
          [hiddenRootId]: {
            id: hiddenRootId,
            content: '',
            children: [parsedRootNode.id],
            metadata: {},
          },
        };

        // Initialize review store with hidden root containing the parsed tree
        reviewTreeStore.initialize(activeFilePath, nodesWithHiddenRoot, hiddenRootId);

        setHasReviewContent(true);
        logger.info(`Initialized review store with ${Object.keys(allNodes).length} nodes`, 'ReviewClipboard');

        // Show the review panel now that we have valid content
        showReview();

        // Save content to temp file and update node metadata
        try {
          const { filePath, contentHash } = await saveReviewContent(reviewingNodeId, content);

          // Update node metadata with temp file info
          if (activeFilePath) {
            const store = storeManager.getStoreForFile(activeFilePath);
            store.getState().actions.updateReviewMetadata(reviewingNodeId, filePath, contentHash);
          }
          logger.info('Saved review content to temp file and updated node metadata', 'ReviewClipboard');
        } catch (error) {
          logger.error('Failed to save review content to temp file', error as Error, 'ReviewClipboard');
        }
      } else if (rootNodes.length === 0) {
        logger.info(`${source} content does not contain valid Arborescent markdown (no nodes parsed)`, 'ReviewClipboard');
      } else {
        logger.info(`${source} content has ${rootNodes.length} root nodes, expected 1`, 'ReviewClipboard');
      }
    } catch {
      logger.info(`${source} content is not valid Arborescent markdown`, 'ReviewClipboard');
    }
  }, [reviewingNodeId, activeFilePath, showReview]);

  // Listen for clipboard content detection
  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      processReviewContent(content, 'clipboard');
    });

    return cleanup;
  }, [processReviewContent]);

  // Listen for file content detection (from terminal review workflow)
  useEffect(() => {
    const cleanup = window.electron.onReviewFileContentDetected((content: string) => {
      processReviewContent(content, 'file');
    });

    return cleanup;
  }, [processReviewContent]);

  // Clear review store for this file when review is cancelled
  useEffect(() => {
    if (!reviewingNodeId && activeFilePath) {
      reviewTreeStore.clearFile(activeFilePath);
      setHasReviewContent(false);
    }
  }, [reviewingNodeId, activeFilePath]);

  return hasReviewContent;
}
