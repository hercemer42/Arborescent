import { create } from 'zustand';

interface PendingRebindDialogState {
  pendingTerminalIds: Set<string>;
  markPending: (terminalId: string) => void;
  clearPending: (terminalId: string) => void;
  isPending: (terminalId: string) => boolean;
  clear: () => void;
}

export const usePendingRebindDialogStore = create<PendingRebindDialogState>((set, get) => ({
  pendingTerminalIds: new Set<string>(),

  markPending(terminalId: string): void {
    if (!terminalId) return;
    const existing = get().pendingTerminalIds;
    if (existing.has(terminalId)) return;
    const next = new Set(existing);
    next.add(terminalId);
    set({ pendingTerminalIds: next });
  },

  clearPending(terminalId: string): void {
    if (!terminalId) return;
    const existing = get().pendingTerminalIds;
    if (!existing.has(terminalId)) return;
    const next = new Set(existing);
    next.delete(terminalId);
    set({ pendingTerminalIds: next });
  },

  isPending(terminalId: string): boolean {
    if (!terminalId) return false;
    return get().pendingTerminalIds.has(terminalId);
  },

  clear(): void {
    set({ pendingTerminalIds: new Set<string>() });
  },
}));
