import { create } from 'zustand';
import { ContextMode } from '../tree/treeStore';

export interface IconSelection {
  icon: string;
  color?: string;
  mode?: ContextMode;
}

interface CustomizeDialogState {
  isOpen: boolean;
  selectedIcon: string | null;
  selectedColor: string | null;
  selectedMode: ContextMode | null;
  showModeToggle: boolean;
  onSelect: ((selection: IconSelection) => void) | null;

  open: (
    selectedIcon: string | null,
    onSelect: (selection: IconSelection) => void,
    selectedColor?: string | null,
    options?: { showModeToggle?: boolean; selectedMode?: ContextMode | null }
  ) => void;
  close: () => void;
  setMode: (mode: ContextMode) => void;
}

export const useCustomizeDialogStore = create<CustomizeDialogState>((set) => ({
  isOpen: false,
  selectedIcon: null,
  selectedColor: null,
  selectedMode: null,
  showModeToggle: false,
  onSelect: null,

  open: (selectedIcon, onSelect, selectedColor = null, options) => {
    set({
      isOpen: true,
      selectedIcon,
      selectedColor,
      onSelect,
      showModeToggle: options?.showModeToggle ?? false,
      selectedMode: options?.selectedMode ?? 'collaborate',
    });
  },

  close: () => {
    set({
      isOpen: false,
      selectedIcon: null,
      selectedColor: null,
      selectedMode: null,
      showModeToggle: false,
      onSelect: null,
    });
  },

  setMode: (mode) => {
    set({ selectedMode: mode });
  },
}));
