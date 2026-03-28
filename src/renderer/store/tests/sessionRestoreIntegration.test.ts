import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInitializeSession, mockRestoreBrowserSession, mockRestorePanelSession,
  mockRestoreTerminalSession, mockLoadPreferences, mockSetActiveFileBrowser,
  mockSetActiveFilePanel, mockSetActiveFileTerminal, mockCreateNewTerminal,
  mockInitializeExecutionState, filesStoreState, panelStoreState, terminalStoreState,
} = vi.hoisted(() => {
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
    restoreTerminalSession: mockRestoreTerminalSession,
    materializeRestoredTerminals: vi.fn().mockResolvedValue(undefined),
    setActiveFile: mockSetActiveFileTerminal,
    createNewTerminal: mockCreateNewTerminal,
  };

  return {
    mockInitializeSession, mockRestoreBrowserSession, mockRestorePanelSession,
    mockRestoreTerminalSession, mockLoadPreferences, mockSetActiveFileBrowser,
    mockSetActiveFilePanel, mockSetActiveFileTerminal, mockCreateNewTerminal,
    mockInitializeExecutionState, filesStoreState, panelStoreState, terminalStoreState,
  };
});

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

    it('should not create a default terminal when terminals already exist from restore', async () => {
      panelStoreState.activeContent = 'terminal';
      terminalStoreState.terminals = [{ id: 'restored-term-1' }];

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

  describe('materialize restored terminals', () => {
    it('should call materializeRestoredTerminals when panel shows terminal', async () => {
      panelStoreState.activeContent = 'terminal';
      terminalStoreState.terminals = [];

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(terminalStoreState.materializeRestoredTerminals).toHaveBeenCalled();
    });

    it('should not call materializeRestoredTerminals when panel is not terminal', async () => {
      panelStoreState.activeContent = 'browser';

      const onComplete = vi.fn();
      renderHook(() => useAppInitialization(onComplete));

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      expect(terminalStoreState.materializeRestoredTerminals).not.toHaveBeenCalled();
    });
  });
});
