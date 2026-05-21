import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSavePreferences, mockGetPreferences } = vi.hoisted(() => ({
  mockSavePreferences: vi.fn().mockResolvedValue(undefined),
  mockGetPreferences: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    savePreferences: mockSavePreferences,
    getPreferences: mockGetPreferences,
  })),
}));

vi.mock('../../../utils/hotkeyConfig', () => ({
  setHotkeyConfig: vi.fn(),
  resetHotkeyConfig: vi.fn(),
}));

vi.mock('../../../utils/defaultHotkeys.json', () => ({
  default: { navigation: {}, editing: {} },
}));

import { usePreferencesStore } from '../preferencesStore';

describe('preferencesStore — hook event tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.setState({
      hasReceivedHookEvent: false,
      stepTimeoutMinutes: 10,
      isLoaded: false,
    });
  });

  describe('markHookEventReceived', () => {
    it('should set hasReceivedHookEvent to true', () => {
      usePreferencesStore.getState().markHookEventReceived();

      expect(usePreferencesStore.getState().hasReceivedHookEvent).toBe(true);
    });

    it('should persist the updated flag via StorageService', () => {
      usePreferencesStore.getState().markHookEventReceived();

      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ hasReceivedHookEvent: true })
      );
    });

    it('should be idempotent — calling twice persists only once per call', () => {
      usePreferencesStore.getState().markHookEventReceived();
      usePreferencesStore.getState().markHookEventReceived();

      expect(usePreferencesStore.getState().hasReceivedHookEvent).toBe(true);
      expect(mockSavePreferences).toHaveBeenCalledTimes(2);
    });
  });

  describe('setStepTimeoutMinutes', () => {
    it('should update the timeout value in state', () => {
      usePreferencesStore.getState().setStepTimeoutMinutes(5);

      expect(usePreferencesStore.getState().stepTimeoutMinutes).toBe(5);
    });

    it('should persist the updated value via StorageService', () => {
      usePreferencesStore.getState().setStepTimeoutMinutes(15);

      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ stepTimeoutMinutes: 15 })
      );
    });

    it('should accept 0 as a valid value to disable timeouts', () => {
      usePreferencesStore.getState().setStepTimeoutMinutes(0);

      expect(usePreferencesStore.getState().stepTimeoutMinutes).toBe(0);
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ stepTimeoutMinutes: 0 })
      );
    });
  });

  describe('loadPreferences — new field defaults', () => {
    it('should default hasReceivedHookEvent to false when missing from saved data', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'dark',
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().hasReceivedHookEvent).toBe(false);
    });

    it('should default stepTimeoutMinutes to 10 when missing from saved data', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'dark',
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().stepTimeoutMinutes).toBe(10);
    });

    it('should preserve existing hasReceivedHookEvent value from saved data', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'light',
        hasReceivedHookEvent: true,
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().hasReceivedHookEvent).toBe(true);
    });

    it('should preserve existing stepTimeoutMinutes value from saved data', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'light',
        stepTimeoutMinutes: 5,
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().stepTimeoutMinutes).toBe(5);
    });

    it('should default both fields when no preferences exist at all', async () => {
      mockGetPreferences.mockResolvedValue(null);

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().hasReceivedHookEvent).toBe(false);
      expect(usePreferencesStore.getState().stepTimeoutMinutes).toBe(10);
    });
  });

  describe('loadPreferences — file.reload binding migration', () => {
    it('should clear file.reload when persisted prefs still hold the legacy CmdOrCtrl+R default', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'light',
        hotkeys: {
          file: { reload: 'CmdOrCtrl+R', new: 'CmdOrCtrl+N' },
          navigation: {},
          editing: {},
        },
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().hotkeys.file.reload).toBe('');
    });

    it('should preserve a user-customised file.reload binding', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'light',
        hotkeys: {
          file: { reload: 'CmdOrCtrl+Shift+R', new: 'CmdOrCtrl+N' },
          navigation: {},
          editing: {},
        },
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().hotkeys.file.reload).toBe('CmdOrCtrl+Shift+R');
    });

    it('should leave file.reload untouched when already empty', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'light',
        hotkeys: {
          file: { reload: '', new: 'CmdOrCtrl+N' },
          navigation: {},
          editing: {},
        },
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().hotkeys.file.reload).toBe('');
    });
  });

  describe('buildPreferences — serialization', () => {
    it('should include hasReceivedHookEvent in persisted output', () => {
      usePreferencesStore.setState({ hasReceivedHookEvent: true });

      usePreferencesStore.getState().markHookEventReceived();

      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ hasReceivedHookEvent: true })
      );
    });

    it('should include stepTimeoutMinutes in persisted output', () => {
      usePreferencesStore.getState().setStepTimeoutMinutes(20);

      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ stepTimeoutMinutes: 20 })
      );
    });
  });
});
