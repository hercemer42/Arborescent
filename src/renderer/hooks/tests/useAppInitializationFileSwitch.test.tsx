import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useAppInitialization } from '../useAppInitialization';

vi.mock('../../services/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/launchSessionResume', () => ({
  resumeAllRestoredSessions: vi.fn().mockResolvedValue(undefined),
}));

const h = vi.hoisted(() => ({
  subscriber: null as ((s: { activeFilePath: string | null }) => void) | null,
  setActiveFilePanel: vi.fn(),
  setActiveFileTerminal: vi.fn(),
  setActiveFileBrowser: vi.fn(),
  materializeRestored: vi.fn().mockResolvedValue(undefined),
  activeContent: 'terminal' as 'terminal' | 'browser' | null,
}));

vi.mock('../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: () => ({
      actions: { initializeSession: vi.fn().mockResolvedValue(undefined) },
      activeFilePath: '/a.arbo',
    }),
    subscribe: (cb: (s: { activeFilePath: string | null }) => void) => {
      h.subscriber = cb;
      return () => {};
    },
  },
}));
vi.mock('../../store/browser/browserStore', () => ({
  useBrowserStore: {
    getState: () => ({
      actions: { restoreSession: vi.fn().mockResolvedValue(undefined), setActiveFile: h.setActiveFileBrowser },
    }),
  },
}));
vi.mock('../../store/preferences/preferencesStore', () => ({
  usePreferencesStore: { getState: () => ({ loadPreferences: vi.fn().mockResolvedValue(undefined) }) },
}));
vi.mock('../../store/storeManager', () => ({ storeManager: { getAllStores: () => [] } }));
vi.mock('../../store/panel/panelStore', () => ({
  usePanelStore: {
    getState: () => ({
      restoreSession: vi.fn().mockResolvedValue(undefined),
      setActiveFile: h.setActiveFilePanel,
      activeContent: h.activeContent,
    }),
  },
}));
vi.mock('../../store/terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      restoreTerminalSession: vi.fn().mockResolvedValue(undefined),
      setActiveFile: h.setActiveFileTerminal,
      materializeRestoredTerminals: h.materializeRestored,
      materializeAllRestoredTerminals: vi.fn().mockResolvedValue([]),
      currentFilePath: '/a.arbo',
      fileStates: {},
      createNewTerminal: vi.fn().mockResolvedValue(null),
    }),
  },
}));

async function mountAndCaptureSubscriber() {
  const onComplete = vi.fn();
  renderHook(() => useAppInitialization(onComplete));
  await waitFor(() => expect(onComplete).toHaveBeenCalled());
  await waitFor(() => expect(h.subscriber).toBeTypeOf('function'));
  return h.subscriber!;
}

describe('useAppInitialization — file-switch subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.subscriber = null;
    h.activeContent = 'terminal';
  });

  it('propagates the new active file to the panel, terminal, and browser stores', async () => {
    const onFileSwitch = await mountAndCaptureSubscriber();

    onFileSwitch({ activeFilePath: '/b.arbo' });

    expect(h.setActiveFilePanel).toHaveBeenCalledWith('/b.arbo');
    expect(h.setActiveFileTerminal).toHaveBeenCalledWith('/b.arbo');
    expect(h.setActiveFileBrowser).toHaveBeenCalledWith('/b.arbo');
  });

  it('does NOT materialize restored terminals on switch — the launch fan-out owns that, and racing it leaves the session unresumed', async () => {
    const onFileSwitch = await mountAndCaptureSubscriber();

    onFileSwitch({ activeFilePath: '/b.arbo' });

    expect(h.materializeRestored).not.toHaveBeenCalled();
  });

  it('does not materialize even when the terminal panel is the active view', async () => {
    h.activeContent = 'terminal';
    const onFileSwitch = await mountAndCaptureSubscriber();

    onFileSwitch({ activeFilePath: '/b.arbo' });

    expect(h.materializeRestored).not.toHaveBeenCalled();
  });
});
