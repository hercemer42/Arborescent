import { ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function encodeClaudeProjectDir(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

export function resolveClaudeSessionFile(cwd: string, sessionId: string): string {
  return join(homedir(), '.claude', 'projects', encodeClaudeProjectDir(cwd), `${sessionId}.jsonl`);
}

export function registerClaudeSessionHandlers(): void {
  ipcMain.handle('claude:session-exists', (_event, cwd: string, sessionId: string) => {
    if (!cwd || !sessionId) return false;
    if (!SESSION_ID_PATTERN.test(sessionId)) return false;
    return existsSync(resolveClaudeSessionFile(cwd, sessionId));
  });
}
