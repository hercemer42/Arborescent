import { watchFile, unwatchFile, Stats } from 'fs';
import { readFile } from 'fs/promises';
import { logger } from './logger';

export class FeedbackFileWatcher {
  private watchedFilePath: string | null = null;
  private lastContent: string = '';
  private lastMtime: number = 0;
  private onChange: ((content: string) => void) | null = null;

  start(filePath: string, onChange: (content: string) => void): void {
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

  private async readAndNotify(): Promise<void> {
    if (!this.watchedFilePath || !this.onChange) return;

    try {
      const content = await readFile(this.watchedFilePath, 'utf-8');

      if (content !== this.lastContent && content.length > 50) {
        this.lastContent = content;
        logger.info('Feedback file content changed, sending to renderer', 'FeedbackFileWatcher');
        this.onChange(content);
      }
    } catch (error) {
      logger.warn(`Failed to read watched file: ${(error as Error).message}`, 'FeedbackFileWatcher');
    }
  }

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

  getWatchedFilePath(): string | null {
    return this.watchedFilePath;
  }

  isRunning(): boolean {
    return this.watchedFilePath !== null;
  }
}

export const feedbackFileWatcher = new FeedbackFileWatcher();
