import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getOrCreateMcpAuthToken } from '../mcpAuthToken';

let userDataPath: string;

beforeEach(async () => {
  userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'arborescent-mcp-token-'));
});

afterEach(async () => {
  await fs.rm(userDataPath, { recursive: true, force: true });
});

describe('getOrCreateMcpAuthToken', () => {
  it('generates and persists a token when the file does not exist', async () => {
    const tokenPath = path.join(userDataPath, 'mcp-auth-token');
    await expect(fs.stat(tokenPath)).rejects.toThrow();

    const token = await getOrCreateMcpAuthToken(userDataPath);

    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const persisted = (await fs.readFile(tokenPath, 'utf8')).trim();
    expect(persisted).toBe(token);
  });

  it('returns the same token on the second call (no regeneration)', async () => {
    const first = await getOrCreateMcpAuthToken(userDataPath);
    const second = await getOrCreateMcpAuthToken(userDataPath);
    expect(second).toBe(first);
  });

  it('writes the token file with mode 0600', async () => {
    await getOrCreateMcpAuthToken(userDataPath);
    const tokenPath = path.join(userDataPath, 'mcp-auth-token');
    const stat = await fs.stat(tokenPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('creates the userData directory if missing', async () => {
    const nested = path.join(userDataPath, 'does-not-exist-yet');
    const token = await getOrCreateMcpAuthToken(nested);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const stat = await fs.stat(nested);
    expect(stat.isDirectory()).toBe(true);
  });

  it('trims surrounding whitespace from a pre-existing token file', async () => {
    const tokenPath = path.join(userDataPath, 'mcp-auth-token');
    await fs.writeFile(tokenPath, '  manually-set-token  \n', 'utf8');
    const token = await getOrCreateMcpAuthToken(userDataPath);
    expect(token).toBe('manually-set-token');
  });

  it('regenerates if the existing token file is empty', async () => {
    const tokenPath = path.join(userDataPath, 'mcp-auth-token');
    await fs.writeFile(tokenPath, '', 'utf8');
    const token = await getOrCreateMcpAuthToken(userDataPath);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const persisted = (await fs.readFile(tokenPath, 'utf8')).trim();
    expect(persisted).toBe(token);
  });
});
