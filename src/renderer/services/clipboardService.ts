import { logger } from './logger';

async function notifyMonitorOfSelfWrite(text: string, context: string): Promise<void> {
  try {
    await window.electron.recordClipboardSelfWrite(text);
  } catch (error) {
    logger.error('Failed to notify clipboard monitor of self-write', error as Error, context);
  }
}

export async function writeToClipboard(text: string, context: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    logger.info('Copied to clipboard', context);
    await notifyMonitorOfSelfWrite(text, context);
    return true;
  } catch (error) {
    logger.error('Failed to write to clipboard', error as Error, context);
    return false;
  }
}

export async function readFromClipboard(context: string): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch (error) {
    logger.error('Failed to read from clipboard', error as Error, context);
    return null;
  }
}
