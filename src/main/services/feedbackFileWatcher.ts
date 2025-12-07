import { watchFile, unwatchFile, Stats } from 'fs';
import { readFile } from 'fs/promises';
import { logger } from './logger';

/**
 * Feedback file watcher service
 * Watches a temp file for changes when terminal collaboration is active
 * Sends content to renderer when file changes
 */
export class FeedbackFileWatcher {
  private watchedFilePath: string | null = null;
  private lastContent: string = '';
  private lastMtime: number = 0;
  private onChange: ((content: string) => void) | null = null;

  /**
   * Start watching a file for changes
   */
  start(filePath: string, onChange: (content: string) => void): void {
    // Stop any existing watcher first
    this.stop();

    this.watchedFilePath = filePath;
    this.onChange = onChange;
    this.lastContent = '';
    this.lastMtime = 0;

    try {
      watchFile(filePath, { interval: 500 }, (curr: Stats, prev: Stats) => {
        if (curr.mtimeMs !== prev.mtimeMs && curr.mtimeMs !== this.lastMtime) {
          this.lastMtime = curr.mtimeMs;
          this.readAndNotify();
        }
      });

      logger.info(`Started watching file: ${filePath}`, 'FeedbackFileWatcher');
    } catch (error) {
      logger.error('Failed to start file watcher', error as Error, 'FeedbackFileWatcher');
    }
  }

  /**
   * Read file and notify if content changed
   */
  private async readAndNotify(): Promise<void> {
    if (!this.watchedFilePath || !this.onChange) return;

    try {
      const content = await readFile(this.watchedFilePath, 'utf-8');

      // Only notify if content actually changed and has meaningful length
      if (content !== this.lastContent && content.length > 50) {
        this.lastContent = content;
        logger.info('Feedback file content changed, sending to renderer', 'FeedbackFileWatcher');
        this.onChange(content);
      }
    } catch (error) {
      // File might not exist yet or be temporarily unavailable
      logger.warn(`Failed to read watched file: ${(error as Error).message}`, 'FeedbackFileWatcher');
    }
  }

  /**
   * Stop watching the file
   */
  stop(): void {
    if (this.watchedFilePath) {
      unwatchFile(this.watchedFilePath);
      logger.info(`Stopped watching file: ${this.watchedFilePath}`, 'FeedbackFileWatcher');
    }

    this.watchedFilePath = null;
    this.onChange = null;
    this.lastContent = '';
    this.lastMtime = 0;
  }

  /**
   * Get the currently watched file path
   */
  getWatchedFilePath(): string | null {
    return this.watchedFilePath;
  }

  /**
   * Check if watcher is running
   */
  isRunning(): boolean {
    return this.watchedFilePath !== null;
  }
}

// Singleton instance
export const feedbackFileWatcher = new FeedbackFileWatcher();
