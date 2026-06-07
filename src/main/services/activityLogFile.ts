import path from 'node:path';
import fs from 'node:fs';
import type { ActivityLogEntry } from '../../shared/types/activityLog';

export type PersistedActivityEntry = ActivityLogEntry;

const ACTIVITY_LOG_DIR = 'logs';
const ACTIVITY_LOG_FILE = 'activity-log.jsonl';

let electronModule: typeof import('electron') | null = null;

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

export function getActivityLogPath(): string | null {
  const electron = loadElectron();
  if (!electron?.app?.getPath) return null;
  try {
    return path.join(electron.app.getPath('userData'), ACTIVITY_LOG_DIR, ACTIVITY_LOG_FILE);
  } catch {
    return null;
  }
}

export function appendActivityEntry(entry: PersistedActivityEntry, filePath?: string): void {
  const target = filePath ?? getActivityLogPath();
  if (!target) return;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, `${JSON.stringify(entry)}\n`);
  } catch {
    // Best-effort persistence; the in-memory store stays authoritative.
  }
}

export function readRecentActivityEntries(cap: number, filePath?: string): PersistedActivityEntry[] {
  const target = filePath ?? getActivityLogPath();
  if (!target) return [];

  let raw: string;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch {
    return [];
  }

  const entries = raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseEntry)
    .filter((entry): entry is PersistedActivityEntry => entry !== null);

  return entries.slice(-cap);
}

export function trimActivityFile(cap: number, filePath?: string): void {
  const target = filePath ?? getActivityLogPath();
  if (!target || !fileExists(target)) return;

  let lines: string[];
  try {
    lines = fs.readFileSync(target, 'utf8').split('\n').filter((line) => line.trim().length > 0);
  } catch {
    return;
  }
  // Only rewrite when the file is actually over the cap, so the common startup
  // path takes no write and cannot race a concurrent append.
  if (lines.length <= cap) return;

  try {
    fs.writeFileSync(target, `${lines.slice(-cap).join('\n')}\n`);
  } catch {
    // Leave the file untouched on write failure.
  }
}

function parseEntry(line: string): PersistedActivityEntry | null {
  try {
    return JSON.parse(line) as PersistedActivityEntry;
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}
