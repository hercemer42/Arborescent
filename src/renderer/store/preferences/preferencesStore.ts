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
  stepTimeoutMinutes: number;

  setTheme: (theme: Theme) => void;
  setHotkey: (category: string, action: string, key: string) => void;
  resetHotkeys: () => void;
  loadPreferences: () => Promise<void>;
  markWorkflowDeclarationToastSeen: () => void;
  markHookEventReceived: () => void;
  setStepTimeoutMinutes: (minutes: number) => void;
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
    stepTimeoutMinutes: state.stepTimeoutMinutes,
  };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  theme: 'light',
  hotkeys: defaultHotkeys as HotkeyConfig,
  isLoaded: false,
  hasSeenWorkflowDeclarationToast: false,
  hasReceivedHookEvent: false,
  stepTimeoutMinutes: 10,

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
    storageService.savePreferences(buildPreferences(get()));
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
    storageService.savePreferences(buildPreferences(get()));
  },

  resetHotkeys: () => {
    const newHotkeys = defaultHotkeys as HotkeyConfig;

    resetHotkeyConfig();
    set({ hotkeys: newHotkeys });
    storageService.savePreferences(buildPreferences(get()));
  },

  loadPreferences: async () => {
    const preferences = await storageService.getPreferences();

    if (preferences) {
      const theme = preferences.theme || 'light';
      const hotkeys = (preferences.hotkeys as HotkeyConfig) || (defaultHotkeys as HotkeyConfig);
      const hasSeenWorkflowDeclarationToast = preferences.hasSeenWorkflowDeclarationToast || false;
      const hasReceivedHookEvent = preferences.hasReceivedHookEvent || false;
      const stepTimeoutMinutes = preferences.stepTimeoutMinutes ?? 10;

      applyTheme(theme);
      setHotkeyConfig(hotkeys);
      set({ theme, hotkeys, hasSeenWorkflowDeclarationToast, hasReceivedHookEvent, stepTimeoutMinutes, isLoaded: true });
    } else {
      applyTheme('light');
      set({ isLoaded: true });
    }
  },

  markWorkflowDeclarationToastSeen: () => {
    set({ hasSeenWorkflowDeclarationToast: true });
    storageService.savePreferences(buildPreferences(get()));
  },

  markHookEventReceived: () => {
    set({ hasReceivedHookEvent: true });
    storageService.savePreferences(buildPreferences(get()));
  },

  setStepTimeoutMinutes: (minutes: number) => {
    set({ stepTimeoutMinutes: minutes });
    storageService.savePreferences(buildPreferences(get()));
  },
}));
