import { describe, it, expect, beforeEach } from 'vitest';
import { useFilesStore } from './filesStore';

describe('filesStore', () => {
  beforeEach(() => {
    useFilesStore.setState({
      files: [],
      activeFilePath: null,
    });
  });

  describe('openFile', () => {
    it('should open a new file', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({ path: '/path/file.arbo', displayName: 'file.arbo' });
      expect(activeFilePath).toBe('/path/file.arbo');
    });

    it('should open multiple files', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe('/path/file1.arbo');
      expect(files[1].path).toBe('/path/file2.arbo');
    });

    it('should not duplicate files', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(1);
    });

    it('should set active file when reopening existing file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');

      const { activeFilePath } = useFilesStore.getState();
      expect(activeFilePath).toBe('/path/file1.arbo');
    });
  });

  describe('closeFile', () => {
    it('should close a file', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().closeFile('/path/file.arbo');

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(0);
      expect(activeFilePath).toBeNull();
    });

    it('should switch to previous file when closing active file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().openFile('/path/file3.arbo', 'file3.arbo');
      useFilesStore.getState().closeFile('/path/file3.arbo');

      const { activeFilePath } = useFilesStore.getState();
      expect(activeFilePath).toBe('/path/file2.arbo');
    });

    it('should switch to first file when closing first active file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().setActiveFile('/path/file1.arbo');
      useFilesStore.getState().closeFile('/path/file1.arbo');

      const { activeFilePath } = useFilesStore.getState();
      expect(activeFilePath).toBe('/path/file2.arbo');
    });

    it('should not change active file when closing non-active file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().closeFile('/path/file1.arbo');

      const { activeFilePath } = useFilesStore.getState();
      expect(activeFilePath).toBe('/path/file2.arbo');
    });
  });

  describe('setActiveFile', () => {
    it('should set active file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().setActiveFile('/path/file1.arbo');

      const { activeFilePath } = useFilesStore.getState();
      expect(activeFilePath).toBe('/path/file1.arbo');
    });
  });

  describe('closeActiveFile', () => {
    it('should close active file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().closeActiveFile();

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('/path/file1.arbo');
      expect(activeFilePath).toBe('/path/file1.arbo');
    });

    it('should do nothing when no active file', () => {
      useFilesStore.getState().closeActiveFile();

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(0);
      expect(activeFilePath).toBeNull();
    });
  });
});
