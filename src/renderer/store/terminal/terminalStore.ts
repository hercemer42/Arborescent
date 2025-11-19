import { create } from 'zustand';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;

  // Actions
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  terminals: [],
  activeTerminalId: null,

  addTerminal: (terminal: TerminalInfo) => {
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id,
    }));
  },

  removeTerminal: (id: string) =>
    set((state) => {
      const newTerminals = state.terminals.filter((t) => t.id !== id);
      const newActiveId =
        state.activeTerminalId === id
          ? newTerminals[0]?.id || null
          : state.activeTerminalId;

      return {
        terminals: newTerminals,
        activeTerminalId: newActiveId,
      };
    }),

  setActiveTerminal: (id: string | null) =>
    set({ activeTerminalId: id }),

  updateTerminal: (id: string, updates: Partial<TerminalInfo>) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
}));
