import { LogLevel, LogEntry, LogMeta, Logger } from './LoggerInterface';

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

  debug(message: string, context?: string, meta?: LogMeta): void {
    this.log('debug', message, context, undefined, meta);
  }

  info(message: string, context?: string, meta?: LogMeta): void {
    this.log('info', message, context, undefined, meta);
  }

  warn(message: string, context?: string, meta?: LogMeta): void {
    this.log('warn', message, context, undefined, meta);
  }

  abstract error(message: string, error?: Error, context?: string, meta?: LogMeta): void;

  protected shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  protected log(
    level: LogLevel,
    message: string,
    context?: string,
    error?: Error,
    meta?: LogMeta,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
      nodeId: meta?.nodeId,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.shouldLog(level)) {
      this.output(level, message, context, error, meta);
    }
  }

  protected output(
    level: LogLevel,
    message: string,
    context?: string,
    error?: Error,
    meta?: LogMeta,
  ): void {
    const contextTag = context ? `[${context}]` : '';
    const nodeTag = meta?.nodeId ? `[node=${meta.nodeId}]` : '';
    const formattedMessage = `${contextTag}${nodeTag} ${message}`;

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
    return this.logs.map((entry) => formatLogEntry(entry)).join('\n');
  }
}

export function formatLogEntry(entry: LogEntry): string {
  const contextToken = entry.context ? `[${entry.context}] ` : '';
  const nodeToken = entry.nodeId ? `[node=${entry.nodeId}] ` : '';
  const errorTail = entry.error ? `\n${entry.error.stack}` : '';
  return `[${entry.timestamp.toISOString()}] ${entry.level.toUpperCase()} ${contextToken}${nodeToken}${entry.message}${errorTail}`;
}
