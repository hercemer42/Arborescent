import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSaveBrowserSession, mockGetBrowserSession } = vi.hoisted(() => ({
  mockSaveBrowserSession: vi.fn(),
  mockGetBrowserSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveBrowserSession: mockSaveBrowserSession,
    getBrowserSession: mockGetBrowserSession,
  })),
}));

import { useBrowserStore } from '../browserStore';

describe('browser session per-file persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBrowserStore.setState({
      tabs: [],
      activeTabId: null,
      currentFilePath: null,
      fileStates: {},
      pendingLegacyTabs: undefined,
    });
  });

  describe('saveBrowserSession includes fileStates', () => {
    it('should include fileStates map in the saved payload', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      useBrowserStore.getState().actions.addTab('https://b.com');

      // saveBrowserSession is called on each addTab
      const lastCall = mockSaveBrowserSession.mock.calls[mockSaveBrowserSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates).toBeDefined();
      expect(lastCall.fileStates['/project-a.arbo']).toBeDefined();
      expect(lastCall.fileStates['/project-a.arbo'].tabs).toHaveLength(1);
      expect(lastCall.fileStates['/project-a.arbo'].tabs[0].url).toBe('https://a.com');
      expect(lastCall.fileStates['/project-b.arbo']).toBeDefined();
      expect(lastCall.fileStates['/project-b.arbo'].tabs).toHaveLength(1);
      expect(lastCall.fileStates['/project-b.arbo'].tabs[0].url).toBe('https://b.com');
    });

    it('should update fileStates on every tab mutation', () => {
      useBrowserStore.getState().actions.setActiveFile('/a.arbo');
      useBrowserStore.getState().actions.addTab('https://a1.com');
      useBrowserStore.getState().actions.addTab('https://a2.com');

      const lastCall = mockSaveBrowserSession.mock.calls[mockSaveBrowserSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates['/a.arbo'].tabs).toHaveLength(2);
    });

    it('should include updated fileStates when closing a tab', () => {
      useBrowserStore.getState().actions.setActiveFile('/a.arbo');
      useBrowserStore.getState().actions.addTab('https://a1.com');

      const tabId = useBrowserStore.getState().tabs[0].id;
      mockSaveBrowserSession.mockClear();

      useBrowserStore.getState().actions.closeTab(tabId);

      expect(mockSaveBrowserSession).toHaveBeenCalledTimes(1);
      const lastCall = mockSaveBrowserSession.mock.calls[0][0];
      expect(lastCall.fileStates['/a.arbo'].tabs).toHaveLength(0);
    });

    it('should persist session when closing all browser tabs for a file', () => {
      useBrowserStore.getState().actions.setActiveFile('/a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');

      useBrowserStore.getState().actions.setActiveFile('/b.arbo');
      useBrowserStore.getState().actions.addTab('https://b.com');
      mockSaveBrowserSession.mockClear();

      useBrowserStore.getState().actions.closeFileBrowserTabs('/a.arbo');

      expect(mockSaveBrowserSession).toHaveBeenCalled();
      const lastCall = mockSaveBrowserSession.mock.calls[mockSaveBrowserSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates['/a.arbo']).toBeUndefined();
      expect(lastCall.fileStates['/b.arbo']).toBeDefined();
    });
  });

  describe('restoreSession populates fileStates', () => {
    it('should populate fileStates from saved session with per-file data', async () => {
      mockGetBrowserSession.mockResolvedValue({
        tabs: [],
        activeTabId: null,
        fileStates: {
          '/project-a.arbo': {
            tabs: [{ id: 'tab-a', title: 'Page A', url: 'https://a.com' }],
            activeTabId: 'tab-a',
          },
          '/project-b.arbo': {
            tabs: [{ id: 'tab-b', title: 'Page B', url: 'https://b.com' }],
            activeTabId: 'tab-b',
          },
        },
      });

      await useBrowserStore.getState().actions.restoreSession();

      const { fileStates } = useBrowserStore.getState();
      expect(fileStates['/project-a.arbo']).toBeDefined();
      expect(fileStates['/project-a.arbo'].tabs).toHaveLength(1);
      expect(fileStates['/project-b.arbo']).toBeDefined();
      expect(fileStates['/project-b.arbo'].tabs).toHaveLength(1);
    });

    it('should not set global tabs until setActiveFile is called', async () => {
      mockGetBrowserSession.mockResolvedValue({
        tabs: [],
        activeTabId: null,
        fileStates: {
          '/a.arbo': {
            tabs: [{ id: 'tab-a', title: 'A', url: 'https://a.com' }],
            activeTabId: 'tab-a',
          },
        },
      });

      await useBrowserStore.getState().actions.restoreSession();

      // Global tabs should be empty until setActiveFile wires them
      expect(useBrowserStore.getState().tabs).toHaveLength(0);
    });
  });

  describe('backward compatibility with flat format', () => {
    it('should assign flat tabs to the first active file via pendingLegacyTabs', async () => {
      mockGetBrowserSession.mockResolvedValue({
        tabs: [
          { id: 'old-tab', title: 'Old Page', url: 'https://old.com' },
        ],
        activeTabId: 'old-tab',
      });

      await useBrowserStore.getState().actions.restoreSession();

      expect(useBrowserStore.getState().pendingLegacyTabs).toBeDefined();
      expect(useBrowserStore.getState().pendingLegacyTabs!.tabs).toHaveLength(1);

      useBrowserStore.getState().actions.setActiveFile('/first-file.arbo');

      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().tabs[0].url).toBe('https://old.com');
      expect(useBrowserStore.getState().fileStates['/first-file.arbo'].tabs).toHaveLength(1);
      expect(useBrowserStore.getState().pendingLegacyTabs).toBeUndefined();
    });

    it('should not error when saved session has no fileStates field', async () => {
      mockGetBrowserSession.mockResolvedValue({
        tabs: [],
        activeTabId: null,
      });

      await expect(useBrowserStore.getState().actions.restoreSession()).resolves.not.toThrow();
    });
  });

  describe('restoreSession handles empty/null session', () => {
    it('should create a default tab when no session exists', async () => {
      mockGetBrowserSession.mockResolvedValue(null);

      await useBrowserStore.getState().actions.restoreSession();

      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().activeTabId).not.toBeNull();
    });
  });

  describe('setActiveFile after restore loads correct tabs', () => {
    it('should load the correct file tabs when switching after restore', async () => {
      mockGetBrowserSession.mockResolvedValue({
        tabs: [],
        activeTabId: null,
        fileStates: {
          '/a.arbo': {
            tabs: [
              { id: 'a1', title: 'A1', url: 'https://a1.com' },
              { id: 'a2', title: 'A2', url: 'https://a2.com' },
              { id: 'a3', title: 'A3', url: 'https://a3.com' },
            ],
            activeTabId: 'a2',
          },
          '/b.arbo': {
            tabs: [{ id: 'b1', title: 'B1', url: 'https://b1.com' }],
            activeTabId: 'b1',
          },
        },
      });

      await useBrowserStore.getState().actions.restoreSession();

      useBrowserStore.getState().actions.setActiveFile('/a.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(3);
      expect(useBrowserStore.getState().activeTabId).toBe('a2');

      useBrowserStore.getState().actions.setActiveFile('/b.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().activeTabId).toBe('b1');
    });

    it('should show empty tabs for a file not in the saved session', async () => {
      mockGetBrowserSession.mockResolvedValue({
        tabs: [],
        activeTabId: null,
        fileStates: {
          '/a.arbo': {
            tabs: [{ id: 'a1', title: 'A1', url: 'https://a1.com' }],
            activeTabId: 'a1',
          },
        },
      });

      await useBrowserStore.getState().actions.restoreSession();

      useBrowserStore.getState().actions.setActiveFile('/unknown.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(0);
      expect(useBrowserStore.getState().activeTabId).toBeNull();
    });
  });
});
