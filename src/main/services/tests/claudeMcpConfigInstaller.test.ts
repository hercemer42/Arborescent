import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  registerArborescentMcp,
  unregisterArborescentMcp,
} from '../claudeMcpConfigInstaller';

let homePath: string;

async function readConfig(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(path.join(homePath, '.claude.json'), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeConfig(value: unknown): Promise<void> {
  await fs.writeFile(path.join(homePath, '.claude.json'), JSON.stringify(value, null, 2), 'utf8');
}

beforeEach(async () => {
  homePath = await fs.mkdtemp(path.join(os.tmpdir(), 'arborescent-claude-config-'));
});

afterEach(async () => {
  await fs.rm(homePath, { recursive: true, force: true });
});

describe('registerArborescentMcp — fresh write', () => {
  it('creates ~/.claude.json when it does not exist', async () => {
    expect(await readConfig()).toBe(null);
    await registerArborescentMcp({ homePath, port: 17840, token: 'tok-1' });
    const config = (await readConfig()) as Record<string, unknown>;
    expect(config).not.toBe(null);
  });

  it('writes an http MCP server entry pointing at 127.0.0.1 with the bound port and bearer token', async () => {
    await registerArborescentMcp({ homePath, port: 17840, token: 'tok-1' });
    const config = (await readConfig()) as { mcpServers: Record<string, unknown> };
    expect(config.mcpServers.arborescent).toEqual({
      type: 'http',
      url: 'http://127.0.0.1:17840/mcp',
      headers: { Authorization: 'Bearer tok-1' },
    });
  });

  it('reflects the actual bound port (not the default) when called with a retried port', async () => {
    await registerArborescentMcp({ homePath, port: 17855, token: 'tok-2' });
    const config = (await readConfig()) as { mcpServers: Record<string, { url: string }> };
    expect(config.mcpServers.arborescent.url).toBe('http://127.0.0.1:17855/mcp');
  });
});

describe('registerArborescentMcp — merge with existing config', () => {
  it('preserves user-added MCP servers untouched', async () => {
    await writeConfig({
      mcpServers: {
        'linear-server': { type: 'sse', url: 'https://mcp.linear.app/sse' },
      },
    });

    await registerArborescentMcp({ homePath, port: 17840, token: 'tok' });

    const config = (await readConfig()) as { mcpServers: Record<string, unknown> };
    expect(config.mcpServers['linear-server']).toEqual({
      type: 'sse',
      url: 'https://mcp.linear.app/sse',
    });
    expect(config.mcpServers.arborescent).toBeDefined();
  });

  it('preserves unrelated top-level keys in ~/.claude.json', async () => {
    await writeConfig({
      theme: 'dark',
      anthropicApiKey: 'sk-...',
      mcpServers: {},
    });

    await registerArborescentMcp({ homePath, port: 17840, token: 'tok' });

    const config = (await readConfig()) as Record<string, unknown>;
    expect(config.theme).toBe('dark');
    expect(config.anthropicApiKey).toBe('sk-...');
  });

  it('replaces a stale arborescent entry on the next call (no duplicates)', async () => {
    await registerArborescentMcp({ homePath, port: 17840, token: 'old-token' });
    await registerArborescentMcp({ homePath, port: 17841, token: 'new-token' });

    const config = (await readConfig()) as { mcpServers: Record<string, { url: string; headers: { Authorization: string } }> };
    expect(config.mcpServers.arborescent.url).toBe('http://127.0.0.1:17841/mcp');
    expect(config.mcpServers.arborescent.headers.Authorization).toBe('Bearer new-token');
    expect(Object.keys(config.mcpServers).filter((k) => k === 'arborescent').length).toBe(1);
  });

  it('initializes mcpServers when ~/.claude.json exists without it', async () => {
    await writeConfig({ theme: 'dark' });

    await registerArborescentMcp({ homePath, port: 17840, token: 'tok' });

    const config = (await readConfig()) as { mcpServers: Record<string, unknown> };
    expect(config.mcpServers.arborescent).toBeDefined();
  });
});

describe('registerArborescentMcp — failure modes', () => {
  it('refuses to merge a malformed ~/.claude.json and surfaces a clear error', async () => {
    await fs.writeFile(path.join(homePath, '.claude.json'), '{ not-json', 'utf8');
    await expect(
      registerArborescentMcp({ homePath, port: 17840, token: 'tok' }),
    ).rejects.toThrow(/malformed/i);
  });

  it('refuses to merge when mcpServers is present but not an object', async () => {
    await writeConfig({ mcpServers: 'oops' });
    await expect(
      registerArborescentMcp({ homePath, port: 17840, token: 'tok' }),
    ).rejects.toThrow(/mcpServers/);
  });

  it('does not overwrite a malformed file', async () => {
    const before = '{ corrupt';
    await fs.writeFile(path.join(homePath, '.claude.json'), before, 'utf8');
    await registerArborescentMcp({ homePath, port: 17840, token: 'tok' }).catch(() => undefined);
    const after = await fs.readFile(path.join(homePath, '.claude.json'), 'utf8');
    expect(after).toBe(before);
  });
});

describe('unregisterArborescentMcp', () => {
  it('removes only the arborescent entry from mcpServers', async () => {
    await writeConfig({
      mcpServers: {
        'linear-server': { type: 'sse', url: 'x' },
        arborescent: { type: 'http', url: 'y' },
      },
    });

    await unregisterArborescentMcp({ homePath });

    const config = (await readConfig()) as { mcpServers: Record<string, unknown> };
    expect(config.mcpServers.arborescent).toBeUndefined();
    expect(config.mcpServers['linear-server']).toBeDefined();
  });

  it('is a no-op when ~/.claude.json does not exist', async () => {
    await expect(unregisterArborescentMcp({ homePath })).resolves.toBeUndefined();
  });

  it('is a no-op when mcpServers is missing', async () => {
    await writeConfig({ theme: 'dark' });
    await unregisterArborescentMcp({ homePath });
    const config = (await readConfig()) as { theme: string };
    expect(config.theme).toBe('dark');
  });
});
