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
  panelHeight: number;
  panelWidth: number;

  // Actions
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  togglePanelPosition: () => void;
  toggleTerminalVisibility: () => void;
  showTerminal: () => void;
  hideTerminal: () => void;
  setPanelHeight: (height: number) => void;
  setPanelWidth: (width: number) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  terminals: [],
  activeTerminalId: null,
  panelPosition: 'side', // Default to side panel
  isTerminalVisible: false, // Default to closed
  panelHeight: 300,
  panelWidth: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,

  addTerminal: (terminal: TerminalInfo) => {
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id, // Auto-focus new terminal
      isTerminalVisible: true, // Show terminal when adding a new one
    }));
    // Hide browser when adding a terminal (lazy import to avoid circular dependency)
    import('../browser/browserStore').then(({ useBrowserStore }) => {
      useBrowserStore.getState().actions.hideBrowser();
    });
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

  togglePanelPosition: () =>
    set((state) => ({
      panelPosition: state.panelPosition === 'side' ? 'bottom' : 'side',
    })),

  toggleTerminalVisibility: () =>
    set((state) => {
      const newVisibility = !state.isTerminalVisible;
      if (newVisibility) {
        // Hide browser when showing terminal (lazy import to avoid circular dependency)
        import('../browser/browserStore').then(({ useBrowserStore }) => {
          useBrowserStore.getState().actions.hideBrowser();
        });
      }
      return { isTerminalVisible: newVisibility };
    }),

  showTerminal: () => {
    set({ isTerminalVisible: true });
    // Hide browser when showing terminal (lazy import to avoid circular dependency)
    import('../browser/browserStore').then(({ useBrowserStore }) => {
      useBrowserStore.getState().actions.hideBrowser();
    });
  },

  hideTerminal: () =>
    set({ isTerminalVisible: false }),

  setPanelHeight: (height: number) =>
    set({ panelHeight: height }),

  setPanelWidth: (width: number) =>
    set({ panelWidth: width }),
}));
