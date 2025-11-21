import { useEffect, useState } from 'react';
import { parseMarkdown } from '../../../utils/markdownParser';
import { logger } from '../../../services/logger';

/**
 * Hook to monitor clipboard for valid Arborescent markdown content
 * Validates content by attempting to parse it
 * Only accepts content that parses to exactly 1 root node
 */
export function useReviewClipboard(reviewingNodeId: string | null) {
  const [reviewedContent, setReviewedContent] = useState<string | null>(null);

  // Listen for clipboard content detection
  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      logger.info('Received clipboard content, attempting to parse', 'ReviewClipboard');

      // Try to parse the content - only accept if it parses successfully
      try {
        const parsed = parseMarkdown(content);

        // Must parse to exactly 1 root node with valid structure
        if (parsed.length === 1) {
          logger.info('Successfully parsed clipboard content as Arborescent markdown', 'ReviewClipboard');
          setReviewedContent(content);
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
  }, []);

  // Clear reviewed content when review is cancelled
  useEffect(() => {
    if (!reviewingNodeId) {
      setReviewedContent(null);
    }
  }, [reviewingNodeId]);

  return reviewedContent;
}
