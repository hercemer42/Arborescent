import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  setActiveFile: vi.fn(),
  showTerminal: vi.fn(),
  setActiveTerminal: vi.fn(),
  focusTerminal: vi.fn(),
  owning: null as unknown,
  entries: [] as Array<{ filePath: string; store: unknown }>,
}));

vi.mock('../../store/storeOwnership', () => ({ findStoreOwningSession: () => mocks.owning }));
vi.mock('../../store/storeManager', () => ({ storeManager: { getAllStoreEntries: () => mocks.entries } }));
vi.mock('../../store/files/filesStore', () => ({ useFilesStore: { getState: () => ({ setActiveFile: mocks.setActiveFile }) } }));
vi.mock('../../store/panel/panelStore', () => ({ usePanelStore: { getState: () => ({ showTerminal: mocks.showTerminal }) } }));
vi.mock('../../store/terminal/terminalStore', () => ({ useTerminalStore: { getState: () => ({ setActiveTerminal: mocks.setActiveTerminal }) } }));
vi.mock('../terminalFocusRegistry', () => ({ focusTerminal: mocks.focusTerminal }));

import { focusSession } from '../focusSession';

const storeWith = (map: Record<string, string>) => ({ getState: () => ({ workflowSessionMap: map }) });

describe('focusSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.owning = null;
    mocks.entries = [];
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
});
