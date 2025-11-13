import { create } from 'zustand';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

export type PanelPosition = 'side' | 'bottom';

interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  panelPosition: PanelPosition;
  isTerminalVisible: boolean;

  // Actions
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  togglePanelPosition: () => void;
  toggleTerminalVisibility: () => void;
  showTerminal: () => void;
  hideTerminal: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  terminals: [],
  activeTerminalId: null,
  panelPosition: 'side', // Default to side panel
  isTerminalVisible: false, // Default to closed

  addTerminal: (terminal: TerminalInfo) =>
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id, // Auto-focus new terminal
      isTerminalVisible: true, // Show terminal when adding a new one
    })),

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

  togglePanelPosition: () =>
    set((state) => ({
      panelPosition: state.panelPosition === 'side' ? 'bottom' : 'side',
    })),

  toggleTerminalVisibility: () =>
    set((state) => ({
      isTerminalVisible: !state.isTerminalVisible,
    })),

  showTerminal: () =>
    set({ isTerminalVisible: true }),

  hideTerminal: () =>
    set({ isTerminalVisible: false }),
}));
