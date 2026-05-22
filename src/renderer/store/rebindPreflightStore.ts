import { create } from 'zustand';

export interface PreflightRebindRequest {
  terminalId: string;
  previousNodeId: string;
  newNodeId: string;
  replay: () => Promise<void>;
}

interface RebindPreflightState {
  current: PreflightRebindRequest | null;
  request: (req: PreflightRebindRequest) => void;
  clear: () => void;
}

export const useRebindPreflightStore = create<RebindPreflightState>((set) => ({
  current: null,

  request(req: PreflightRebindRequest): void {
    set({ current: req });
  },

  clear(): void {
    set({ current: null });
  },
}));
