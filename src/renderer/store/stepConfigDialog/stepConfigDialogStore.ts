import { create } from 'zustand';

interface StepConfigDialogState {
  isOpen: boolean;
  nodeId: string | null;

  open: (nodeId: string) => void;
  close: () => void;
}

export const useStepConfigDialogStore = create<StepConfigDialogState>((set) => ({
  isOpen: false,
  nodeId: null,

  open: (nodeId) => {
    set({ isOpen: true, nodeId });
  },

  close: () => {
    set({ isOpen: false, nodeId: null });
  },
}));
