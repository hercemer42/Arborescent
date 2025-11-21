import { create } from 'zustand';
import { StorageService } from '../../../shared/interfaces';
import { Storage } from '../../../platforms/electron/services/Storage';
import { logger } from '../../services/logger';

export type PanelPosition = 'side' | 'bottom';
export type PanelContentType = 'terminal' | 'browser' | 'review' | null;

interface PanelSession {
  panelPosition: PanelPosition;
  panelHeight: number;
  panelWidth: number;
  activeContent: PanelContentType;
}

interface PanelState {
  panelPosition: PanelPosition;
  panelHeight: number;
  panelWidth: number;
  activeContent: PanelContentType;

  // Actions
  setPanelPosition: (position: PanelPosition) => void;
  togglePanelPosition: () => void;
  setPanelHeight: (height: number) => void;
  setPanelWidth: (width: number) => void;
  setActiveContent: (content: PanelContentType) => void;
  showTerminal: () => void;
  showBrowser: () => void;
  showReview: () => void;
  hidePanel: () => void;
  restoreSession: () => Promise<void>;
}

const storage: StorageService = new Storage();

async function savePanelSession(state: PanelState): Promise<void> {
  const session: PanelSession = {
    panelPosition: state.panelPosition,
    panelHeight: state.panelHeight,
    panelWidth: state.panelWidth,
    activeContent: state.activeContent,
  };

  try {
    await storage.savePanelSession(session);
  } catch (error) {
    logger.error('Failed to save panel session', error as Error, 'PanelStore');
  }
}

export const usePanelStore = create<PanelState>((set) => ({
  panelPosition: 'side',
  panelHeight: 300,
  panelWidth: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,
  activeContent: null,

  setPanelPosition: (position: PanelPosition) =>
    set((state) => {
      const newState = { panelPosition: position };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  togglePanelPosition: () =>
    set((state) => {
      const newState = {
        panelPosition: (state.panelPosition === 'side' ? 'bottom' : 'side') as PanelPosition,
      };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  setPanelHeight: (height: number) =>
    set((state) => {
      const newState = { panelHeight: height };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  setPanelWidth: (width: number) =>
    set((state) => {
      const newState = { panelWidth: width };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  setActiveContent: (content: PanelContentType) =>
    set((state) => {
      const newState = { activeContent: content };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  showTerminal: () =>
    set((state) => {
      const newState = { activeContent: 'terminal' as PanelContentType };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  showBrowser: () =>
    set((state) => {
      const newState = { activeContent: 'browser' as PanelContentType };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  showReview: () =>
    set((state) => {
      const newState = { activeContent: 'review' as PanelContentType };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  hidePanel: () =>
    set((state) => {
      const newState = { activeContent: null };
      savePanelSession({ ...state, ...newState });
      return newState;
    }),

  restoreSession: async () => {
    const session = await storage.getPanelSession();

    if (session) {
      set({
        panelPosition: session.panelPosition,
        panelHeight: session.panelHeight || 300,
        panelWidth: session.panelWidth || (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600),
        activeContent: session.activeContent,
      });

      logger.info('Restored panel session', 'PanelStore');
    } else {
      logger.info('No panel session found', 'PanelStore');
    }
  },
}));
