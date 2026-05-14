import path from 'node:path';
import fs from 'node:fs';
import { BaseLogger, formatLogEntry } from '../../shared/services/logger/BaseLogger';
import type { LogEntry, LogLevel, LogMeta } from '../../shared/services/logger/LoggerInterface';

let electronModule: typeof import('electron') | null = null;

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ROTATED_FILES = 3;
const LOG_DIR_NAME = 'logs';
const LOG_FILE_NAME = 'arborescent.log';

export function setElectronModule(mod: typeof import('electron') | null): void {
  electronModule = mod;
  fileSink.reset();
}

function loadElectron(): typeof import('electron') | null {
  if (electronModule) return electronModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    electronModule = require('electron');
    return electronModule;
  } catch {
    return null;
  }
}

class FileSink {
  private resolvedPath: string | null | undefined = undefined;

  reset(): void {
    this.resolvedPath = undefined;
  }

  getPath(): string | null {
    if (this.resolvedPath !== undefined) return this.resolvedPath;

    const electron = loadElectron();
    if (!electron?.app?.getPath) {
      this.resolvedPath = null;
      return null;
    }
    try {
      const userData = electron.app.getPath('userData');
      this.resolvedPath = path.join(userData, LOG_DIR_NAME, LOG_FILE_NAME);
    } catch {
      this.resolvedPath = null;
    }
    return this.resolvedPath;
  }

  append(entry: LogEntry): void {
    const target = this.getPath();
    if (!target) return;

    try {
      const dir = path.dirname(target);
      fs.mkdirSync(dir, { recursive: true });
      this.rotateIfNeeded(target);
      fs.appendFileSync(target, `${formatLogEntry(entry)}\n`);
    } catch {
      // file sink is best-effort; keep the in-memory buffer authoritative
    }
  }

  private rotateIfNeeded(target: string): void {
    let size = 0;
    try {
      size = fs.statSync(target).size;
    } catch {
      return;
    }
    if (size < MAX_LOG_BYTES) return;

    for (let i = MAX_ROTATED_FILES; i >= 1; i--) {
      const older = `${target}.${i}`;
      const newer = i === 1 ? target : `${target}.${i - 1}`;
      try {
        if (fs.existsSync(newer)) {
          // fs.renameSync clobbers on POSIX but throws EEXIST on Windows;
          // unlinking the older file first keeps rotation working on both.
          fs.rmSync(older, { force: true });
          fs.renameSync(newer, older);
        }
      } catch {
        // skip rotation on filesystem error
      }
    }
  }
}

const fileSink = new FileSink();

class MainLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, meta?: LogMeta, notifyRenderer = true): void {
    this.log('error', message, context, error, meta);

    if (notifyRenderer) {
      try {
        const electron = loadElectron();
        if (!electron) return;
        const mainWindow = electron.BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('main-error', message);
        }
      } catch {
        // Electron not available (e.g., in worker thread)
      }
    }
  }

  protected log(
    level: LogLevel,
    message: string,
    context?: string,
    error?: Error,
    meta?: LogMeta,
  ): void {
    super.log(level, message, context, error, meta);
    // The file sink must stay independent of the console-output threshold:
    // production builds default to minLevel='warn', and the workflow/hook
    // logs we need to persist are mostly logger.info.
    const entry = this.logs[this.logs.length - 1];
    if (entry) fileSink.append(entry);
  }
}

export const logger = new MainLogger();

export function getLogFilePath(): string | null {
  return fileSink.getPath();
}

export async function openLogFile(): Promise<void> {
  const electron = loadElectron();
  const target = getLogFilePath();
  if (!electron?.shell?.openPath || !target) return;
  await electron.shell.openPath(target);
}
