import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { HookServer } from '../hookServer';

const AUTH_TOKEN = 'test-token-abc-123';
const TEST_PORT = 0; // Let OS assign a free port

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
        method: options.method || 'POST',
        path: options.path || '/hook',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode!, body: data }));
      }
    );
    req.on('error', reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

function postHook(
  port: number,
  body: Record<string, unknown> | string,
  token?: string
): Promise<{ statusCode: number; body: string }> {
  const jsonBody = typeof body === 'string' ? body : JSON.stringify(body);
  return makeRequest(port, {
    method: 'POST',
    path: '/hook',
    headers: {
      'Content-Type': 'application/json',
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: jsonBody,
  });
}

describe('HookServer', () => {
  let server: HookServer;
  let mockCallback: ReturnType<typeof vi.fn>;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCallback = vi.fn();
    server = new HookServer();
    await server.start(TEST_PORT, AUTH_TOKEN, mockCallback);
    port = server.getPort();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('authentication', () => {
    it('should accept valid Bearer token and return 200', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
    });

    it('should reject missing Authorization header with 401', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        body: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      });

      expect(res.statusCode).toBe(401);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject malformed Authorization header without Bearer prefix with 401', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        headers: { Authorization: AUTH_TOKEN },
        body: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      });

      expect(res.statusCode).toBe(401);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject wrong token value with 401', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, 'wrong-token');

      expect(res.statusCode).toBe(401);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject empty token string with 401', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, '');

      expect(res.statusCode).toBe(401);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('request routing', () => {
    it('should accept POST /hook with valid payload', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
    });

    it('should reject GET /hook with 405', async () => {
      const res = await makeRequest(port, {
        method: 'GET',
        path: '/hook',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      });

      expect(res.statusCode).toBe(405);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject PUT /hook with 405', async () => {
      const res = await makeRequest(port, {
        method: 'PUT',
        path: '/hook',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      });

      expect(res.statusCode).toBe(405);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject POST /other-path with 404', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/other-path',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      });

      expect(res.statusCode).toBe(404);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject POST / with 404', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      });

      expect(res.statusCode).toBe(404);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('payload validation', () => {
    it('should accept valid JSON with session_id and hook_event_name', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should reject empty body with 400', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: '',
      });

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should accept valid JSON regardless of Content-Type header', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      });

      expect(res.statusCode).toBe(200);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should reject malformed JSON with 400', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: '{invalid json',
      });

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject JSON missing session_id with 400', async () => {
      const res = await postHook(port, {
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject JSON missing hook_event_name with 400', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should accept JSON with extra fields (forward-compatible)', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
        extra_field: 'some-value',
        nested: { data: true },
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should forward optional terminal_id in callback payload', async () => {
      await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'SessionStart',
        terminal_id: 'terminal-123',
      }, AUTH_TOKEN);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess-1',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-123',
        })
      );
    });

    it('should forward optional message in callback payload', async () => {
      await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Notification',
        message: 'Something happened',
      }, AUTH_TOKEN);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess-1',
          hook_event_name: 'Notification',
          message: 'Something happened',
        })
      );
    });
  });

  describe('server lifecycle', () => {
    it('should listen on specified port', () => {
      // Port 0 causes OS to assign a free port; getPort() returns the actual port
      expect(server.getPort()).toBeGreaterThan(0);
    });

    it('should bind to 127.0.0.1 only', async () => {
      // Verify the server address is localhost
      const address = server.getAddress();
      expect(address).toBe('127.0.0.1');
    });

    it('should free the port after stop()', async () => {
      const boundPort = server.getPort();
      await server.stop();

      // Start a new server on the same port to prove it was freed
      const server2 = new HookServer();
      await server2.start(boundPort, AUTH_TOKEN, mockCallback);
      expect(server2.getPort()).toBe(boundPort);
      await server2.stop();
    });

    it('should return the bound port from getPort()', () => {
      expect(typeof server.getPort()).toBe('number');
      expect(server.getPort()).toBeGreaterThan(0);
    });

    it('should not throw when stop() is called on an unstarted server', async () => {
      const newServer = new HookServer();
      await expect(newServer.stop()).resolves.not.toThrow();
    });

    it('should not create duplicate listeners when start() is called twice', async () => {
      const port1 = server.getPort();
      // Starting again should be a no-op or replace cleanly
      await server.start(TEST_PORT, AUTH_TOKEN, mockCallback);
      const port2 = server.getPort();

      // Server should still work (either same port or new port)
      const res = await postHook(port2, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Old port should no longer respond if port changed
      if (port1 !== port2) {
        await expect(postHook(port1, {
          session_id: 'sess-1',
          hook_event_name: 'Stop',
        }, AUTH_TOKEN)).rejects.toThrow();
      }
    });
  });

  describe('callback invocation', () => {
    it('should invoke callback with parsed payload including all fields', async () => {
      await postHook(port, {
        session_id: 'sess-42',
        hook_event_name: 'Stop',
        terminal_id: 'terminal-7',
        message: 'Task complete',
      }, AUTH_TOKEN);

      expect(mockCallback).toHaveBeenCalledWith({
        session_id: 'sess-42',
        hook_event_name: 'Stop',
        terminal_id: 'terminal-7',
        message: 'Task complete',
      });
    });

    it('should not invoke callback for auth-rejected requests', async () => {
      await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, 'bad-token');

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should not invoke callback for payload-rejected requests', async () => {
      await postHook(port, {
        session_id: 'sess-1',
        // missing hook_event_name
      }, AUTH_TOKEN);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should return 200 even if callback throws', async () => {
      mockCallback.mockImplementation(() => {
        throw new Error('Callback exploded');
      });

      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
    });

    it('should continue accepting requests after callback throws', async () => {
      mockCallback.mockImplementationOnce(() => {
        throw new Error('Callback exploded');
      });

      // First request — callback throws
      await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      // Second request — should still work
      const res = await postHook(port, {
        session_id: 'sess-2',
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple rapid requests without dropping any', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        postHook(port, {
          session_id: `sess-${i}`,
          hook_event_name: 'Stop',
        }, AUTH_TOKEN)
      );

      const results = await Promise.all(requests);

      results.forEach(res => expect(res.statusCode).toBe(200));
      expect(mockCallback).toHaveBeenCalledTimes(10);
    });
  });

  describe('large and edge-case payloads', () => {
    it('should handle payload with very long session_id', async () => {
      const longId = 'a'.repeat(10000);
      const res = await postHook(port, {
        session_id: longId,
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(200);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({ session_id: longId })
      );
    });

    it('should reject non-string session_id with 400', async () => {
      const res = await postHook(port, {
        session_id: 12345,
        hook_event_name: 'Stop',
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject non-string hook_event_name with 400', async () => {
      const res = await postHook(port, {
        session_id: 'sess-1',
        hook_event_name: true,
      }, AUTH_TOKEN);

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject null body with 400', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: 'null',
      });

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reject array body with 400', async () => {
      const res = await makeRequest(port, {
        method: 'POST',
        path: '/hook',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: '[]',
      });

      expect(res.statusCode).toBe(400);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});
