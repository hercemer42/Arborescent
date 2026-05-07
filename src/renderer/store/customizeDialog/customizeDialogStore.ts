import { create } from 'zustand';

export interface IconSelection {
  icon: string;
  color?: string;
  collaborate?: boolean;
  execute?: boolean;
}

interface CustomizeDialogState {
  isOpen: boolean;
  selectedIcon: string | null;
  selectedColor: string | null;
  selectedCollaborate: boolean | null;
  selectedExecute: boolean | null;
  showFlagsPicker: boolean;
  onSelect: ((selection: IconSelection) => void) | null;

  open: (
    selectedIcon: string | null,
    onSelect: (selection: IconSelection) => void,
    selectedColor?: string | null,
    options?: {
      showFlagsPicker?: boolean;
      selectedCollaborate?: boolean | null;
      selectedExecute?: boolean | null;
    }
  ) => void;
  close: () => void;
  setCollaborate: (value: boolean) => void;
  setExecute: (value: boolean) => void;
}

export const useCustomizeDialogStore = create<CustomizeDialogState>((set) => ({
  isOpen: false,
  selectedIcon: null,
  selectedColor: null,
  selectedCollaborate: null,
  selectedExecute: null,
  showFlagsPicker: false,
  onSelect: null,

  open: (selectedIcon, onSelect, selectedColor = null, options) => {
    set({
      isOpen: true,
      selectedIcon,
      selectedColor,
      onSelect,
      showFlagsPicker: options?.showFlagsPicker ?? false,
      selectedCollaborate: options?.selectedCollaborate ?? null,
      selectedExecute: options?.selectedExecute ?? null,
    });
  },

  close: () => {
    set({
      isOpen: false,
      selectedIcon: null,
      selectedColor: null,
      selectedCollaborate: null,
      selectedExecute: null,
      showFlagsPicker: false,
      onSelect: null,
    });
  },

  setCollaborate: (value) => {
    set({ selectedCollaborate: value });
  },

  setExecute: (value) => {
    set({ selectedExecute: value });
  },
}));
