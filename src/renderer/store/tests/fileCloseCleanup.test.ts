import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCloseFileTerminals = vi.fn().mockResolvedValue(undefined);
const mockCloseFileBrowserTabs = vi.fn();
const mockRemoveFileState = vi.fn();
const mockRemoveIndicator = vi.fn();
const mockSaveToPath = vi.fn().mockResolvedValue(undefined);

vi.mock('../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({ closeFileTerminals: mockCloseFileTerminals }),
  },
}));

vi.mock('../browser/browserStore', () => ({
  useBrowserStore: {
    getState: () => ({ actions: { closeFileBrowserTabs: mockCloseFileBrowserTabs } }),
  },
}));

vi.mock('../panel/panelStore', () => ({
  usePanelStore: {
    getState: () => ({ removeFileState: mockRemoveFileState }),
  },
}));

vi.mock('../tabIndicators/tabIndicatorStore', () => ({
  useTabIndicatorStore: {
    getState: () => ({ removeIndicator: mockRemoveIndicator, updateIndicator: vi.fn() }),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../utils/zoomPath', () => ({
  parseZoomPath: vi.fn((p: string) => {
    if (p.startsWith('zoom://')) {
      const withoutPrefix = p.slice('zoom://'.length);
      const hashIndex = withoutPrefix.lastIndexOf('#');
      if (hashIndex !== -1) return { sourceFilePath: withoutPrefix.slice(0, hashIndex), nodeId: withoutPrefix.slice(hashIndex + 1) };
    }
    return null;
  }),
  resolveToSourceFilePath: vi.fn((p: string | null) => {
    if (!p) return null;
    if (!p.startsWith('zoom://')) return p;
    const withoutPrefix = p.slice('zoom://'.length);
    const hashIndex = withoutPrefix.lastIndexOf('#');
    if (hashIndex === -1) return p;
    return withoutPrefix.slice(0, hashIndex);
  }),
}));

import { storeManager } from '../storeManager';

describe('file close cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeManager.clearAll();
  });

  describe('resource cleanup on close', () => {
    it('should call closeFileTerminals with file path on close', async () => {
      const store = storeManager.getStoreForFile('/project.arbo');
      store.setState({ currentFilePath: '/project.arbo' });

      await storeManager.closeFile('/project.arbo');

      expect(mockCloseFileTerminals).toHaveBeenCalledWith('/project.arbo');
    });

    it('should call closeFileBrowserTabs with file path on close', async () => {
      const store = storeManager.getStoreForFile('/project.arbo');
      store.setState({ currentFilePath: '/project.arbo' });

      await storeManager.closeFile('/project.arbo');

      expect(mockCloseFileBrowserTabs).toHaveBeenCalledWith('/project.arbo');
    });

    it('should call removeFileState with file path on close', async () => {
      const store = storeManager.getStoreForFile('/project.arbo');
      store.setState({ currentFilePath: '/project.arbo' });

      await storeManager.closeFile('/project.arbo');

      expect(mockRemoveFileState).toHaveBeenCalledWith('/project.arbo');
    });

    it('should remove tab indicator on close', async () => {
      const store = storeManager.getStoreForFile('/project.arbo');
      store.setState({ currentFilePath: '/project.arbo' });

      await storeManager.closeFile('/project.arbo');

      expect(mockRemoveIndicator).toHaveBeenCalledWith('/project.arbo');
    });

    it('should delete the tree store after cleanup', async () => {
      storeManager.getStoreForFile('/project.arbo');
      expect(storeManager.hasStore('/project.arbo')).toBe(true);

      await storeManager.closeFile('/project.arbo');

      expect(storeManager.hasStore('/project.arbo')).toBe(false);
    });
  });

  describe('feedback preservation', () => {
    it('should save the file before deleting the tree store', async () => {
      const store = storeManager.getStoreForFile('/project.arbo');
      store.setState({
        currentFilePath: '/project.arbo',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: { ...store.getState().actions, saveToPath: mockSaveToPath } as any,
      });

      await storeManager.closeFile('/project.arbo');

      expect(mockSaveToPath).toHaveBeenCalledWith('/project.arbo', undefined);
    });
  });

  describe('zoom tab behavior', () => {
    it('should not clean up parent file resources when closing a zoom tab store', async () => {
      storeManager.getStoreForFile('/project.arbo');

      await storeManager.closeFile('zoom:///project.arbo#node-1');

      expect(mockCloseFileTerminals).not.toHaveBeenCalledWith('/project.arbo');
      expect(mockCloseFileBrowserTabs).not.toHaveBeenCalledWith('/project.arbo');
      expect(mockRemoveFileState).not.toHaveBeenCalledWith('/project.arbo');
    });
  });
});
