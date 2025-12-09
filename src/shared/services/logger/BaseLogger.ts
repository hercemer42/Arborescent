import { LogLevel, LogEntry, Logger } from './LoggerInterface';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLogLevel(): LogLevel {
  // Check for explicit LOG_LEVEL env var first
  const envLevel = typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined;
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel;
  }

  // Default based on NODE_ENV
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
  return isDev ? 'debug' : 'warn';
}

export abstract class BaseLogger implements Logger {
  protected logs: LogEntry[] = [];
  protected maxLogs = 1000;
  protected minLevel: LogLevel = getMinLogLevel();

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

  protected shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  protected log(level: LogLevel, message: string, context?: string, error?: Error): void {
    // Always store in memory for debugging/export
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

    // Only output to console if level meets threshold
    if (this.shouldLog(level)) {
      this.output(level, message, context, error);
    }
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
