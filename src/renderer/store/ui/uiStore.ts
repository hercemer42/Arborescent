import { create } from 'zustand';

interface UIState {
  isKeyboardShortcutsOpen: boolean;
  openKeyboardShortcuts: () => void;
  closeKeyboardShortcuts: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isKeyboardShortcutsOpen: false,
  openKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: true }),
  closeKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: false }),
}));
