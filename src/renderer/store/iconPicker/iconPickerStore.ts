import { create } from 'zustand';

export interface IconSelection {
  icon: string;
  color?: string;
}

interface IconPickerState {
  isOpen: boolean;
  selectedIcon: string | null;
  selectedColor: string | null;
  onSelect: ((selection: IconSelection) => void) | null;

  open: (
    selectedIcon: string | null,
    onSelect: (selection: IconSelection) => void,
    selectedColor?: string | null
  ) => void;
  close: () => void;
}

export const useIconPickerStore = create<IconPickerState>((set) => ({
  isOpen: false,
  selectedIcon: null,
  selectedColor: null,
  onSelect: null,

  open: (selectedIcon, onSelect, selectedColor = null) => {
    set({ isOpen: true, selectedIcon, selectedColor, onSelect });
  },

  close: () => {
    set({ isOpen: false, selectedIcon: null, selectedColor: null, onSelect: null });
  },
}));
