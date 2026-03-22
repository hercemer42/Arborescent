import { watchFile, unwatchFile, Stats } from 'fs';
import { readFile } from 'fs/promises';
import { logger } from './logger';

interface WatchEntry {
  lastContent: string;
  lastMtime: number;
  onChange: (content: string) => void;
}

export class FeedbackFileWatcher {
  private watches = new Map<string, WatchEntry>();

  start(filePath: string, onChange: (content: string) => void): void {
    if (this.watches.has(filePath)) {
      this.stop(filePath);
    }

    this.watches.set(filePath, { lastContent: '', lastMtime: 0, onChange });

    try {
      watchFile(filePath, { interval: 500 }, (curr: Stats, prev: Stats) => {
        const entry = this.watches.get(filePath);
        if (!entry) return;
        if (curr.mtimeMs !== prev.mtimeMs && curr.mtimeMs !== entry.lastMtime) {
          entry.lastMtime = curr.mtimeMs;
          this.readAndNotify(filePath);
        }
      });

      logger.info(`Started watching file: ${filePath}`, 'FeedbackFileWatcher');
    } catch (error) {
      logger.error('Failed to start file watcher', error as Error, 'FeedbackFileWatcher');
      this.watches.delete(filePath);
    }
  }

  private async readAndNotify(filePath: string): Promise<void> {
    const entry = this.watches.get(filePath);
    if (!entry) return;

    try {
      const content = await readFile(filePath, 'utf-8');

      if (content !== entry.lastContent && content.length > 50) {
        entry.lastContent = content;
        logger.info(`Feedback file content changed: ${filePath}`, 'FeedbackFileWatcher');
        entry.onChange(content);
      }
    } catch (error) {
      logger.warn(`Failed to read watched file: ${(error as Error).message}`, 'FeedbackFileWatcher');
    }
  }

  stop(filePath?: string): void {
    if (!filePath) {
      // Manual collaboration path doesn't track its own watcher path
      filePath = this.watches.keys().next().value;
      if (!filePath) return;
    }

    if (this.watches.has(filePath)) {
      unwatchFile(filePath);
      this.watches.delete(filePath);
      logger.info(`Stopped watching file: ${filePath}`, 'FeedbackFileWatcher');
    }
  }

  getWatchedFilePath(): string | null {
    const firstPath = this.watches.keys().next().value;
    return firstPath ?? null;
  }

  getWatchedFilePaths(): string[] {
    return Array.from(this.watches.keys());
  }

  isRunning(): boolean {
    return this.watches.size > 0;
  }

  isWatching(filePath: string): boolean {
    return this.watches.has(filePath);
  }

  getWatchCount(): number {
    return this.watches.size;
  }
}

export const feedbackFileWatcher = new FeedbackFileWatcher();
