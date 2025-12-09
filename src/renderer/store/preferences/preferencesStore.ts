import { create } from 'zustand';
import { Theme, UserPreferences } from '../../../shared/interfaces';
import { StorageService } from '@platform';
import { HotkeyConfig, setHotkeyConfig, resetHotkeyConfig } from '../../data/hotkeyConfig';
import defaultHotkeys from '../../data/defaultHotkeys.json';

interface PreferencesState {
  theme: Theme;
  hotkeys: HotkeyConfig;
  isLoaded: boolean;

  setTheme: (theme: Theme) => void;
  setHotkey: (category: string, action: string, key: string) => void;
  resetHotkeys: () => void;
  loadPreferences: () => Promise<void>;
}

const storageService = new StorageService();

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  theme: 'light',
  hotkeys: defaultHotkeys as HotkeyConfig,
  isLoaded: false,

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });

    const { hotkeys } = get();
    const preferences: UserPreferences = { theme, hotkeys };
    storageService.savePreferences(preferences);
  },

  setHotkey: (category: string, action: string, key: string) => {
    const { theme, hotkeys } = get();
    const newHotkeys = {
      ...hotkeys,
      [category]: {
        ...hotkeys[category as keyof HotkeyConfig],
        [action]: key,
      },
    } as HotkeyConfig;

    setHotkeyConfig(newHotkeys);
    set({ hotkeys: newHotkeys });

    const preferences: UserPreferences = { theme, hotkeys: newHotkeys };
    storageService.savePreferences(preferences);
  },

  resetHotkeys: () => {
    const { theme } = get();
    const newHotkeys = defaultHotkeys as HotkeyConfig;

    resetHotkeyConfig();
    set({ hotkeys: newHotkeys });

    const preferences: UserPreferences = { theme, hotkeys: newHotkeys };
    storageService.savePreferences(preferences);
  },

  loadPreferences: async () => {
    const preferences = await storageService.getPreferences();

    if (preferences) {
      const theme = preferences.theme || 'light';
      const hotkeys = (preferences.hotkeys as HotkeyConfig) || (defaultHotkeys as HotkeyConfig);

      applyTheme(theme);
      setHotkeyConfig(hotkeys);
      set({ theme, hotkeys, isLoaded: true });
    } else {
      applyTheme('light');
      set({ isLoaded: true });
    }
  },
}));
