import { LogLevel, LogEntry, Logger } from './LoggerInterface';

export abstract class BaseLogger implements Logger {
  protected logs: LogEntry[] = [];
  protected maxLogs = 1000;

  debug(message: string, context?: string): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: string): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: string): void {
    this.log('warn', message, context);
  }

  abstract error(message: string, error?: Error, context?: string): void;

  protected log(level: LogLevel, message: string, context?: string, error?: Error): void {
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

    this.output(level, message, context, error);
  }

  protected output(level: LogLevel, message: string, context?: string, error?: Error): void {
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
