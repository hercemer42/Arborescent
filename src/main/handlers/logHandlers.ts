import { ipcMain } from 'electron';
import { logger, openLogFile, getLogFilePath } from '../services/logger';
import type { LogLevel } from '../../shared/services/logger/LoggerInterface';

interface AppendLogPayload {
  level: LogLevel;
  message: string;
  context?: string;
  nodeId?: string;
  errorStack?: string;
}

const MAX_FIELD_LEN = 64 * 1024;

function isValidLevel(level: unknown): level is LogLevel {
  return level === 'debug' || level === 'info' || level === 'warn' || level === 'error';
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > MAX_FIELD_LEN ? value.slice(0, MAX_FIELD_LEN) : value;
}

export function registerLogHandlers(): void {
  ipcMain.handle('log:append', async (_event, payload: AppendLogPayload) => {
    if (!payload || !isValidLevel(payload.level) || typeof payload.message !== 'string') {
      return;
    }
    const message = payload.message.length > MAX_FIELD_LEN
      ? payload.message.slice(0, MAX_FIELD_LEN)
      : payload.message;
    const context = asTrimmedString(payload.context);
    const nodeId = asTrimmedString(payload.nodeId);
    const errorStack = asTrimmedString(payload.errorStack);
    const meta = nodeId ? { nodeId } : undefined;
    const taggedContext = context ? `Renderer:${context}` : 'Renderer';

    switch (payload.level) {
      case 'debug':
        logger.debug(message, taggedContext, meta);
        break;
      case 'info':
        logger.info(message, taggedContext, meta);
        break;
      case 'warn':
        logger.warn(message, taggedContext, meta);
        break;
      case 'error': {
        const error = errorStack ? new Error(errorStack) : undefined;
        logger.error(message, error, taggedContext, meta, false);
        break;
      }
    }
  });

  ipcMain.handle('log:open', async () => {
    await openLogFile();
  });

  ipcMain.handle('log:get-path', async () => {
    return getLogFilePath();
  });
}
