import { create } from 'zustand';
import { StorageService } from '../../services/storageService';
import { logger } from '../../services/logger';
import { resolveToSourceFilePath } from '../../utils/zoomPath';

export type PanelPosition = 'side' | 'bottom';
export type PanelContentType = 'terminal' | 'browser' | 'feedback' | null;

interface FilePanelState {
  activeContent: PanelContentType;
  previousContent: PanelContentType;
}

interface PanelSession {
  panelPosition: PanelPosition;
  panelHeight: number;
  panelWidth: number;
  activeContent: PanelContentType;
  fileStates?: Record<string, FilePanelState>;
}

interface PanelState {
  panelPosition: PanelPosition;
  panelHeight: number;
  panelWidth: number;
  activeContent: PanelContentType;
  previousContent: PanelContentType;
  currentFilePath: string | null;
  fileStates: Record<string, FilePanelState>;

  setActiveFile: (filePath: string | null) => void;
  setPanelPosition: (position: PanelPosition) => void;
  togglePanelPosition: () => void;
  setPanelHeight: (height: number) => void;
  setPanelWidth: (width: number) => void;
  setActiveContent: (content: PanelContentType) => void;
  showTerminal: () => void;
  showBrowser: () => void;
  showFeedback: () => void;
  showFeedbackForFile: (filePath: string | null) => void;
  closeFeedback: (filePath?: string | null) => void;
  hidePanel: () => void;
  removeFileState: (filePath: string) => void;
  restoreSession: () => Promise<void>;
}

const storage = new StorageService();

function getFileState(fileStates: Record<string, FilePanelState>, filePath: string | null): FilePanelState {
  if (!filePath) return { activeContent: null, previousContent: null };
  return fileStates[filePath] || { activeContent: null, previousContent: null };
}

function updateFileState(
  fileStates: Record<string, FilePanelState>,
  filePath: string | null,
  update: Partial<FilePanelState>,
): Record<string, FilePanelState> {
  if (!filePath) return fileStates;
  const current = fileStates[filePath] || { activeContent: null, previousContent: null };
  return { ...fileStates, [filePath]: { ...current, ...update } };
}

async function savePanelSession(state: PanelState): Promise<void> {
  const session: PanelSession = {
    panelPosition: state.panelPosition,
    panelHeight: state.panelHeight,
    panelWidth: state.panelWidth,
    activeContent: state.activeContent,
    fileStates: state.fileStates,
  };

  try {
    await storage.savePanelSession(session);
  } catch (error) {
    logger.error('Failed to save panel session', error as Error, 'PanelStore');
  }
}

export const usePanelStore = create<PanelState>((set, get) => ({
  panelPosition: 'side',
  panelHeight: 300,
  panelWidth: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,
  activeContent: null,
  previousContent: null,
  currentFilePath: null,
  fileStates: {},

  setActiveFile: (filePath: string | null) => {
    const resolved = resolveToSourceFilePath(filePath);
    const { fileStates } = get();
    const fileState = getFileState(fileStates, resolved);
    set({
      currentFilePath: resolved,
      activeContent: fileState.activeContent,
      previousContent: fileState.previousContent,
    });
  },

  setPanelPosition: (position: PanelPosition) =>
    set((state) => {
      const newState = { panelPosition: position };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  togglePanelPosition: () =>
    set((state) => {
      const newState = {
        panelPosition: (state.panelPosition === 'side' ? 'bottom' : 'side') as PanelPosition,
      };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  setPanelHeight: (height: number) =>
    set((state) => {
      const newState = { panelHeight: height };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  setPanelWidth: (width: number) =>
    set((state) => {
      const newState = { panelWidth: width };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  setActiveContent: (content: PanelContentType) =>
    set((state) => {
      const newFileStates = updateFileState(state.fileStates, state.currentFilePath, { activeContent: content });
      const newState = { activeContent: content, fileStates: newFileStates };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  showTerminal: () =>
    set((state) => {
      if (!state.currentFilePath) return {};
      const newFileStates = updateFileState(state.fileStates, state.currentFilePath, { activeContent: 'terminal' });
      const newState = { activeContent: 'terminal' as PanelContentType, fileStates: newFileStates };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  showBrowser: () =>
    set((state) => {
      if (!state.currentFilePath) return {};
      const newFileStates = updateFileState(state.fileStates, state.currentFilePath, { activeContent: 'browser' });
      const newState = { activeContent: 'browser' as PanelContentType, fileStates: newFileStates };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  showFeedback: () => get().showFeedbackForFile(get().currentFilePath),

  showFeedbackForFile: (filePath: string | null) =>
    set((state) => {
      const resolved = resolveToSourceFilePath(filePath);
      if (!resolved) return {};
      const targetFileState = getFileState(state.fileStates, resolved);
      const newPreviousContent = targetFileState.activeContent !== 'feedback'
        ? targetFileState.activeContent
        : targetFileState.previousContent;
      const newFileStates = updateFileState(state.fileStates, resolved, {
        activeContent: 'feedback',
        previousContent: newPreviousContent,
      });
      const isCurrentFile = resolved === state.currentFilePath;
      const newState = isCurrentFile
        ? {
            activeContent: 'feedback' as PanelContentType,
            previousContent: newPreviousContent,
            fileStates: newFileStates,
          }
        : { fileStates: newFileStates };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  closeFeedback: (filePath?: string | null) =>
    set((state) => {
      const targetFilePath = filePath !== undefined ? filePath : state.currentFilePath;
      if (!targetFilePath) return {};
      const targetFileState = getFileState(state.fileStates, targetFilePath);
      if (targetFileState.activeContent !== 'feedback') return {};
      const newFileStates = updateFileState(state.fileStates, targetFilePath, {
        activeContent: targetFileState.previousContent,
        previousContent: null,
      });
      const isCurrentFile = targetFilePath === state.currentFilePath;
      const newState = isCurrentFile
        ? {
            activeContent: targetFileState.previousContent,
            previousContent: null as PanelContentType,
            fileStates: newFileStates,
          }
        : { fileStates: newFileStates };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  hidePanel: () =>
    set((state) => {
      if (!state.currentFilePath) return {};
      const newFileStates = updateFileState(state.fileStates, state.currentFilePath, { activeContent: null });
      const newState = { activeContent: null as PanelContentType, fileStates: newFileStates };
      void savePanelSession({ ...state, ...newState });
      return newState;
    }),

  removeFileState: (filePath: string) =>
    set((state) => {
      const updated = { ...state.fileStates };
      delete updated[filePath];
      return { fileStates: updated };
    }),

  restoreSession: async () => {
    const session = await storage.getPanelSession();

    if (session) {
      const fileStates = session.fileStates || {};
      set({
        panelPosition: session.panelPosition,
        panelHeight: session.panelHeight || 300,
        panelWidth: session.panelWidth || (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600),
        fileStates,
      });

      logger.info('Restored panel session', 'PanelStore');
    } else {
      logger.info('No panel session found', 'PanelStore');
    }
  },
}));
