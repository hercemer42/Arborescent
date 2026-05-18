import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from './logger';

const SERVER_KEY = 'arborescent';
const CONFIG_FILENAME = '.claude.json';

export type RegisterArborescentMcpDeps = {
  homePath?: string;
  port: number;
  token: string;
};

export type UnregisterArborescentMcpDeps = {
  homePath?: string;
};

type McpEntry = {
  type: 'http';
  url: string;
  headers: { Authorization: string };
};

export async function registerArborescentMcp(deps: RegisterArborescentMcpDeps): Promise<void> {
  const configPath = resolveConfigPath(deps.homePath);
  const config = await readConfig(configPath);
  const mcpServers = ensureMcpServers(config);
  mcpServers[SERVER_KEY] = buildEntry(deps.port, deps.token);
  config.mcpServers = mcpServers;
  await writeConfig(configPath, config);
  logger.info(`Registered arborescent MCP server on port ${deps.port}`, 'ClaudeMcpConfigInstaller');
}

export async function unregisterArborescentMcp(deps: UnregisterArborescentMcpDeps): Promise<void> {
  const configPath = resolveConfigPath(deps.homePath);
  let config: Record<string, unknown>;
  try {
    config = await readConfig(configPath);
  } catch {
    return;
  }
  const mcpServers = config.mcpServers;
  if (!isPlainObject(mcpServers)) return;
  if (!(SERVER_KEY in mcpServers)) return;
  delete mcpServers[SERVER_KEY];
  await writeConfig(configPath, config);
}

function resolveConfigPath(homePath?: string): string {
  return path.join(homePath ?? os.homedir(), CONFIG_FILENAME);
}

function buildEntry(port: number, token: string): McpEntry {
  return {
    type: 'http',
    url: `http://127.0.0.1:${port}/mcp`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

async function readConfig(configPath: string): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  if (raw.trim().length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Refusing to merge into malformed ${configPath}: ${(err as Error).message}`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`Refusing to merge into malformed ${configPath}: not a JSON object`);
  }
  return parsed;
}

function ensureMcpServers(config: Record<string, unknown>): Record<string, unknown> {
  const existing = config.mcpServers;
  if (existing === undefined) return {};
  if (!isPlainObject(existing)) {
    throw new Error('Refusing to merge: ~/.claude.json mcpServers is present but not an object');
  }
  return existing;
}

async function writeConfig(configPath: string, config: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
