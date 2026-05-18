import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { logger } from './logger';

const TOKEN_FILENAME = 'mcp-auth-token';

export async function getOrCreateMcpAuthToken(userDataPath: string): Promise<string> {
  await fs.mkdir(userDataPath, { recursive: true });
  const tokenPath = path.join(userDataPath, TOKEN_FILENAME);

  try {
    const existing = (await fs.readFile(tokenPath, 'utf8')).trim();
    if (existing.length > 0) return existing;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const token = randomUUID();
  await fs.writeFile(tokenPath, token, { mode: 0o600 });
  await fs.chmod(tokenPath, 0o600);
  logger.info('Generated new persistent MCP auth token', 'McpAuthToken');
  return token;
}
