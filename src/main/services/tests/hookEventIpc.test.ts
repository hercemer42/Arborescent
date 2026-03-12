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

const AUTH_TOKEN = 'ipc-test-token';

function postHook(
  port: number,
  body: Record<string, unknown>,
  token: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const jsonBody = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'POST',
        path: '/hook',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode!, body: data }));
      }
    );
    req.on('error', reject);
    req.write(jsonBody);
    req.end();
  });
}

describe('Hook event IPC forwarding', () => {
  let server: HookServer;
  let mockIpcSend: ReturnType<typeof vi.fn>;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcSend = vi.fn();
    server = new HookServer();
    await server.start(0, AUTH_TOKEN, mockIpcSend);
    port = server.getPort();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should forward parsed payload to IPC callback on valid POST', async () => {
    const payload = {
      session_id: 'sess-abc',
      hook_event_name: 'Stop',
    };

    await postHook(port, payload, AUTH_TOKEN);

    expect(mockIpcSend).toHaveBeenCalledWith({
      session_id: 'sess-abc',
      hook_event_name: 'Stop',
    });
  });

  it('should forward payload with terminal_id intact for SessionStart events', async () => {
    const payload = {
      session_id: 'sess-new',
      hook_event_name: 'SessionStart',
      terminal_id: 'terminal-42',
    };

    await postHook(port, payload, AUTH_TOKEN);

    expect(mockIpcSend).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'sess-new',
        hook_event_name: 'SessionStart',
        terminal_id: 'terminal-42',
      })
    );
  });

  it('should forward all rapid POSTs without dropping any', async () => {
    const requests = Array.from({ length: 20 }, (_, i) =>
      postHook(port, {
        session_id: `sess-${i}`,
        hook_event_name: 'Stop',
      }, AUTH_TOKEN)
    );

    const results = await Promise.all(requests);

    results.forEach(res => expect(res.statusCode).toBe(200));
    expect(mockIpcSend).toHaveBeenCalledTimes(20);

    // Verify each session_id was forwarded
    const forwardedSessionIds = mockIpcSend.mock.calls.map(
      (call: { session_id: string }[]) => call[0].session_id
    );
    for (let i = 0; i < 20; i++) {
      expect(forwardedSessionIds).toContain(`sess-${i}`);
    }
  });

  it('should forward Notification events with message', async () => {
    await postHook(port, {
      session_id: 'sess-1',
      hook_event_name: 'Notification',
      message: 'Something went wrong',
    }, AUTH_TOKEN);

    expect(mockIpcSend).toHaveBeenCalledWith({
      session_id: 'sess-1',
      hook_event_name: 'Notification',
      message: 'Something went wrong',
    });
  });

  it('should not forward events that fail auth', async () => {
    await postHook(port, {
      session_id: 'sess-1',
      hook_event_name: 'Stop',
    }, 'wrong-token');

    expect(mockIpcSend).not.toHaveBeenCalled();
  });

  it('should not forward events with invalid payload', async () => {
    await postHook(port, {
      session_id: 'sess-1',
      // missing hook_event_name
    }, AUTH_TOKEN);

    expect(mockIpcSend).not.toHaveBeenCalled();
  });
});
