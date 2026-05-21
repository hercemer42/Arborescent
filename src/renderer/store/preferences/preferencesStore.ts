import { create } from 'zustand';
import { Theme, UserPreferences } from '../../../shared/interfaces';
import { StorageService } from '../../services/storageService';
import { HotkeyConfig, setHotkeyConfig, resetHotkeyConfig } from '../../utils/hotkeyConfig';
import defaultHotkeys from '../../utils/defaultHotkeys.json';

interface PreferencesState {
  theme: Theme;
  hotkeys: HotkeyConfig;
  isLoaded: boolean;
  hasSeenWorkflowDeclarationToast: boolean;
  hasReceivedHookEvent: boolean;
  hasLaunchedWorkflow: boolean;
  stepTimeoutMinutes: number;
  desktopNotifications: boolean;
  notificationSounds: boolean;

  setTheme: (theme: Theme) => void;
  setHotkey: (category: string, action: string, key: string) => void;
  resetHotkeys: () => void;
  loadPreferences: () => Promise<void>;
  markWorkflowDeclarationToastSeen: () => void;
  markHookEventReceived: () => void;
  markWorkflowLaunched: () => void;
  setStepTimeoutMinutes: (minutes: number) => void;
  setDesktopNotifications: (enabled: boolean) => void;
  setNotificationSounds: (enabled: boolean) => void;
}

const storageService = new StorageService();

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function buildPreferences(state: PreferencesState): UserPreferences {
  return {
    theme: state.theme,
    hotkeys: state.hotkeys,
    hasSeenWorkflowDeclarationToast: state.hasSeenWorkflowDeclarationToast,
    hasReceivedHookEvent: state.hasReceivedHookEvent,
    hasLaunchedWorkflow: state.hasLaunchedWorkflow,
    stepTimeoutMinutes: state.stepTimeoutMinutes,
    desktopNotifications: state.desktopNotifications,
    notificationSounds: state.notificationSounds,
  };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  theme: 'light',
  hotkeys: defaultHotkeys as HotkeyConfig,
  isLoaded: false,
  hasSeenWorkflowDeclarationToast: false,
  hasReceivedHookEvent: false,
  hasLaunchedWorkflow: false,
  stepTimeoutMinutes: 10,
  desktopNotifications: true,
  notificationSounds: true,

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
    void storageService.savePreferences(buildPreferences(get()));
  },

  setHotkey: (category: string, action: string, key: string) => {
    const { hotkeys } = get();
    const newHotkeys = {
      ...hotkeys,
      [category]: {
        ...hotkeys[category as keyof HotkeyConfig],
        [action]: key,
      },
    } as HotkeyConfig;

    setHotkeyConfig(newHotkeys);
    set({ hotkeys: newHotkeys });
    void storageService.savePreferences(buildPreferences(get()));
  },

  resetHotkeys: () => {
    const newHotkeys = defaultHotkeys as HotkeyConfig;

    resetHotkeyConfig();
    set({ hotkeys: newHotkeys });
    void storageService.savePreferences(buildPreferences(get()));
  },

  loadPreferences: async () => {
    const preferences = await storageService.getPreferences();

    if (preferences) {
      const theme = preferences.theme || 'light';
      const loadedHotkeys = (preferences.hotkeys as HotkeyConfig) || (defaultHotkeys as HotkeyConfig);
      const hotkeys: HotkeyConfig =
        loadedHotkeys.file?.reload === 'CmdOrCtrl+R'
          ? { ...loadedHotkeys, file: { ...loadedHotkeys.file, reload: '' } }
          : loadedHotkeys;
      const hasSeenWorkflowDeclarationToast = preferences.hasSeenWorkflowDeclarationToast || false;
      const hasReceivedHookEvent = preferences.hasReceivedHookEvent || false;
      const hasLaunchedWorkflow = preferences.hasLaunchedWorkflow || false;
      const stepTimeoutMinutes = preferences.stepTimeoutMinutes ?? 10;
      const desktopNotifications = preferences.desktopNotifications ?? true;
      const notificationSounds = preferences.notificationSounds ?? true;

      applyTheme(theme);
      setHotkeyConfig(hotkeys);
      set({ theme, hotkeys, hasSeenWorkflowDeclarationToast, hasReceivedHookEvent, hasLaunchedWorkflow, stepTimeoutMinutes, desktopNotifications, notificationSounds, isLoaded: true });
    } else {
      applyTheme('light');
      set({ isLoaded: true });
    }
  },

  markWorkflowDeclarationToastSeen: () => {
    set({ hasSeenWorkflowDeclarationToast: true });
    void storageService.savePreferences(buildPreferences(get()));
  },

  markHookEventReceived: () => {
    set({ hasReceivedHookEvent: true });
    void storageService.savePreferences(buildPreferences(get()));
  },

  markWorkflowLaunched: () => {
    set({ hasLaunchedWorkflow: true });
    void storageService.savePreferences(buildPreferences(get()));
  },

  setStepTimeoutMinutes: (minutes: number) => {
    set({ stepTimeoutMinutes: minutes });
    void storageService.savePreferences(buildPreferences(get()));
  },

  setDesktopNotifications: (enabled: boolean) => {
    set({ desktopNotifications: enabled });
    void storageService.savePreferences(buildPreferences(get()));
  },

  setNotificationSounds: (enabled: boolean) => {
    set({ notificationSounds: enabled });
    void storageService.savePreferences(buildPreferences(get()));
  },
}));
