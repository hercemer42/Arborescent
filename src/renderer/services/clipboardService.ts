import { logger } from './logger';

/**
 * Service for clipboard operations with consistent error handling and logging.
 */

/**
 * Write text to clipboard.
 * @returns true if successful, false on error
 */
export async function writeToClipboard(text: string, context: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    logger.info(`Copied to clipboard`, context);
    return true;
  } catch (error) {
    logger.error('Failed to write to clipboard', error as Error, context);
    return false;
  }
}

/**
 * Read text from clipboard.
 * @returns clipboard text, or null on error
 */
export async function readFromClipboard(context: string): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch (error) {
    logger.error('Failed to read from clipboard', error as Error, context);
    return null;
  }
}
