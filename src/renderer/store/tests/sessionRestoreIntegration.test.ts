import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInitializeSession, mockRestoreBrowserSession, mockRestorePanelSession,
  mockRestoreTerminalSession, mockLoadPreferences, mockSetActiveFileBrowser,
  mockSetActiveFilePanel, mockSetActiveFileTerminal, mockCreateNewTerminal,
  mockInitializeExecutionState, mockResumeAllRestoredSessions, filesStoreState, panelStoreState, terminalStoreState,
} = vi.hoisted(() => {
  const mockResumeAllRestoredSessions = vi.fn().mockResolvedValue(undefined);
  const mockInitializeSession = vi.fn().mockResolvedValue(undefined);
  const mockRestoreBrowserSession = vi.fn().mockResolvedValue(undefined);
  const mockRestorePanelSession = vi.fn().mockResolvedValue(undefined);
  const mockRestoreTerminalSession = vi.fn().mockResolvedValue(undefined);
  const mockLoadPreferences = vi.fn().mockResolvedValue(undefined);
  const mockSetActiveFileBrowser = vi.fn();
  const mockSetActiveFilePanel = vi.fn();
  const mockSetActiveFileTerminal = vi.fn();
  const mockCreateNewTerminal = vi.fn().mockResolvedValue(undefined);
  const mockInitializeExecutionState = vi.fn();

  const filesStoreState = {
    activeFilePath: '/project-a.arbo' as string | null,
    actions: { initializeSession: mockInitializeSession },
  };
  const panelStoreState = {
    activeContent: null as string | null,
    restoreSession: mockRestorePanelSession,
    setActiveFile: mockSetActiveFilePanel,
  };
  const terminalStoreState = {
    terminals: [] as Array<{ id: string }>,
    currentFilePath: '/project-a.arbo' as string | null,
    fileStates: {} as Record<string, { terminals: unknown[]; pendingRestore?: unknown[] }>,
    restoreTerminalSession: mockRestoreTerminalSession,
    materializeRestoredTerminals: vi.fn().mockResolvedValue(undefined),
    materializeAllRestoredTerminals: vi.fn().mockResolvedValue([]),
    setActiveFile: mockSetActiveFileTerminal,
    createNewTerminal: mockCreateNewTerminal,
  };

  return {
    mockInitializeSession, mockRestoreBrowserSession, mockRestorePanelSession,
    mockRestoreTerminalSession, mockLoadPreferences, mockSetActiveFileBrowser,
    mockSetActiveFilePanel, mockSetActiveFileTerminal, mockCreateNewTerminal,
    mockInitializeExecutionState, mockResumeAllRestoredSessions, filesStoreState, panelStoreState, terminalStoreState,
  };
});

vi.mock('../../services/launchSessionResume', () => ({
  resumeAllRestoredSessions: mockResumeAllRestoredSessions,
}));

vi.mock('../files/filesStore', () => {
  const useFilesStoreMock = Object.assign(
    vi.fn((selector: (s: typeof filesStoreState) => unknown) => selector(filesStoreState)),
    { getState: () => filesStoreState, subscribe: vi.fn(() => vi.fn()) }
  );
  return { useFilesStore: useFilesStoreMock };
});

vi.mock('../browser/browserStore', () => {
  const browserStoreState = {
    tabs: [],
    activeTabId: null,
    actions: {
      restoreSession: mockRestoreBrowserSession,
      setActiveFile: mockSetActiveFileBrowser,
    },
  };
  const useBrowserStoreMock = Object.assign(
    vi.fn((selector?: (s: typeof browserStoreState) => unknown) =>
      selector ? selector(browserStoreState) : browserStoreState
    ),
    { getState: () => browserStoreState }
  );
  return { useBrowserStore: useBrowserStoreMock };
});

vi.mock('../panel/panelStore', () => {
  const usePanelStoreMock = Object.assign(
    vi.fn((selector: (s: typeof panelStoreState) => unknown) => selector(panelStoreState)),
    { getState: () => panelStoreState }
  );
  return { usePanelStore: usePanelStoreMock };
});

vi.mock('../terminal/terminalStore', () => {
  const useTerminalStoreMock = Object.assign(
    vi.fn((selector: (s: typeof terminalStoreState) => unknown) => selector(terminalStoreState)),
    { getState: () => terminalStoreState }
  );
  return { useTerminalStore: useTerminalStoreMock };
});

vi.mock('../preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({ loadPreferences: mockLoadPreferences }),
  },
}));

vi.mock('../storeManager', () => ({
  storeManager: {
    getAllStores: vi.fn(() => [{
      getState: () => ({ actions: { initializeExecutionState: mockInitializeExecutionState } }),
    }]),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useAppInitialization } from '../../hooks/useAppInitialization';

describe('session restore integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filesStoreState.activeFilePath = '/project-a.arbo';
    panelStoreState.activeContent = null;
    terminalStoreState.terminals = [];
    terminalStoreState.currentFilePath = '/project-a.arbo';
    terminalStoreState.fileStates = {};
    mockInitializeSession.mockResolvedValue(undefined);
    mockRestoreBrowserSession.mockResolvedValue(undefined);
    mockRestorePanelSession.mockResolvedValue(undefined);
    mockRestoreTerminalSession.mockResolvedValue(undefined);
    mockLoadPreferences.mockResolvedValue(undefined);
  });

  describe('full restore with all three stores', () => {
    it('should call restoreTerminalSession during initialization', async () => {
      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockRestoreTerminalSession).toHaveBeenCalledTimes(1);
      expect(mockRestoreBrowserSession).toHaveBeenCalledTimes(1);
      expect(mockRestorePanelSession).toHaveBeenCalledTimes(1);
    });

    it('should call setActiveFile on all three stores after restore', async () => {
      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockSetActiveFilePanel).toHaveBeenCalledWith('/project-a.arbo');
      expect(mockSetActiveFileTerminal).toHaveBeenCalledWith('/project-a.arbo');
      expect(mockSetActiveFileBrowser).toHaveBeenCalledWith('/project-a.arbo');
    });
  });

  describe('default terminal creation with no saved session', () => {
    it('should create a default terminal when panel shows terminal and no terminals exist', async () => {
      panelStoreState.activeContent = 'terminal';
      terminalStoreState.terminals = [];

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockCreateNewTerminal).toHaveBeenCalledWith('Terminal');
    });

    it('should not create a default terminal when the active file has restored terminals pending', async () => {
      panelStoreState.activeContent = 'terminal';
      terminalStoreState.fileStates = {
        '/project-a.arbo': { terminals: [], pendingRestore: [{ title: 'T', cwd: '/a' }] },
      };

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    });

    it('should not create a terminal when panel is not showing terminal', async () => {
      panelStoreState.activeContent = 'browser';
      terminalStoreState.terminals = [];

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    });

    it('should not create a terminal when panel is null', async () => {
      panelStoreState.activeContent = null;
      terminalStoreState.terminals = [];

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    });
  });

  describe('launch session resume', () => {
    it('resumes all restored sessions at launch when the panel shows terminal', async () => {
      panelStoreState.activeContent = 'terminal';

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockResumeAllRestoredSessions).toHaveBeenCalledTimes(1);
    });

    it('resumes all restored sessions at launch even when the panel is not terminal (decoupled from the active view)', async () => {
      panelStoreState.activeContent = 'browser';

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(mockResumeAllRestoredSessions).toHaveBeenCalledTimes(1);
    });
  });
});
