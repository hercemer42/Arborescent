import { create } from 'zustand';

export interface NewSessionStartRequest {
  nodeId: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

interface PendingNewSessionStartState {
  current: NewSessionStartRequest | null;
  request: (request: NewSessionStartRequest) => void;
  clear: () => void;
}

export const usePendingNewSessionStartStore = create<PendingNewSessionStartState>((set, get) => ({
  current: null,

  request(request: NewSessionStartRequest): void {
    if (get().current) return;
    set({ current: request });
  },

  clear(): void {
    if (!get().current) return;
    set({ current: null });
  },
}));
