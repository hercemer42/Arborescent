import { describe, it, expect, beforeEach } from 'vitest';
import { useFilesStore } from '../filesStore';

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

  describe('openZoomTab', () => {
    it('should open a zoom tab for a node', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', 'Node Content');

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(2);

      const zoomTab = files.find(f => f.zoomSource);
      expect(zoomTab).toBeDefined();
      expect(zoomTab?.path).toBe('zoom:///path/file.arbo#node-123');
      expect(zoomTab?.displayName).toBe('Node Content');
      expect(zoomTab?.zoomSource).toEqual({
        sourceFilePath: '/path/file.arbo',
        zoomedNodeId: 'node-123',
      });
      expect(activeFilePath).toBe('zoom:///path/file.arbo#node-123');
    });

    it('should truncate long node content in display name', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', 'This is a very long node content that should be truncated');

      const { files } = useFilesStore.getState();
      const zoomTab = files.find(f => f.zoomSource);
      expect(zoomTab?.displayName).toBe('This is a very long ...');
    });

    it('should use "(untitled)" for empty node content', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', '');

      const { files } = useFilesStore.getState();
      const zoomTab = files.find(f => f.zoomSource);
      expect(zoomTab?.displayName).toBe('(untitled)');
    });

    it('should use "(untitled)" for whitespace-only node content', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', '   ');

      const { files } = useFilesStore.getState();
      const zoomTab = files.find(f => f.zoomSource);
      expect(zoomTab?.displayName).toBe('(untitled)');
    });

    it('should focus existing zoom tab instead of duplicating', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', 'Node Content');
      useFilesStore.getState().setActiveFile('/path/file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', 'Node Content');

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(2); // Only 2 files: original + one zoom tab
      expect(activeFilePath).toBe('zoom:///path/file.arbo#node-123');
    });

    it('should allow multiple zoom tabs for different nodes', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-2', 'Node 2');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(3);

      const zoomTabs = files.filter(f => f.zoomSource);
      expect(zoomTabs).toHaveLength(2);
    });

    it('should insert zoom tab right after its source file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().openZoomTab('/path/file1.arbo', 'node-1', 'Node 1');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(3);
      expect(files[0].path).toBe('/path/file1.arbo');
      expect(files[1].path).toBe('zoom:///path/file1.arbo#node-1');
      expect(files[2].path).toBe('/path/file2.arbo');
    });

    it('should insert new zoom tab after existing zoom tabs for same source', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().openZoomTab('/path/file1.arbo', 'node-1', 'Node 1');
      useFilesStore.getState().openZoomTab('/path/file1.arbo', 'node-2', 'Node 2');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(4);
      expect(files[0].path).toBe('/path/file1.arbo');
      expect(files[1].path).toBe('zoom:///path/file1.arbo#node-1');
      expect(files[2].path).toBe('zoom:///path/file1.arbo#node-2');
      expect(files[3].path).toBe('/path/file2.arbo');
    });

    it('should keep zoom tabs grouped with their source file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');
      useFilesStore.getState().openFile('/path/file3.arbo', 'file3.arbo');
      useFilesStore.getState().openZoomTab('/path/file2.arbo', 'node-a', 'Node A');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(4);
      expect(files[0].path).toBe('/path/file1.arbo');
      expect(files[1].path).toBe('/path/file2.arbo');
      expect(files[2].path).toBe('zoom:///path/file2.arbo#node-a');
      expect(files[3].path).toBe('/path/file3.arbo');
    });
  });

  describe('closeZoomTabsForNode', () => {
    it('should close zoom tab when zoomed node is deleted', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', 'Node Content');
      useFilesStore.getState().closeZoomTabsForNode('node-123');

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('/path/file.arbo');
      expect(activeFilePath).toBe('/path/file.arbo');
    });

    it('should not affect other tabs when closing zoom tab for node', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-2', 'Node 2');
      useFilesStore.getState().closeZoomTabsForNode('node-1');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(2);
      expect(files.some(f => f.zoomSource?.zoomedNodeId === 'node-2')).toBe(true);
    });

    it('should do nothing if node has no zoom tabs', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().closeZoomTabsForNode('nonexistent-node');

      const { files } = useFilesStore.getState();
      expect(files).toHaveLength(1);
    });
  });

  describe('getActiveFile', () => {
    it('should return the active file', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      const activeFile = useFilesStore.getState().getActiveFile();
      expect(activeFile).toEqual({ path: '/path/file.arbo', displayName: 'file.arbo' });
    });

    it('should return null when no active file', () => {
      const activeFile = useFilesStore.getState().getActiveFile();
      expect(activeFile).toBeNull();
    });

    it('should return zoom tab when it is active', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-123', 'Node Content');

      const activeFile = useFilesStore.getState().getActiveFile();
      expect(activeFile?.zoomSource).toBeDefined();
      expect(activeFile?.zoomSource?.zoomedNodeId).toBe('node-123');
    });
  });
});
