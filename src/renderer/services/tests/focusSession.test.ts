import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  setActiveFile: vi.fn(),
  showTerminal: vi.fn(),
  setActiveTerminal: vi.fn(),
  focusTerminal: vi.fn(),
  createNewTerminal: vi.fn(),
  promptReady: true,
  shellInFront: true,
  terminalWrite: vi.fn(),
  activeFilePath: '/work.arbo' as string | null,
  owning: null as unknown,
  entries: [] as Array<{ filePath: string; store: unknown }>,
}));

vi.mock('../../store/storeOwnership', () => ({ findStoreOwningSession: () => mocks.owning }));
vi.mock('../../store/storeManager', () => ({ storeManager: { getAllStoreEntries: () => mocks.entries } }));
vi.mock('../../store/files/filesStore', () => ({ useFilesStore: { getState: () => ({ setActiveFile: mocks.setActiveFile, activeFilePath: mocks.activeFilePath }) } }));
vi.mock('../../store/panel/panelStore', () => ({ usePanelStore: { getState: () => ({ showTerminal: mocks.showTerminal }) } }));
vi.mock('../../store/terminal/terminalStore', () => ({ useTerminalStore: { getState: () => ({ setActiveTerminal: mocks.setActiveTerminal, createNewTerminal: mocks.createNewTerminal }) } }));
vi.mock('../shellPromptReadiness', () => ({ waitForShellPrompt: async () => mocks.promptReady }));
vi.mock('../terminalFocusRegistry', () => ({ focusTerminal: mocks.focusTerminal }));

import { focusSession, resumeSession } from '../focusSession';

const storeWith = (map: Record<string, string>) => ({ getState: () => ({ workflowSessionMap: map }) });

describe('focusSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.owning = null;
    mocks.entries = [];
    mocks.promptReady = true;
    mocks.shellInFront = true;
    mocks.activeFilePath = '/work.arbo';
    (window as unknown as { electron: unknown }).electron = {
      terminalWrite: mocks.terminalWrite,
      terminalShellInFront: async () => mocks.shellInFront,
    };
  });

  it('switches to the file owning the session, shows the terminal panel, selects and focuses its terminal', () => {
    const store = storeWith({ 'session-1': 'terminal-7' });
    mocks.owning = store;
    mocks.entries = [{ filePath: '/other.arbo', store: storeWith({}) }, { filePath: '/work.arbo', store }];

    expect(focusSession('session-1')).toBe(true);
    expect(mocks.setActiveFile).toHaveBeenCalledWith('/work.arbo');
    expect(mocks.showTerminal).toHaveBeenCalled();
    expect(mocks.setActiveTerminal).toHaveBeenCalledWith('terminal-7');
    expect(mocks.focusTerminal).toHaveBeenCalledWith('terminal-7');
    expect(mocks.setActiveFile.mock.invocationCallOrder[0]).toBeLessThan(mocks.setActiveTerminal.mock.invocationCallOrder[0]);
  });

  it('changes nothing for a session no open file has', () => {
    expect(focusSession('unknown')).toBe(false);
    expect(mocks.setActiveFile).not.toHaveBeenCalled();
    expect(mocks.focusTerminal).not.toHaveBeenCalled();
  });

  const ID = '3c55fd04-f8b5-4508-8990-e3bac3f67cc7';

  it('resumes a session in the tab it last ran in, when that tab is back at its shell', async () => {
    const store = storeWith({ [ID]: 'terminal-7' });
    mocks.owning = store;
    mocks.entries = [{ filePath: '/work.arbo', store }];

    expect(await resumeSession(ID, '/repo')).toBe(true);
    expect(mocks.focusTerminal).toHaveBeenCalledWith('terminal-7');
    expect(mocks.terminalWrite).toHaveBeenCalledWith('terminal-7', `claude --resume ${ID}\r`);
    expect(mocks.createNewTerminal).not.toHaveBeenCalled();
  });

  it('only brings forward a tab where the session, or anything else, still runs', async () => {
    const store = storeWith({ [ID]: 'terminal-7' });
    mocks.owning = store;
    mocks.entries = [{ filePath: '/work.arbo', store }];
    mocks.shellInFront = false;

    expect(await resumeSession(ID, '/repo')).toBe(true);
    expect(mocks.focusTerminal).toHaveBeenCalledWith('terminal-7');
    expect(mocks.terminalWrite).not.toHaveBeenCalled();
    expect(mocks.createNewTerminal).not.toHaveBeenCalled();
  });

  it('opens a session no file has in a new tab of the active file, in its directory', async () => {
    mocks.createNewTerminal.mockResolvedValue({ id: 'terminal-9' });

    expect(await resumeSession(ID, '/Users/me/dev/repo')).toBe(true);
    expect(mocks.createNewTerminal).toHaveBeenCalledWith(undefined, '/Users/me/dev/repo');
    expect(mocks.setActiveTerminal).toHaveBeenCalledWith('terminal-9');
    expect(mocks.terminalWrite).toHaveBeenCalledWith('terminal-9', `claude --resume ${ID}\r`);
    expect(mocks.focusTerminal).toHaveBeenCalledWith('terminal-9');
  });

  it('writes nothing for an id that is not a session id, or a directory that is not absolute', async () => {
    expect(await resumeSession(`${ID}; rm -rf ~`, '/repo')).toBe(false);
    expect(await resumeSession(ID, 'relative/dir')).toBe(false);
    expect(await resumeSession(ID, undefined)).toBe(false);
    mocks.activeFilePath = null;
    expect(await resumeSession(ID, '/repo')).toBe(false);
    expect(mocks.createNewTerminal).not.toHaveBeenCalled();
    expect(mocks.terminalWrite).not.toHaveBeenCalled();
  });
});
