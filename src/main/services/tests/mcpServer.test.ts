import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { ArborescentMcpServer, startMcpServerWithRetry } from '../mcpServer';

const AUTH_TOKEN = 'test-token-mcp-abc';

function makeRequest(
  port: number,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: options.method ?? 'POST',
        path: options.path ?? '/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

describe('ArborescentMcpServer — lifecycle', () => {
  let server: ArborescentMcpServer;

  beforeEach(() => {
    server = new ArborescentMcpServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('start() listens on a local-only address and reports the assigned port', async () => {
    await server.start(0, AUTH_TOKEN);
    expect(server.getPort()).toBeGreaterThan(0);
  });

  it('stop() releases the port so the same port can be reused', async () => {
    await server.start(0, AUTH_TOKEN);
    const port = server.getPort();
    await server.stop();
    expect(server.getPort()).toBe(0);

    const reused = new ArborescentMcpServer();
    await reused.start(port, AUTH_TOKEN);
    expect(reused.getPort()).toBe(port);
    await reused.stop();
  });

  it('start() rejects when called twice without stop()', async () => {
    await server.start(0, AUTH_TOKEN);
    await expect(server.start(0, AUTH_TOKEN)).rejects.toThrow(/already started/);
  });

  it('start() rejects when given an empty auth token', async () => {
    await expect(server.start(0, '')).rejects.toThrow(/auth token/);
  });
});

describe('ArborescentMcpServer — auth', () => {
  let server: ArborescentMcpServer;

  beforeEach(async () => {
    server = new ArborescentMcpServer();
    await server.start(0, AUTH_TOKEN);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('rejects a request without the Authorization header with 401', async () => {
    const res = await makeRequest(server.getPort(), { body: '{}' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with the wrong bearer token with 401', async () => {
    const res = await makeRequest(server.getPort(), {
      headers: { authorization: 'Bearer wrong-token' },
      body: '{}',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with a non-Bearer Authorization header with 401', async () => {
    const res = await makeRequest(server.getPort(), {
      headers: { authorization: `Basic ${AUTH_TOKEN}` },
      body: '{}',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with an empty Bearer token with 401', async () => {
    const res = await makeRequest(server.getPort(), {
      headers: { authorization: 'Bearer ' },
      body: '{}',
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows a request with the correct bearer token past the auth gate', async () => {
    const res = await makeRequest(server.getPort(), {
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      }),
    });
    expect(res.statusCode).not.toBe(401);
  });

  it('a request to an unknown path returns 404', async () => {
    const res = await makeRequest(server.getPort(), {
      path: '/not-mcp',
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      body: '{}',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('startMcpServerWithRetry', () => {
  it('returns the running server and assigned port on success', async () => {
    const { server, port } = await startMcpServerWithRetry(0, AUTH_TOKEN);
    expect(server).not.toBe(null);
    expect(port).toBeGreaterThan(0);
    await server!.stop();
  });

  it('retries to the next port when the base port is busy', async () => {
    const occupied = new ArborescentMcpServer();
    await occupied.start(0, AUTH_TOKEN);
    const occupiedPort = occupied.getPort();

    const { server, port } = await startMcpServerWithRetry(occupiedPort, AUTH_TOKEN, 3);

    expect(server).not.toBe(null);
    expect(port).toBeGreaterThan(occupiedPort);

    await occupied.stop();
    await server!.stop();
  });

  it('returns null after exhausting retries', async () => {
    const occupied = new ArborescentMcpServer();
    await occupied.start(0, AUTH_TOKEN);
    const port = occupied.getPort();

    const { server, port: returnedPort } = await startMcpServerWithRetry(port, AUTH_TOKEN, 0);

    expect(server).toBe(null);
    expect(returnedPort).toBe(0);

    await occupied.stop();
  });
});

describe('ArborescentMcpServer — binding registry', () => {
  it('exposes the in-memory binding registry for callers (hooks land in PR2)', () => {
    const server = new ArborescentMcpServer();
    const registry = server.getBindingRegistry();
    expect(registry).toBeDefined();
    expect(registry.lookup('any')).toBe(null);
  });
});

describe('ArborescentMcpServer — smoke tool registration', () => {
  let server: ArborescentMcpServer;

  beforeEach(async () => {
    server = new ArborescentMcpServer();
    await server.start(0, AUTH_TOKEN);
  });

  afterEach(async () => {
    await server.stop();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}) {
    // eslint-disable-next-line import/no-unresolved
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    // eslint-disable-next-line import/no-unresolved
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const client = new Client({ name: 'pr1-test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${server.getPort()}/mcp`),
      { requestInit: { headers: { authorization: `Bearer ${AUTH_TOKEN}` } } }
    );
    await client.connect(transport);
    try {
      const list = await client.listTools();
      const call = await client.callTool({ name, arguments: args });
      return { list, call };
    } finally {
      await client.close();
    }
  }

  it('advertises the arborescent.ping tool via tools/list response', async () => {
    const { list } = await callTool('arborescent.ping');
    expect(list.tools.map((t) => t.name)).toContain('arborescent.ping');
  });

  it('returns the declared response shape when arborescent.ping is called', async () => {
    const { call } = await callTool('arborescent.ping');
    expect(call.content).toEqual([{ type: 'text', text: 'pong' }]);
    expect(call.isError ?? false).toBe(false);
  });

  it('returns an MCP error result for an unknown tool name', async () => {
    // eslint-disable-next-line import/no-unresolved
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    // eslint-disable-next-line import/no-unresolved
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const client = new Client({ name: 'pr1-test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${server.getPort()}/mcp`),
      { requestInit: { headers: { authorization: `Bearer ${AUTH_TOKEN}` } } }
    );
    await client.connect(transport);
    try {
      const result = await client.callTool({ name: 'arborescent.does-not-exist' });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('ArborescentMcpServer — concurrent calls', () => {
  let server: ArborescentMcpServer;

  beforeEach(async () => {
    server = new ArborescentMcpServer();
    await server.start(0, AUTH_TOKEN);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('two concurrent ping calls on the same client both succeed with independent responses', async () => {
    // eslint-disable-next-line import/no-unresolved
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    // eslint-disable-next-line import/no-unresolved
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

    const client = new Client({ name: 'pr1-test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${server.getPort()}/mcp`),
      { requestInit: { headers: { authorization: `Bearer ${AUTH_TOKEN}` } } }
    );
    await client.connect(transport);
    try {
      const [first, second] = await Promise.all([
        client.callTool({ name: 'arborescent.ping' }),
        client.callTool({ name: 'arborescent.ping' }),
      ]);
      expect(first.content).toEqual([{ type: 'text', text: 'pong' }]);
      expect(second.content).toEqual([{ type: 'text', text: 'pong' }]);
    } finally {
      await client.close();
    }
  });

  it.todo('a call that arrives during stop() is rejected with a clean error rather than dropped silently');
});

describe('ArborescentMcpServer — next_instruction tool', () => {
  it.todo('the next_instruction tool is registered and advertised via tools/list');
  it.todo('getPromptQueue() returns the in-memory per-session PromptQueue');
  it.todo('PromptQueue is cleared on stop() so a restart starts with empty queues');
  it.todo('next_instruction over the wire returns hasInstruction=false when the queue is empty for the requesting session_id');
  it.todo('next_instruction over the wire drains one entry and returns hasInstruction=true with the prompt content');
});

describe('ArborescentMcpServer — peek-queue endpoint', () => {
  let server: ArborescentMcpServer;

  beforeEach(async () => {
    server = new ArborescentMcpServer();
    await server.start(0, AUTH_TOKEN);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('GET /peek-queue?session_id=X returns hasItems=true and size>0 when the queue has entries for X', async () => {
    server.getPromptQueue().enqueue('sess-1', { content: 'hi', source: 'workflow' });
    server.getPromptQueue().enqueue('sess-1', { content: 'hi2', source: 'workflow' });
    const res = await makeRequest(server.getPort(), {
      method: 'GET',
      path: '/peek-queue?session_id=sess-1',
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ hasItems: true, size: 2 });
  });

  it('GET /peek-queue?session_id=X returns hasItems=false when the queue is empty for X', async () => {
    const res = await makeRequest(server.getPort(), {
      method: 'GET',
      path: '/peek-queue?session_id=empty-sess',
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ hasItems: false, size: 0 });
  });

  it('GET /peek-queue without session_id returns 400', async () => {
    const res = await makeRequest(server.getPort(), {
      method: 'GET',
      path: '/peek-queue',
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /peek-queue without the bearer token returns 401', async () => {
    const res = await makeRequest(server.getPort(), {
      method: 'GET',
      path: '/peek-queue?session_id=sess-1',
    });
    expect(res.statusCode).toBe(401);
  });

  it('peek does NOT drain — repeated peeks see the same size', async () => {
    server.getPromptQueue().enqueue('sess-1', { content: 'hi', source: 'workflow' });
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(server.getPort(), {
        method: 'GET',
        path: '/peek-queue?session_id=sess-1',
        headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      });
      expect(JSON.parse(res.body)).toEqual({ hasItems: true, size: 1 });
    }
  });
});

describe('ArborescentMcpServer — boundary inputs', () => {
  let server: ArborescentMcpServer;

  beforeEach(async () => {
    server = new ArborescentMcpServer();
    await server.start(0, AUTH_TOKEN);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('rejects a non-JSON body with a parse-error response', async () => {
    const res = await makeRequest(server.getPort(), {
      headers: { authorization: `Bearer ${AUTH_TOKEN}` },
      body: 'this is not json',
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });
});
