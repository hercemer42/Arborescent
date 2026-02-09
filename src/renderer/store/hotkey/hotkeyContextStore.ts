import { create } from 'zustand';
import { HotkeyContext } from '../../services/keyboard/types';

function getContextFromFocus(): HotkeyContext {
  const activeElement = document.activeElement;
  if (!activeElement) return 'tree';
  if (activeElement.tagName.toLowerCase() === 'webview') return 'browser';
  if ((activeElement as Element).closest('.terminal-panel')) return 'terminal';
  if ((activeElement as Element).closest('.browser-panel')) return 'browser';
  return 'tree';
}

interface HotkeyContextState {
  context: HotkeyContext;
  isInitialized: boolean;
  setContext: (context: HotkeyContext) => void;
  setInitialized: (initialized: boolean) => void;
  isHotkeyActiveInContext: (requiredContext: string) => boolean;
}

export const useHotkeyContextStore = create<HotkeyContextState>((set, get) => ({
  context: 'tree',
  isInitialized: false,

  setContext: (context) => set({ context }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),

  isHotkeyActiveInContext: (requiredContext) => {
    const { context, isInitialized } = get();

    if (!isInitialized) return false;

    if (context === 'modal') return false;

    if (requiredContext === 'global') return true;

    // Determine context from actual DOM focus, not stored panel visibility
    const focusContext = getContextFromFocus();
    return focusContext === requiredContext;
  }
}));

// Selector hooks for better performance
export const useHotkeyContext = () => useHotkeyContextStore((state) => state.context);
export const useHotkeyInitialized = () => useHotkeyContextStore((state) => state.isInitialized);
export const useSetHotkeyContext = () => useHotkeyContextStore((state) => state.setContext);
export const useSetHotkeyInitialized = () => useHotkeyContextStore((state) => state.setInitialized);
export const useIsHotkeyActiveInContext = () => useHotkeyContextStore((state) => state.isHotkeyActiveInContext);