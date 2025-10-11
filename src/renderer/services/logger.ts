import { ToastType } from '../components/Toast';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
}

type ToastCallback = (message: string, type: ToastType) => void;

class Logger {
  private toastCallback?: ToastCallback;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  setToastCallback(callback: ToastCallback): void {
    this.toastCallback = callback;
  }

  debug(message: string, context?: string): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: string): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: string, showToast = false): void {
    this.log('warn', message, context);
    if (showToast && this.toastCallback) {
      this.toastCallback(message, 'warning');
    }
  }

  error(message: string, error?: Error, context?: string, showToast = true): void {
    this.log('error', message, context, error);
    if (showToast && this.toastCallback) {
      this.toastCallback(message, 'error');
    }
  }

  success(message: string, context?: string, showToast = true): void {
    this.log('info', message, context);
    if (showToast && this.toastCallback) {
      this.toastCallback(message, 'success');
    }
  }

  private log(level: LogLevel, message: string, context?: string, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const prefix = context ? `[${context}]` : '';
    const formattedMessage = `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        if (error) {
          console.error(formattedMessage, error);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return this.logs
      .map(
        (entry) =>
          `[${entry.timestamp.toISOString()}] ${entry.level.toUpperCase()} ${entry.context ? `[${entry.context}] ` : ''}${entry.message}${entry.error ? `\n${entry.error.stack}` : ''}`
      )
      .join('\n');
  }
}

export const logger = new Logger();
