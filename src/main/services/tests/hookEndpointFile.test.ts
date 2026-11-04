import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { writeHookEndpoint, removeHookEndpoint } from '../hookEndpointFile';

let dir: string;
let file: string;

describe('hook endpoint file', () => {
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arbo-endpoint-'));
    file = path.join(dir, '.arborescent', 'hook.json');
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes the port, the token and this process, readable by its owner only', async () => {
    await writeHookEndpoint(4123, 'secret', file);
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ port: 4123, token: 'secret', pid: process.pid });
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  });

  it('removes only the file this process wrote', async () => {
    await writeHookEndpoint(4123, 'secret', file);
    await removeHookEndpoint(file);
    await expect(fs.stat(file)).rejects.toThrow();

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ port: 1, token: 't', pid: process.pid + 1 }));
    await removeHookEndpoint(file);
    expect(JSON.parse(await fs.readFile(file, 'utf8')).pid).toBe(process.pid + 1);
  });

  it('removing a missing or unreadable file is not an error', async () => {
    await expect(removeHookEndpoint(file)).resolves.toBeUndefined();
  });
});
