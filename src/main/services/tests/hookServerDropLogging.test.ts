import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';

const { loggerMocks } = vi.hoisted(() => ({
  loggerMocks: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: loggerMocks,
}));

import { HookServer } from '../hookServer';

const AUTH_TOKEN = 'test-token-drop-reason';

function postRaw(
  port: number,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{ statusCode: number }> {
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
        res.on('data', () => {});
        res.on('end', () => resolve({ statusCode: res.statusCode! }));
      }
    );
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

describe('HookServer drop-reason logging', () => {
  let server: HookServer;
  let port: number;

  beforeEach(async () => {
    Object.values(loggerMocks).forEach((m) => m.mockClear());
    server = new HookServer();
    await server.start(0, AUTH_TOKEN, vi.fn());
    port = server.getPort();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('auth drops', () => {
    it('logs a warning identifying the drop reason as auth when token is missing', async () => {
      await postRaw(port, {
        method: 'POST',
        path: '/hook',
        body: JSON.stringify({ session_id: 's1', hook_event_name: 'Stop' }),
      });

      expect(loggerMocks.warn).toHaveBeenCalled();
      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => /auth|token/i.test(m))).toBe(true);
    });

    it('logs a warning identifying the drop reason as auth when token is wrong', async () => {
      await postRaw(port, {
        method: 'POST',
        path: '/hook',
        headers: { Authorization: 'Bearer not-the-real-token' },
        body: JSON.stringify({ session_id: 's1', hook_event_name: 'Stop' }),
      });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => /auth|token/i.test(m))).toBe(true);
    });
  });

  describe('parse drops', () => {
    it('logs a warning identifying the drop reason as parse on malformed JSON', async () => {
      await postRaw(port, {
        method: 'POST',
        path: '/hook',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: '{not-json',
      });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => /payload|parse|invalid/i.test(m))).toBe(true);
    });

    it('logs a warning identifying the drop reason as parse when required fields are missing', async () => {
      await postRaw(port, {
        method: 'POST',
        path: '/hook',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ session_id: 's1' }),
      });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => /payload|parse|invalid/i.test(m))).toBe(true);
    });
  });

  describe('successful hooks', () => {
    it('logs an info line citing event name and session', async () => {
      await postRaw(port, {
        method: 'POST',
        path: '/hook',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ session_id: 'session-known', hook_event_name: 'Stop' }),
      });

      const infoMessages = loggerMocks.info.mock.calls.map((c) => String(c[0]));
      expect(infoMessages.some((m) => m.includes('Stop') && m.includes('session-known'))).toBe(true);
    });

    it('does not emit a drop-reason warning when the request is accepted', async () => {
      await postRaw(port, {
        method: 'POST',
        path: '/hook',
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        body: JSON.stringify({ session_id: 's1', hook_event_name: 'Stop' }),
      });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => /reject|drop/i.test(m))).toBe(false);
    });
  });
});
