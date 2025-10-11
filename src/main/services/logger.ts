import { BrowserWindow } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
}

class MainLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  debug(message: string, context?: string): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: string): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: string): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: string, notifyRenderer = true): void {
    this.log('error', message, context, error);

    if (notifyRenderer) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('main-error', message);
      }
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

export const logger = new MainLogger();
