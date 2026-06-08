import { describe, it, expect, beforeEach } from 'vitest';
import { useFilesStore } from '../filesStore';

// When AI feedback arrives on a manually-reviewed node, the app opens a zoom tab focused on that
// node WITHOUT stealing focus, and marks it as review-pending so the tab bar points the user to it.
describe('filesStore — background zoom tab (review pending)', () => {
  beforeEach(() => {
    useFilesStore.setState({ files: [], activeFilePath: null, reviewPendingNodeIds: new Set() });
  });

  describe('background open does not steal focus', () => {
    it('creates the zoom tab but leaves focus on the source file', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files.some(f => f.zoomSource?.zoomedNodeId === 'node-1')).toBe(true);
      expect(activeFilePath).toBe('/path/file.arbo');
    });

    it('still groups the background zoom tab immediately after its source file', () => {
      useFilesStore.getState().openFile('/path/file1.arbo', 'file1.arbo');
      useFilesStore.getState().openFile('/path/file2.arbo', 'file2.arbo');

      useFilesStore.getState().openZoomTab('/path/file1.arbo', 'node-1', 'Node 1', { background: true });

      expect(useFilesStore.getState().files.map(f => f.path)).toEqual([
        '/path/file1.arbo',
        'zoom:///path/file1.arbo#node-1',
        '/path/file2.arbo',
      ]);
    });

    it('does not switch to an already-open zoom tab when reopening it in the background', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1');
      useFilesStore.getState().setActiveFile('/path/file.arbo');

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files.filter(f => f.zoomSource).length).toBe(1);
      expect(activeFilePath).toBe('/path/file.arbo');
    });

    it('does not create a duplicate zoom tab when the node already has one', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      expect(useFilesStore.getState().files.filter(f => f.zoomSource?.zoomedNodeId === 'node-1').length).toBe(1);
    });

    it('leaves no tab active when the reviewed node\'s source file is not currently open', () => {
      useFilesStore.getState().openZoomTab('/path/closed.arbo', 'node-1', 'Node 1', { background: true });

      const { files, activeFilePath } = useFilesStore.getState();
      expect(files.some(f => f.zoomSource?.zoomedNodeId === 'node-1')).toBe(true);
      expect(activeFilePath).toBeNull();
    });

    it('regression: the default (foreground) openZoomTab still focuses the new zoom tab', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1');

      expect(useFilesStore.getState().activeFilePath).toBe('zoom:///path/file.arbo#node-1');
    });
  });

  describe('review-pending highlight state', () => {
    it('marks the node as review-pending when a background zoom opens', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(true);
    });

    it('does not mark a foreground zoom (the user opened it themselves) as review-pending', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1');

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(false);
    });

    it('does not mark the node pending when its zoom tab is already the active tab on arrival', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1'); // foreground: now active

      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(false);
    });

    it('clears the highlight when the user focuses the zoom tab', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      useFilesStore.getState().setActiveFile('zoom:///path/file.arbo#node-1');

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(false);
    });

    it('keeps the highlight when the user focuses a different tab', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openFile('/path/other.arbo', 'other.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      useFilesStore.getState().setActiveFile('/path/other.arbo');

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(true);
    });

    it('clears the highlight when the review zoom tab is closed (review resolved)', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      useFilesStore.getState().closeZoomTabsForNode('node-1');

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(false);
    });

    it('clears the highlight when the zoom tab is closed', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });

      useFilesStore.getState().closeFile('zoom:///path/file.arbo#node-1');

      expect(useFilesStore.getState().reviewPendingNodeIds.has('node-1')).toBe(false);
    });
  });

  describe('resolution focus behaviour (via closeZoomTabsForNode)', () => {
    it('returns focus to the source file when the review is resolved from inside the zoom tab', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1'); // active = zoom tab

      useFilesStore.getState().closeZoomTabsForNode('node-1');

      expect(useFilesStore.getState().activeFilePath).toBe('/path/file.arbo');
    });

    it('leaves focus in the main tree when the review is resolved from the source file', () => {
      useFilesStore.getState().openFile('/path/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/path/file.arbo', 'node-1', 'Node 1', { background: true });
      // active is still the source file (background open)

      useFilesStore.getState().closeZoomTabsForNode('node-1');

      expect(useFilesStore.getState().activeFilePath).toBe('/path/file.arbo');
      expect(useFilesStore.getState().files.some(f => f.zoomSource)).toBe(false);
    });
  });
});
