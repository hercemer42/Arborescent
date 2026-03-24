import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHandle } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle,
  },
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    on: vi.fn(),
  })),
}));

import { registerNotificationHandlers } from '../notificationHandlers';
import { Notification } from 'electron';

describe('notificationHandlers', () => {
  let mockMainWindow: {
    show: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    isFocused: ReturnType<typeof vi.fn>;
  };
  let getMainWindow: () => typeof mockMainWindow | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMainWindow = {
      show: vi.fn(),
      focus: vi.fn(),
      isFocused: vi.fn().mockReturnValue(false),
    };
    getMainWindow = () => mockMainWindow;
  });

  function getHandler(channel: string): (...args: unknown[]) => unknown {
    registerNotificationHandlers(getMainWindow as ReturnType<typeof vi.fn>);
    const call = mockHandle.mock.calls.find(
      (c: unknown[]) => c[0] === channel
    );
    if (!call) throw new Error(`No handler registered for channel: ${channel}`);
    return call[1] as (...args: unknown[]) => unknown;
  }

  describe('show-notification', () => {
    it('should create an Electron Notification with provided title and body', () => {
      const handler = getHandler('show-notification');
      handler({}, 'Workflow complete', 'Task A finished');

      expect(Notification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Workflow complete',
          body: 'Task A finished',
        })
      );
    });

    it('should call show() on the notification', () => {
      const handler = getHandler('show-notification');
      handler({}, 'Title', 'Body');

      const notificationInstance = vi.mocked(Notification).mock.results[0].value;
      expect(notificationInstance.show).toHaveBeenCalled();
    });

    it('should bring window to foreground when notification is clicked', () => {
      const mockOn = vi.fn();
      vi.mocked(Notification).mockImplementation(() => ({
        show: vi.fn(),
        on: mockOn,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      const handler = getHandler('show-notification');
      handler({}, 'Title', 'Body');

      const clickCallback = mockOn.mock.calls.find(
        (c: unknown[]) => c[0] === 'click'
      );
      expect(clickCallback).toBeDefined();

      clickCallback![1]();
      expect(mockMainWindow.show).toHaveBeenCalled();
      expect(mockMainWindow.focus).toHaveBeenCalled();
    });

    it('should not crash when mainWindow is null', () => {
      getMainWindow = () => null;
      const handler = getHandler('show-notification');

      expect(() => handler({}, 'Title', 'Body')).not.toThrow();
    });
  });

  describe('is-window-focused', () => {
    it('should return true when window is focused', async () => {
      mockMainWindow.isFocused.mockReturnValue(true);
      const handler = getHandler('is-window-focused');

      expect(await handler({})).toBe(true);
    });

    it('should return false when window is not focused', async () => {
      mockMainWindow.isFocused.mockReturnValue(false);
      const handler = getHandler('is-window-focused');

      expect(await handler({})).toBe(false);
    });

    it('should return false when mainWindow is null', async () => {
      getMainWindow = () => null;
      const handler = getHandler('is-window-focused');

      expect(await handler({})).toBe(false);
    });
  });
});
