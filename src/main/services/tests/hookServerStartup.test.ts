import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'node:net';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { startHookServerWithRetry } from '../hookServer';

function occupyPort(port: number): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

describe('startHookServerWithRetry', () => {
  const mockCallback = vi.fn();
  const blockers: net.Server[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any blocking servers
    for (const blocker of blockers) {
      await closeServer(blocker);
    }
    blockers.length = 0;
  });

  it('should start on the default port when available', async () => {
    const result = await startHookServerWithRetry(0, 'token', mockCallback);

    expect(result.server).not.toBeNull();
    expect(result.port).toBeGreaterThan(0);

    await result.server!.stop();
  });

  it('should retry on next port when first port is occupied', async () => {
    // Occupy a specific port
    const { server: blocker, port: blockedPort } = await occupyPort(0);
    blockers.push(blocker);

    // Try to start on the blocked port — should retry and succeed on blockedPort+1
    const result = await startHookServerWithRetry(blockedPort, 'token', mockCallback);

    expect(result.server).not.toBeNull();
    expect(result.port).toBe(blockedPort + 1);

    await result.server!.stop();
  });

  it('should retry up to 3 times before giving up', async () => {
    // Occupy 3 consecutive ports
    const { server: blocker1, port: basePort } = await occupyPort(0);
    blockers.push(blocker1);

    const { server: blocker2 } = await occupyPort(basePort + 1);
    blockers.push(blocker2);

    const { server: blocker3 } = await occupyPort(basePort + 2);
    blockers.push(blocker3);

    // All 3 ports occupied — should succeed on basePort+3
    const result = await startHookServerWithRetry(basePort, 'token', mockCallback);

    expect(result.server).not.toBeNull();
    expect(result.port).toBe(basePort + 3);

    await result.server!.stop();
  });

  it('should return null when all retry ports are occupied', async () => {
    // Occupy 4 consecutive ports (base + 3 retries)
    const { server: blocker1, port: basePort } = await occupyPort(0);
    blockers.push(blocker1);

    const { server: blocker2 } = await occupyPort(basePort + 1);
    blockers.push(blocker2);

    const { server: blocker3 } = await occupyPort(basePort + 2);
    blockers.push(blocker3);

    const { server: blocker4 } = await occupyPort(basePort + 3);
    blockers.push(blocker4);

    const result = await startHookServerWithRetry(basePort, 'token', mockCallback);

    expect(result.server).toBeNull();
    expect(result.port).toBe(0);
  });

  it('should report the actually bound port after retry', async () => {
    const { server: blocker, port: blockedPort } = await occupyPort(0);
    blockers.push(blocker);

    const result = await startHookServerWithRetry(blockedPort, 'token', mockCallback);

    expect(result.port).toBe(blockedPort + 1);
    expect(result.server!.getPort()).toBe(blockedPort + 1);

    await result.server!.stop();
  });
});
