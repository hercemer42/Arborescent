import { create } from 'zustand';

interface IconPickerState {
  isOpen: boolean;
  selectedIcon: string | null;
  onSelect: ((icon: string) => void) | null;

  open: (selectedIcon: string | null, onSelect: (icon: string) => void) => void;
  close: () => void;
}

export const useIconPickerStore = create<IconPickerState>((set) => ({
  isOpen: false,
  selectedIcon: null,
  onSelect: null,

  open: (selectedIcon, onSelect) => {
    set({ isOpen: true, selectedIcon, onSelect });
  },

  close: () => {
    set({ isOpen: false, selectedIcon: null, onSelect: null });
  },
}));
