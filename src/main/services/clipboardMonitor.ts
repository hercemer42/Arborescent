import { clipboard } from 'electron';
import { logger } from './logger';

export class ClipboardMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private isMonitoring: boolean = false;
  private onChange: ((content: string) => void) | null = null;

  start(onChange: (content: string) => void): void {
    if (this.isMonitoring) {
      logger.warn('Clipboard monitor already running', 'ClipboardMonitor');
      return;
    }

    this.onChange = onChange;
    this.isMonitoring = true;
    this.lastClipboardContent = clipboard.readText();

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

  isRunning(): boolean {
    return this.isMonitoring;
  }
}

export const clipboardMonitor = new ClipboardMonitor();
