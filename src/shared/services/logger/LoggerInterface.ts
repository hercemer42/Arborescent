export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  nodeId?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
  nodeId?: string;
}

export interface Logger {
  debug(message: string, context?: string, meta?: LogMeta): void;
  info(message: string, context?: string, meta?: LogMeta): void;
  warn(message: string, context?: string, meta?: LogMeta): void;
  error(message: string, error?: Error, context?: string, meta?: LogMeta): void;
  exportLogs(): string;
}
