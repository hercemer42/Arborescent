import { logger } from '../logger';

/**
 * Service for managing temporary feedback files
 * These files store feedback content during a collaboration session to enable crash recovery
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
 * Save feedback content to a temporary file
 * Returns the file path and content hash
 */
export async function saveFeedbackContent(
  nodeId: string,
  content: string
): Promise<{ filePath: string; contentHash: string }> {
  try {
    const contentHash = computeContentHash(content);
    const fileName = `feedback-${nodeId}-${contentHash}.txt`;
    const filePath = await window.electron.createTempFile(fileName, content);

    logger.info(`Saved feedback content to temp file: ${filePath}`, 'FeedbackTempFileService');

    return { filePath, contentHash };
  } catch (error) {
    logger.error('Failed to save feedback content', error as Error, 'FeedbackTempFileService');
    throw error;
  }
}

/**
 * Load feedback content from a temporary file
 * Validates the content hash if provided
 */
export async function loadFeedbackContent(
  filePath: string,
  expectedHash?: string
): Promise<string | null> {
  try {
    const content = await window.electron.readTempFile(filePath);

    if (!content) {
      logger.warn(`Feedback temp file not found: ${filePath}`, 'FeedbackTempFileService');
      return null;
    }

    // Validate hash if provided
    if (expectedHash) {
      const actualHash = computeContentHash(content);
      if (actualHash !== expectedHash) {
        logger.error(
          'Feedback content hash mismatch',
          new Error(`Expected ${expectedHash}, got ${actualHash}`),
          'FeedbackTempFileService'
        );
        return null;
      }
    }

    logger.info(`Loaded feedback content from temp file: ${filePath}`, 'FeedbackTempFileService');
    return content;
  } catch (error) {
    logger.error('Failed to load feedback content', error as Error, 'FeedbackTempFileService');
    return null;
  }
}

/**
 * Delete a feedback temporary file
 */
export async function deleteFeedbackTempFile(filePath: string): Promise<void> {
  try {
    await window.electron.deleteTempFile(filePath);
    logger.info(`Deleted feedback temp file: ${filePath}`, 'FeedbackTempFileService');
  } catch (error) {
    logger.error('Failed to delete feedback temp file', error as Error, 'FeedbackTempFileService');
  }
}
