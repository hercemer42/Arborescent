import { describe, it, expect, beforeEach } from 'vitest';
import { useTabsStore } from './tabsStore';

describe('tabsStore', () => {
  beforeEach(() => {
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
    });
  });

  describe('openFile', () => {
    it('should open a new file', () => {
      useTabsStore.getState().openFile('/path/file.arbo', 'file.arbo');

      const { openFiles, activeFilePath } = useTabsStore.getState();
      expect(openFiles).toHaveLength(1);
      expect(openFiles[0]).toEqual({ path: '/path/file.arbo', displayName: 'file.arbo' });
      expect(activeFilePath).toBe('/path/file.arbo');
    });

    it('should open multiple files', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');

      const { openFiles } = useTabsStore.getState();
      expect(openFiles).toHaveLength(2);
      expect(openFiles[0].path).toBe('/path/file1.arbo');
      expect(openFiles[1].path).toBe('/path/file2.arbo');
    });

    it('should not duplicate files', () => {
      useTabsStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useTabsStore.getState().openFile('/path/file.arbo', 'file.arbo');

      const { openFiles } = useTabsStore.getState();
      expect(openFiles).toHaveLength(1);
    });

    it('should set active file when reopening existing file', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');

      const { activeFilePath } = useTabsStore.getState();
      expect(activeFilePath).toBe('/path/file1.arbo');
    });
  });

  describe('closeFile', () => {
    it('should close a file', () => {
      useTabsStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useTabsStore.getState().closeFile('/path/file.arbo');

      const { openFiles, activeFilePath } = useTabsStore.getState();
      expect(openFiles).toHaveLength(0);
      expect(activeFilePath).toBeNull();
    });

    it('should switch to previous file when closing active file', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useTabsStore.getState().openFile('/path/file3.arbo', 'file3.arbo');
      useTabsStore.getState().closeFile('/path/file3.arbo');

      const { activeFilePath } = useTabsStore.getState();
      expect(activeFilePath).toBe('/path/file2.arbo');
    });

    it('should switch to first file when closing first active file', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useTabsStore.getState().setActiveFile('/path/file1.arbo');
      useTabsStore.getState().closeFile('/path/file1.arbo');

      const { activeFilePath } = useTabsStore.getState();
      expect(activeFilePath).toBe('/path/file2.arbo');
    });

    it('should not change active file when closing non-active file', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useTabsStore.getState().closeFile('/path/file1.arbo');

      const { activeFilePath } = useTabsStore.getState();
      expect(activeFilePath).toBe('/path/file2.arbo');
    });
  });

  describe('setActiveFile', () => {
    it('should set active file', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useTabsStore.getState().setActiveFile('/path/file1.arbo');

      const { activeFilePath } = useTabsStore.getState();
      expect(activeFilePath).toBe('/path/file1.arbo');
    });
  });

  describe('closeActiveFile', () => {
    it('should close active file', () => {
      useTabsStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useTabsStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useTabsStore.getState().closeActiveFile();

      const { openFiles, activeFilePath } = useTabsStore.getState();
      expect(openFiles).toHaveLength(1);
      expect(openFiles[0].path).toBe('/path/file1.arbo');
      expect(activeFilePath).toBe('/path/file1.arbo');
    });

    it('should do nothing when no active file', () => {
      useTabsStore.getState().closeActiveFile();

      const { openFiles, activeFilePath } = useTabsStore.getState();
      expect(openFiles).toHaveLength(0);
      expect(activeFilePath).toBeNull();
    });
  });
});
