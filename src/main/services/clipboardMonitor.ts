import { clipboard } from 'electron';
import { logger } from './logger';

/**
 * Clipboard monitor service
 * Monitors clipboard for content changes when collaboration is active
 * Sends all content to renderer which validates if it's parseable
 */
export class ClipboardMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private isMonitoring: boolean = false;
  private onChange: ((content: string) => void) | null = null;

  /**
   * Start monitoring clipboard for changes
   */
  start(onChange: (content: string) => void): void {
    if (this.isMonitoring) {
      logger.warn('Clipboard monitor already running', 'ClipboardMonitor');
      return;
    }

    this.onChange = onChange;
    this.isMonitoring = true;
    this.lastClipboardContent = clipboard.readText();

    // Check clipboard every 500ms
    this.intervalId = setInterval(() => {
      const current = clipboard.readText();

      if (current !== this.lastClipboardContent && current.length > 50) {
        this.lastClipboardContent = current;
        logger.info('Clipboard content changed, sending to renderer', 'ClipboardMonitor');
        this.onChange?.(current);
      }
    }, 500);

    logger.info('Clipboard monitor started', 'ClipboardMonitor');
  }

  /**
   * Stop monitoring clipboard
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isMonitoring = false;
    this.onChange = null;
    this.lastClipboardContent = '';

    logger.info('Clipboard monitor stopped', 'ClipboardMonitor');
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }
}

// Singleton instance
export const clipboardMonitor = new ClipboardMonitor();
