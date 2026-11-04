import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Where a tool outside the app finds the hook server, so it can send a `Focus` event: pr-radar's
// focus plugin reads it. Owner-only, like ~/.claude.json for the MCP token, and rewritten at each
// start since the port and the token both change.
// ponytail: one file, so with two copies of the app running the last to start wins.
export const HOOK_ENDPOINT_FILE = path.join(os.homedir(), '.arborescent', 'hook.json');

export async function writeHookEndpoint(port: number, token: string, file = HOOK_ENDPOINT_FILE): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, JSON.stringify({ port, token, pid: process.pid }), { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

// Only this copy's own file: another copy started since owns it now.
export async function removeHookEndpoint(file = HOOK_ENDPOINT_FILE): Promise<void> {
  try {
    const { pid } = JSON.parse(await fs.readFile(file, 'utf8')) as { pid?: number };
    if (pid === process.pid) await fs.rm(file, { force: true });
  } catch {
    // Missing or unreadable: nothing of ours to remove.
  }
}
