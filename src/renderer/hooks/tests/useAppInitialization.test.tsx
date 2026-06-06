import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useAppInitialization } from '../useAppInitialization';
import { resumeAllRestoredSessions } from '../../services/launchSessionResume';

vi.mock('../../services/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/launchSessionResume', () => ({ resumeAllRestoredSessions: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: () => ({ actions: { initializeSession: vi.fn().mockResolvedValue(undefined) }, activeFilePath: '/a.arbo' }),
    subscribe: vi.fn(() => () => {}),
  },
}));
vi.mock('../../store/browser/browserStore', () => ({
  useBrowserStore: {
    getState: () => ({ actions: { restoreSession: vi.fn().mockResolvedValue(undefined), setActiveFile: vi.fn() } }),
  },
}));
vi.mock('../../store/preferences/preferencesStore', () => ({
  usePreferencesStore: { getState: () => ({ loadPreferences: vi.fn().mockResolvedValue(undefined) }) },
}));
vi.mock('../../store/storeManager', () => ({ storeManager: { getAllStores: () => [] } }));

const { panelState, terminalState } = vi.hoisted(() => ({
  panelState: { activeContent: 'browser' as 'terminal' | 'browser' | null },
  terminalState: {
    currentFilePath: '/a.arbo' as string | null,
    fileStates: {} as Record<string, { terminals: unknown[]; pendingRestore?: unknown[] }>,
    createNewTerminal: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../store/panel/panelStore', () => ({
  usePanelStore: { getState: () => ({ restoreSession: vi.fn().mockResolvedValue(undefined), setActiveFile: vi.fn(), activeContent: panelState.activeContent }) },
}));
vi.mock('../../store/terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      restoreTerminalSession: vi.fn().mockResolvedValue(undefined),
      setActiveFile: vi.fn(),
      currentFilePath: terminalState.currentFilePath,
      fileStates: terminalState.fileStates,
      createNewTerminal: terminalState.createNewTerminal,
    }),
  },
}));

describe('useAppInitialization — launch session resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panelState.activeContent = 'browser';
    terminalState.currentFilePath = '/a.arbo';
    terminalState.fileStates = {};
    terminalState.createNewTerminal.mockResolvedValue(null);
    vi.mocked(resumeAllRestoredSessions).mockResolvedValue(undefined);
  });

  it('resumes all restored sessions at launch', async () => {
    const onComplete = vi.fn();
    renderHook(() => useAppInitialization(onComplete));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(resumeAllRestoredSessions).toHaveBeenCalledTimes(1);
  });

  it('resumes even when the terminal panel is not the active view', async () => {
    panelState.activeContent = null;
    const onComplete = vi.fn();
    renderHook(() => useAppInitialization(onComplete));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(resumeAllRestoredSessions).toHaveBeenCalledTimes(1);
  });

  it('does not block startup on the resumes — onComplete fires before they finish', async () => {
    vi.mocked(resumeAllRestoredSessions).mockReturnValue(new Promise<void>(() => {}));
    const onComplete = vi.fn();
    renderHook(() => useAppInitialization(onComplete));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(resumeAllRestoredSessions).toHaveBeenCalled();
  });

  it('opens a fresh terminal when the active terminal view has nothing to restore', async () => {
    panelState.activeContent = 'terminal';
    terminalState.fileStates = { '/a.arbo': { terminals: [] } };
    const onComplete = vi.fn();
    renderHook(() => useAppInitialization(onComplete));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(terminalState.createNewTerminal).toHaveBeenCalledWith('Terminal');
  });

  it('does not open a fresh terminal when the active file has restored terminals pending', async () => {
    panelState.activeContent = 'terminal';
    terminalState.fileStates = { '/a.arbo': { terminals: [], pendingRestore: [{ title: 'T', cwd: '/a' }] } };
    const onComplete = vi.fn();
    renderHook(() => useAppInitialization(onComplete));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(terminalState.createNewTerminal).not.toHaveBeenCalled();
  });
});
