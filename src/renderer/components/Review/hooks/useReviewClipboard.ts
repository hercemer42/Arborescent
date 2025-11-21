import { useEffect, useState } from 'react';
import { parseMarkdown, flattenNodes } from '../../../utils/markdownParser';
import { logger } from '../../../services/logger';
import { saveReviewContent } from '../../../utils/reviewTempFiles';
import { useStore } from '../../../store/tree/useStore';
import { useFilesStore } from '../../../store/files/filesStore';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';

/**
 * Hook to monitor clipboard for valid Arborescent markdown content
 * Validates content by attempting to parse it and initializes the review tree store for the active file
 * Only accepts content that parses to exactly 1 root node
 */
export function useReviewClipboard(reviewingNodeId: string | null) {
  const [hasReviewContent, setHasReviewContent] = useState<boolean>(false);
  const updateReviewMetadata = useStore((state) => state.actions.updateReviewMetadata);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  // Listen for clipboard content detection
  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected(async (content: string) => {
      logger.info('Received clipboard content, attempting to parse', 'ReviewClipboard');

      if (!reviewingNodeId) {
        logger.warn('Received clipboard content but no node is being reviewed', 'ReviewClipboard');
        return;
      }

      if (!activeFilePath) {
        logger.warn('Received clipboard content but no active file', 'ReviewClipboard');
        return;
      }

      // Try to parse the content - only accept if it parses successfully
      try {
        const parsed = parseMarkdown(content);

        // Must parse to exactly 1 root node with valid structure
        if (parsed.length === 1) {
          logger.info('Successfully parsed clipboard content as Arborescent markdown', 'ReviewClipboard');

          // Flatten nodes into a map and initialize review store for this file
          const rootNode = parsed[0];
          const nodesMap = flattenNodes(parsed);
          reviewTreeStore.initialize(activeFilePath, nodesMap, rootNode.id);

          setHasReviewContent(true);
          logger.info(`Initialized review store with ${Object.keys(nodesMap).length} nodes`, 'ReviewClipboard');

          // Save content to temp file and update node metadata
          try {
            const { filePath, contentHash } = await saveReviewContent(reviewingNodeId, content);

            // Update node metadata with temp file info
            updateReviewMetadata(reviewingNodeId, filePath, contentHash);
            logger.info('Saved review content to temp file and updated node metadata', 'ReviewClipboard');
          } catch (error) {
            logger.error('Failed to save review content to temp file', error as Error, 'ReviewClipboard');
          }
        } else if (parsed.length === 0) {
          logger.info('Clipboard content does not contain valid Arborescent markdown (no nodes parsed)', 'ReviewClipboard');
        } else {
          logger.info(`Clipboard content has ${parsed.length} root nodes, expected 1`, 'ReviewClipboard');
        }
      } catch {
        logger.info('Clipboard content is not valid Arborescent markdown', 'ReviewClipboard');
      }
    });

    return cleanup;
  }, [reviewingNodeId, activeFilePath, updateReviewMetadata]);

  // Clear review store for this file when review is cancelled
  useEffect(() => {
    if (!reviewingNodeId && activeFilePath) {
      reviewTreeStore.clearFile(activeFilePath);
      setHasReviewContent(false);
    }
  }, [reviewingNodeId, activeFilePath]);

  return hasReviewContent;
}
