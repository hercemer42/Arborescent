import { create } from 'zustand';

export interface TerminalCloseRequest {
  terminalId: string;
  terminalTitle: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

interface PendingTerminalCloseState {
  current: TerminalCloseRequest | null;
  requestClose: (request: TerminalCloseRequest) => void;
  clear: () => void;
}

export const usePendingTerminalCloseStore = create<PendingTerminalCloseState>((set, get) => ({
  current: null,

  requestClose(request: TerminalCloseRequest): void {
    if (get().current) return;
    set({ current: request });
  },

  clear(): void {
    if (!get().current) return;
    set({ current: null });
  },
}));
