import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsWindowFocused, mockShowNotification } = vi.hoisted(() => ({
  mockIsWindowFocused: vi.fn().mockResolvedValue(false),
  mockShowNotification: vi.fn().mockResolvedValue(undefined),
}));

const { mockDesktopNotifications, mockNotificationSounds } = vi.hoisted(() => ({
  mockDesktopNotifications: { value: true },
  mockNotificationSounds: { value: true },
}));

vi.mock('../../store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      desktopNotifications: mockDesktopNotifications.value,
      notificationSounds: mockNotificationSounds.value,
    }),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('workflowNotification', () => {
  let mockAudioPlay: ReturnType<typeof vi.fn>;
  let lastAudioSrc: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDesktopNotifications.value = true;
    mockNotificationSounds.value = true;
    mockIsWindowFocused.mockResolvedValue(false);

    mockAudioPlay = vi.fn().mockResolvedValue(undefined);
    lastAudioSrc = '';

    global.window = {
      electron: {
        isWindowFocused: mockIsWindowFocused,
        showNotification: mockShowNotification,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    global.Audio = vi.fn().mockImplementation((src: string) => {
      lastAudioSrc = src;
      return { play: mockAudioPlay };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  });

  describe('focus suppression', () => {
    it('should not show notification when window is focused', async () => {
      mockIsWindowFocused.mockResolvedValue(true);

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should not play sound when window is focused', async () => {
      mockIsWindowFocused.mockResolvedValue(true);

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockAudioPlay).not.toHaveBeenCalled();
    });

    it('should show notification when window is not focused', async () => {
      mockIsWindowFocused.mockResolvedValue(false);

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockShowNotification).toHaveBeenCalledWith('Workflow complete', 'Task A finished');
    });
  });

  describe('preference gating', () => {
    it('should not show notification when desktopNotifications is disabled', async () => {
      mockDesktopNotifications.value = false;

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should still play sound when desktopNotifications is disabled but notificationSounds is enabled', async () => {
      mockDesktopNotifications.value = false;
      mockNotificationSounds.value = true;

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockAudioPlay).toHaveBeenCalled();
    });

    it('should not play sound when notificationSounds is disabled', async () => {
      mockNotificationSounds.value = false;

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockAudioPlay).not.toHaveBeenCalled();
    });

    it('should still show notification when notificationSounds is disabled but desktopNotifications is enabled', async () => {
      mockNotificationSounds.value = false;
      mockDesktopNotifications.value = true;

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockShowNotification).toHaveBeenCalled();
    });

    it('should do nothing when both preferences are disabled', async () => {
      mockDesktopNotifications.value = false;
      mockNotificationSounds.value = false;

      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Workflow complete', 'Task A finished');

      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(mockAudioPlay).not.toHaveBeenCalled();
    });
  });

  describe('sound selection', () => {
    it('should play success sound for success events', async () => {
      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('success', 'Complete', 'Done');

      expect(lastAudioSrc).toContain('success');
    });

    it('should play alert sound for alert events', async () => {
      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('alert', 'Error', 'Failed');

      expect(lastAudioSrc).toContain('alert');
    });
  });

  describe('error handling', () => {
    it('should handle Audio play() rejection without throwing', async () => {
      mockAudioPlay.mockRejectedValue(new Error('Audio not available'));

      const { notifyWorkflowEvent } = await import('../workflowNotification');

      await expect(
        notifyWorkflowEvent('success', 'Complete', 'Done')
      ).resolves.not.toThrow();
    });

    it('should handle isWindowFocused IPC failure without throwing', async () => {
      mockIsWindowFocused.mockRejectedValue(new Error('IPC failed'));

      const { notifyWorkflowEvent } = await import('../workflowNotification');

      await expect(
        notifyWorkflowEvent('success', 'Complete', 'Done')
      ).resolves.not.toThrow();
    });

    it('should handle showNotification IPC failure without throwing', async () => {
      mockShowNotification.mockRejectedValue(new Error('Notification failed'));

      const { notifyWorkflowEvent } = await import('../workflowNotification');

      await expect(
        notifyWorkflowEvent('success', 'Complete', 'Done')
      ).resolves.not.toThrow();
    });
  });

  describe('IPC call parameters', () => {
    it('should pass title and body to showNotification', async () => {
      const { notifyWorkflowEvent } = await import('../workflowNotification');
      await notifyWorkflowEvent('alert', 'Step timeout', 'Task B is taking longer than expected');

      expect(mockShowNotification).toHaveBeenCalledWith(
        'Step timeout',
        'Task B is taking longer than expected'
      );
    });
  });
});
