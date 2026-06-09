import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGetAllStoreEntries } = vi.hoisted(() => ({ mockGetAllStoreEntries: vi.fn() }));
vi.mock('../../../../store/storeManager', () => ({
  storeManager: { getAllStoreEntries: () => mockGetAllStoreEntries() },
}));

import { focusLogSession } from '../focusLogSession';
import { useTerminalStore, type TerminalInfo } from '../../../../store/terminal/terminalStore';
import { useFilesStore } from '../../../../store/files/filesStore';

const FILE = '/tmp/project.arbo';
const TERMINAL = 'terminal-1';
const SESSION = 'session-1';

const terminal: TerminalInfo = {
  id: TERMINAL,
  title: 'Terminal 1',
  cwd: '/tmp',
  shellCommand: 'bash',
  shellArgs: [],
  pinnedToBottom: false,
};

const storeEntry = (workflowSessionMap: Record<string, string>) => ({
  filePath: FILE,
  store: { getState: () => ({ workflowSessionMap }) },
});

describe('focusLogSession', () => {
  let setActiveFile: ReturnType<typeof vi.fn>;
  let setActiveTerminal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActiveFile = vi.fn();
    setActiveTerminal = vi.fn();
    useFilesStore.setState({ setActiveFile });
    useTerminalStore.setState({
      setActiveTerminal,
      currentFilePath: FILE,
      fileStates: { [FILE]: { terminals: [terminal], activeTerminalId: null } },
    });
    mockGetAllStoreEntries.mockReturnValue([storeEntry({ [SESSION]: TERMINAL })]);
  });

  it('surfaces the file tab and activates the terminal when the session is live and open', () => {
    const focused = focusLogSession(SESSION);

    expect(focused).toBe(true);
    expect(setActiveFile).toHaveBeenCalledWith(FILE);
    expect(setActiveTerminal).toHaveBeenCalledWith(TERMINAL);
  });

  it('is a no-op when no open store binds the session', () => {
    mockGetAllStoreEntries.mockReturnValue([storeEntry({})]);

    const focused = focusLogSession(SESSION);

    expect(focused).toBe(false);
    expect(setActiveFile).not.toHaveBeenCalled();
    expect(setActiveTerminal).not.toHaveBeenCalled();
  });

  it('is a no-op when the bound terminal no longer exists in its file', () => {
    useTerminalStore.setState({ fileStates: { [FILE]: { terminals: [], activeTerminalId: null } } });

    const focused = focusLogSession(SESSION);

    expect(focused).toBe(false);
    expect(setActiveFile).not.toHaveBeenCalled();
    expect(setActiveTerminal).not.toHaveBeenCalled();
  });

  it('is a no-op for an unknown session id', () => {
    const focused = focusLogSession('session-does-not-exist');

    expect(focused).toBe(false);
    expect(setActiveFile).not.toHaveBeenCalled();
    expect(setActiveTerminal).not.toHaveBeenCalled();
  });
});
