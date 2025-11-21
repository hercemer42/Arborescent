import { logger } from '../services/logger';

/**
 * Utility for managing temporary review files
 * These files store review content during a review session to enable crash recovery
 */

/**
 * Compute a simple hash of the content for validation
 */
export function computeContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Save review content to a temporary file
 * Returns the file path and content hash
 */
export async function saveReviewContent(
  nodeId: string,
  content: string
): Promise<{ filePath: string; contentHash: string }> {
  try {
    const contentHash = computeContentHash(content);
    const fileName = `review-${nodeId}-${contentHash}.txt`;
    const filePath = await window.electron.saveReviewTempFile(fileName, content);

    logger.info(`Saved review content to temp file: ${filePath}`, 'ReviewTempFiles');

    return { filePath, contentHash };
  } catch (error) {
    logger.error('Failed to save review content', error as Error, 'ReviewTempFiles');
    throw error;
  }
}

/**
 * Load review content from a temporary file
 * Validates the content hash if provided
 */
export async function loadReviewContent(
  filePath: string,
  expectedHash?: string
): Promise<string | null> {
  try {
    const content = await window.electron.loadReviewTempFile(filePath);

    if (!content) {
      logger.warn(`Review temp file not found: ${filePath}`, 'ReviewTempFiles');
      return null;
    }

    // Validate hash if provided
    if (expectedHash) {
      const actualHash = computeContentHash(content);
      if (actualHash !== expectedHash) {
        logger.error(
          'Review content hash mismatch',
          new Error(`Expected ${expectedHash}, got ${actualHash}`),
          'ReviewTempFiles'
        );
        return null;
      }
    }

    logger.info(`Loaded review content from temp file: ${filePath}`, 'ReviewTempFiles');
    return content;
  } catch (error) {
    logger.error('Failed to load review content', error as Error, 'ReviewTempFiles');
    return null;
  }
}

/**
 * Delete a review temporary file
 */
export async function deleteReviewTempFile(filePath: string): Promise<void> {
  try {
    await window.electron.deleteReviewTempFile(filePath);
    logger.info(`Deleted review temp file: ${filePath}`, 'ReviewTempFiles');
  } catch (error) {
    logger.error('Failed to delete review temp file', error as Error, 'ReviewTempFiles');
  }
}
