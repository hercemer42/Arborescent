import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSaveTerminalSession, mockGetTerminalSession } = vi.hoisted(() => ({
  mockSaveTerminalSession: vi.fn(),
  mockGetTerminalSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: vi.fn(),
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: mockSaveTerminalSession,
    getTerminalSession: mockGetTerminalSession,
  })),
}));

import { useTerminalStore } from '../terminalStore';

const mockTerminalGetCwd = vi.fn();
const mockTerminalDestroy = vi.fn().mockResolvedValue(undefined);

describe('terminal session cwd refresh on save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: null,
      fileStates: {},
    });
    window.electron = {
      ...window.electron,
      terminalGetCwd: mockTerminalGetCwd,
      terminalDestroy: mockTerminalDestroy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('should persist the live cwd returned by terminalGetCwd instead of the stored initial cwd', async () => {
    mockTerminalGetCwd.mockResolvedValue('/Users/brianfox/dev/Arborescent');

    useTerminalStore.getState().setActiveFile('/a.arbo');
    useTerminalStore.getState().addTerminal({
      id: 'term-1',
      title: 'Terminal',
      cwd: '/Users/brianfox',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());

    const lastCall = mockSaveTerminalSession.mock.calls.at(-1)![0];
    expect(lastCall.fileStates['/a.arbo'].terminals[0].cwd).toBe(
      '/Users/brianfox/dev/Arborescent',
    );
    expect(mockTerminalGetCwd).toHaveBeenCalledWith('term-1');
  });

  it('should fall back to the stored cwd when terminalGetCwd returns null', async () => {
    mockTerminalGetCwd.mockResolvedValue(null);

    useTerminalStore.getState().setActiveFile('/a.arbo');
    useTerminalStore.getState().addTerminal({
      id: 'term-1',
      title: 'Terminal',
      cwd: '/Users/brianfox',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());

    const lastCall = mockSaveTerminalSession.mock.calls.at(-1)![0];
    expect(lastCall.fileStates['/a.arbo'].terminals[0].cwd).toBe('/Users/brianfox');
  });

  it('should fall back to the stored cwd when terminalGetCwd throws', async () => {
    mockTerminalGetCwd.mockRejectedValue(new Error('lsof failed'));

    useTerminalStore.getState().setActiveFile('/a.arbo');
    useTerminalStore.getState().addTerminal({
      id: 'term-1',
      title: 'Terminal',
      cwd: '/Users/brianfox',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());

    const lastCall = mockSaveTerminalSession.mock.calls.at(-1)![0];
    expect(lastCall.fileStates['/a.arbo'].terminals[0].cwd).toBe('/Users/brianfox');
  });

  it('should refresh cwd for each terminal across multiple files', async () => {
    mockTerminalGetCwd.mockImplementation(async (id: string) => {
      if (id === 'term-1') return '/live/one';
      if (id === 'term-2') return '/live/two';
      return null;
    });

    useTerminalStore.getState().setActiveFile('/a.arbo');
    useTerminalStore.getState().addTerminal({
      id: 'term-1', title: 'A', cwd: '/home',
      shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
    });
    useTerminalStore.getState().setActiveFile('/b.arbo');
    useTerminalStore.getState().addTerminal({
      id: 'term-2', title: 'B', cwd: '/home',
      shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
    });

    await vi.waitFor(() => {
      const calls = mockSaveTerminalSession.mock.calls;
      const lastCall = calls.at(-1)?.[0];
      expect(lastCall?.fileStates['/a.arbo']?.terminals[0]?.cwd).toBe('/live/one');
      expect(lastCall?.fileStates['/b.arbo']?.terminals[0]?.cwd).toBe('/live/two');
    });
  });
});
