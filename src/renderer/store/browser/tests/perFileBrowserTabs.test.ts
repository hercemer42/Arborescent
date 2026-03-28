import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBrowserStore } from '../browserStore';

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveBrowserSession: vi.fn(),
    getBrowserSession: vi.fn().mockResolvedValue(null),
  })),
}));

describe('per-file browser tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBrowserStore.setState({
      tabs: [],
      activeTabId: null,
      currentFilePath: null,
      fileStates: {},
    });
  });

  describe('per-file browser tab scoping', () => {
    it('should add tab to the current file pool only', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://example.com');

      expect(useBrowserStore.getState().tabs).toHaveLength(1);

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(0);
    });

    it('should not show file A tabs when switched to file B', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      useBrowserStore.getState().actions.addTab('https://b.com');

      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().tabs[0].url).toBe('https://b.com');

      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().tabs[0].url).toBe('https://a.com');
    });

    it('should start with empty tab pool for a new file', () => {
      useBrowserStore.getState().actions.setActiveFile('/new-project.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(0);
      expect(useBrowserStore.getState().activeTabId).toBeNull();
    });

    it('should allow same URL in different files', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://example.com');

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      useBrowserStore.getState().actions.addTab('https://example.com');

      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
    });

    it('should close tab from current file only', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');
      const tabAId = useBrowserStore.getState().tabs[0].id;

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      useBrowserStore.getState().actions.addTab('https://b.com');

      useBrowserStore.getState().actions.closeTab(useBrowserStore.getState().tabs[0].id);
      expect(useBrowserStore.getState().tabs).toHaveLength(0);

      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().tabs[0].id).toBe(tabAId);
    });
  });

  describe('file switching via setActiveFile', () => {
    it('should change which file tabs and activeTabId are returned', () => {
      useBrowserStore.getState().actions.setActiveFile('/a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');
      const tabAId = useBrowserStore.getState().activeTabId;

      useBrowserStore.getState().actions.setActiveFile('/b.arbo');
      useBrowserStore.getState().actions.addTab('https://b.com');
      const tabBId = useBrowserStore.getState().activeTabId;

      useBrowserStore.getState().actions.setActiveFile('/a.arbo');
      expect(useBrowserStore.getState().activeTabId).toBe(tabAId);

      useBrowserStore.getState().actions.setActiveFile('/b.arbo');
      expect(useBrowserStore.getState().activeTabId).toBe(tabBId);
    });

    it('should return empty tabs for a file with none', () => {
      useBrowserStore.getState().actions.setActiveFile('/empty.arbo');
      expect(useBrowserStore.getState().tabs).toEqual([]);
    });

    it('should return null activeTabId when no file is active', () => {
      useBrowserStore.getState().actions.setActiveFile(null);
      expect(useBrowserStore.getState().tabs).toEqual([]);
      expect(useBrowserStore.getState().activeTabId).toBeNull();
    });
  });

  describe('zoom tab resolution', () => {
    it('should resolve zoom path to parent file browser tabs', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');

      useBrowserStore.getState().actions.setActiveFile('zoom:///project-a.arbo#node-1');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().tabs[0].url).toBe('https://a.com');
    });

    it('should add tab to parent file from zoom tab', () => {
      useBrowserStore.getState().actions.setActiveFile('zoom:///project-a.arbo#node-1');
      useBrowserStore.getState().actions.addTab('https://zoom.com');

      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
      expect(useBrowserStore.getState().tabs[0].url).toBe('https://zoom.com');
    });
  });

  describe('closeFileBrowserTabs', () => {
    it('should remove all browser tab entries for the specified file', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://a1.com');
      useBrowserStore.getState().actions.addTab('https://a2.com');

      useBrowserStore.getState().actions.closeFileBrowserTabs('/project-a.arbo');

      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(0);
    });

    it('should not affect other files browser tabs', () => {
      useBrowserStore.getState().actions.setActiveFile('/project-a.arbo');
      useBrowserStore.getState().actions.addTab('https://a.com');

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      useBrowserStore.getState().actions.addTab('https://b.com');

      useBrowserStore.getState().actions.closeFileBrowserTabs('/project-a.arbo');

      useBrowserStore.getState().actions.setActiveFile('/project-b.arbo');
      expect(useBrowserStore.getState().tabs).toHaveLength(1);
    });

    it('should be a no-op for a file with no browser tabs', () => {
      useBrowserStore.getState().actions.closeFileBrowserTabs('/empty.arbo');
      // No error thrown
    });
  });

  describe('mutations with no active file', () => {
    it('should be a no-op when adding tab with no active file', () => {
      useBrowserStore.getState().actions.setActiveFile(null);
      useBrowserStore.getState().actions.addTab('https://orphan.com');

      expect(useBrowserStore.getState().tabs).toHaveLength(0);
    });
  });
});
