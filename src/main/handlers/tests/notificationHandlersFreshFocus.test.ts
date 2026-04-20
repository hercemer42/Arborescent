import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHandle } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
}));

vi.mock('electron', () => {
  const NotificationMock = vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    on: vi.fn(),
  }));
  (NotificationMock as unknown as Record<string, unknown>).isSupported = vi.fn().mockReturnValue(true);
  return {
    ipcMain: { handle: mockHandle },
    Notification: NotificationMock,
  };
});

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerNotificationHandlers } from '../notificationHandlers';

// Contract: `is-window-focused` must reflect the window's live focus state
// on every query. Caching via focus/blur events can desync when OS-level
// focus transitions are missed (initial-launch state, Mac Spaces,
// dev-tools interactions). Querying isFocused() on demand removes that
// class of bug entirely.

describe('is-window-focused — fresh on-demand query (no cache)', () => {
  let mockMainWindow: {
    isFocused: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
  };
  let getMainWindow: () => typeof mockMainWindow | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMainWindow = {
      isFocused: vi.fn().mockReturnValue(false),
      on: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };
    getMainWindow = () => mockMainWindow;
  });

  function getHandler(channel: string): (...args: unknown[]) => unknown {
    registerNotificationHandlers(getMainWindow as ReturnType<typeof vi.fn>);
    const call = mockHandle.mock.calls.find((c: unknown[]) => c[0] === channel);
    if (!call) throw new Error(`No handler registered for channel: ${channel}`);
    return call[1] as (...args: unknown[]) => unknown;
  }

  it('reads mainWindow.isFocused() on every invocation', async () => {
    const handler = getHandler('is-window-focused');

    await handler({});
    await handler({});
    await handler({});

    expect(mockMainWindow.isFocused).toHaveBeenCalledTimes(3);
  });

  it('returns the latest isFocused() value when focus changes between calls, without relying on focus/blur events firing', async () => {
    mockMainWindow.isFocused.mockReturnValue(true);
    const handler = getHandler('is-window-focused');

    expect(await handler({})).toBe(true);

    // Focus flips at the OS level. No focus/blur event is simulated here —
    // the handler must still reflect the new value the next time it is asked.
    mockMainWindow.isFocused.mockReturnValue(false);
    expect(await handler({})).toBe(false);

    mockMainWindow.isFocused.mockReturnValue(true);
    expect(await handler({})).toBe(true);
  });

  it('returns false when getMainWindow() returns null', async () => {
    getMainWindow = () => null;
    const handler = getHandler('is-window-focused');

    expect(await handler({})).toBe(false);
  });

  it('returns false without throwing when isFocused() throws synchronously', async () => {
    mockMainWindow.isFocused.mockImplementation(() => {
      throw new Error('window destroyed');
    });
    const handler = getHandler('is-window-focused');

    await expect(handler({})).resolves.toBe(false);
  });

  it('does not rely on any focus/blur listener being registered in order to report focus correctly', async () => {
    // Intentionally leave `on` as a no-op (no listener capture). The handler
    // should still be able to report focus via the on-demand query.
    mockMainWindow.on = vi.fn(); // discards all listener registrations
    mockMainWindow.isFocused.mockReturnValue(true);

    const handler = getHandler('is-window-focused');

    expect(await handler({})).toBe(true);
  });
});
