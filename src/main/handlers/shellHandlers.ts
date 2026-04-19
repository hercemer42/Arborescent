import { ipcMain, shell } from 'electron';

// Defence-in-depth for renderer-originated external-open requests.
// String-prefix checks (`url.startsWith('http://')`) are cheap but miss
// weird-but-valid URL variants (mixed case, whitespace, data/javascript
// schemes tucked inside http-like wrappers), so use URL parsing plus an
// explicit protocol allow-list.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isSafeExternalUrl(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return ALLOWED_PROTOCOLS.has(parsed.protocol);
}

export function registerShellHandlers(): void {
  ipcMain.handle('open-external', async (_event, url: string) => {
    if (!isSafeExternalUrl(url)) {
      throw new Error('Invalid or disallowed URL');
    }
    await shell.openExternal(url);
  });
}
