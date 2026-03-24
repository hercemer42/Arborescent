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

describe('preferencesStore — notification preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.setState({
      desktopNotifications: true,
      notificationSounds: true,
      isLoaded: false,
    });
  });

  describe('defaults', () => {
    it('should default desktopNotifications to true', () => {
      expect(usePreferencesStore.getState().desktopNotifications).toBe(true);
    });

    it('should default notificationSounds to true', () => {
      expect(usePreferencesStore.getState().notificationSounds).toBe(true);
    });
  });

  describe('setDesktopNotifications', () => {
    it('should toggle desktopNotifications to false', () => {
      usePreferencesStore.getState().setDesktopNotifications(false);

      expect(usePreferencesStore.getState().desktopNotifications).toBe(false);
    });

    it('should persist the change via StorageService', () => {
      usePreferencesStore.getState().setDesktopNotifications(false);

      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ desktopNotifications: false })
      );
    });

    it('should toggle back to true', () => {
      usePreferencesStore.getState().setDesktopNotifications(false);
      usePreferencesStore.getState().setDesktopNotifications(true);

      expect(usePreferencesStore.getState().desktopNotifications).toBe(true);
    });
  });

  describe('setNotificationSounds', () => {
    it('should toggle notificationSounds to false', () => {
      usePreferencesStore.getState().setNotificationSounds(false);

      expect(usePreferencesStore.getState().notificationSounds).toBe(false);
    });

    it('should persist the change via StorageService', () => {
      usePreferencesStore.getState().setNotificationSounds(false);

      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ notificationSounds: false })
      );
    });
  });

  describe('loadPreferences with notification settings', () => {
    it('should load desktopNotifications from saved preferences', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'dark',
        desktopNotifications: false,
        notificationSounds: true,
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().desktopNotifications).toBe(false);
    });

    it('should load notificationSounds from saved preferences', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'dark',
        desktopNotifications: true,
        notificationSounds: false,
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().notificationSounds).toBe(false);
    });

    it('should default to true when notification preferences are not in saved data', async () => {
      mockGetPreferences.mockResolvedValue({
        theme: 'light',
      });

      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().desktopNotifications).toBe(true);
      expect(usePreferencesStore.getState().notificationSounds).toBe(true);
    });
  });
});
