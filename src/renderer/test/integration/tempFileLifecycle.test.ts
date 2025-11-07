import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { StorageService } from '@platform';

/**
 * Integration Test: Temporary File Lifecycle
 *
 * Tests temp file management to prevent disk space issues:
 * 1. Temp files are created for new documents
 * 2. Temp files are cleaned up when saved to permanent location
 * 3. Temp files are cleaned up when closed without saving
 * 4. Orphaned temp files are recovered on app restart
 *
 * Systems tested:
 * - Storage service temp file tracking
 * - filesStore → Storage → temp file metadata
 * - Cleanup on save/close/restart
 */
describe('Integration: Temp File Lifecycle', () => {
  let tempFileCounter = 0;
  let tempFilesMetadata: string[] = [];
  const savedFiles: Map<string, string> = new Map();

  function generateTempPath(): string {
    tempFileCounter++;
    return `/tmp/untitled-${tempFileCounter}.json`;
  }

  beforeEach(() => {
    // Reset state
    useFilesStore.setState({ files: [], activeFilePath: null });
    storeManager['stores'].clear();
    tempFileCounter = 0;
    tempFilesMetadata = [];
    savedFiles.clear();

    // Mock temp file system
    vi.mocked(window.electron.createTempFile).mockImplementation(async (filename, content) => {
      const path = generateTempPath();
      tempFilesMetadata.push(path);
      savedFiles.set(path, content);
      return path;
    });

    vi.mocked(window.electron.deleteTempFile).mockImplementation(async (path) => {
      tempFilesMetadata = tempFilesMetadata.filter(p => p !== path);
      savedFiles.delete(path);
    });

    vi.mocked(window.electron.getTempFilesMetadata).mockImplementation(async () => {
      return tempFilesMetadata.length > 0 ? JSON.stringify(tempFilesMetadata) : null;
    });

    vi.mocked(window.electron.saveTempFilesMetadata).mockImplementation(async (data) => {
      tempFilesMetadata = JSON.parse(data);
    });

    vi.mocked(window.electron.isTempFile).mockImplementation(async (path: string) => {
      return tempFilesMetadata.includes(path);
    });

    // Mock file I/O
    vi.mocked(window.electron.readFile).mockImplementation(async (path) => {
      const data = savedFiles.get(path);
      if (!data) throw new Error('File not found');
      return data;
    });

    vi.mocked(window.electron.writeFile).mockImplementation(async (path, content) => {
      savedFiles.set(path, content);
    });

    vi.mocked(window.electron.showSaveDialog).mockResolvedValue('/saved/file.json');
    vi.mocked(window.electron.getSession).mockResolvedValue(null);
    vi.mocked(window.electron.showUnsavedChangesDialog).mockResolvedValue(0); // Save
  });

  it('should create temp file when creating new document', async () => {
    const storage = new StorageService();
    const { actions } = useFilesStore.getState();

    // Create new file
    await actions.createNewFile();

    // Verify temp file was created
    expect(window.electron.createTempFile).toHaveBeenCalled();
    expect(tempFilesMetadata).toHaveLength(1);
    expect(tempFilesMetadata[0]).toMatch(/\/tmp\/untitled-\d+\.json/);

    // Verify it's tracked as temp
    const isTemp = await storage.isTempFile(tempFilesMetadata[0]);
    expect(isTemp).toBe(true);
  });

  it('should clean up temp file when saved to permanent location', async () => {
    const { actions } = useFilesStore.getState();

    // Create new file (creates temp)
    await actions.createNewFile();
    const tempPath = tempFilesMetadata[0];

    expect(tempFilesMetadata).toHaveLength(1);

    // Edit the document
    const store = storeManager.getStoreForFile(tempPath);
    store.getState().actions.updateContent(store.getState().rootNodeId, 'My important work');

    // Save to permanent location
    await actions.saveActiveFile();

    // Verify temp file was deleted
    expect(window.electron.deleteTempFile).toHaveBeenCalledWith(tempPath);
    expect(tempFilesMetadata).toHaveLength(0);

    // Verify file was saved to permanent location
    expect(savedFiles.has('/saved/file.json')).toBe(true);
  });

  it('should clean up temp file when closed without saving', async () => {
    vi.mocked(window.electron.showUnsavedChangesDialog).mockResolvedValue(1); // Don't Save

    const { actions } = useFilesStore.getState();

    // Create new file
    await actions.createNewFile();
    const tempPath = tempFilesMetadata[0];

    expect(tempFilesMetadata).toHaveLength(1);

    // Close without saving
    await actions.closeFile(tempPath);

    // Verify temp file was deleted
    expect(window.electron.deleteTempFile).toHaveBeenCalledWith(tempPath);
    expect(tempFilesMetadata).toHaveLength(0);
  });

  it('should not accumulate temp files when creating multiple new documents', async () => {
    vi.mocked(window.electron.showUnsavedChangesDialog).mockResolvedValue(1); // Don't Save

    const { actions } = useFilesStore.getState();

    // Create 5 new files
    for (let i = 0; i < 5; i++) {
      await actions.createNewFile();
    }

    // All should be tracked
    expect(tempFilesMetadata).toHaveLength(5);

    // Close all without saving
    const { files } = useFilesStore.getState();
    for (const file of [...files]) {
      await actions.closeFile(file.path);
    }

    // All should be cleaned up
    expect(tempFilesMetadata).toHaveLength(0);
  });

  it('should recover orphaned temp files on app restart', async () => {
    // Simulate app with orphaned temp files (in metadata but not in session)
    const orphanedPath1 = '/tmp/untitled-1.json';
    const orphanedPath2 = '/tmp/untitled-2.json';

    tempFilesMetadata = [orphanedPath1, orphanedPath2];

    // Create dummy content for these files
    const dummyContent = JSON.stringify({
      format: 'Arborescent',
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      author: 'Test',
      rootNodeId: 'root',
      nodes: {
        'root': { id: 'root', content: 'Orphaned', children: [], metadata: {} },
      },
    });

    savedFiles.set(orphanedPath1, dummyContent);
    savedFiles.set(orphanedPath2, dummyContent);

    // Session has no files
    vi.mocked(window.electron.getSession).mockResolvedValue(JSON.stringify({
      openFiles: [],
      activeFilePath: null,
    }));

    // Initialize session (should restore orphaned files)
    const { actions } = useFilesStore.getState();
    await actions.initializeSession();

    // Verify orphaned files were loaded
    const { files } = useFilesStore.getState();
    expect(files).toHaveLength(2);
    expect(files.find(f => f.path === orphanedPath1)).toBeDefined();
    expect(files.find(f => f.path === orphanedPath2)).toBeDefined();
  });

  it('should handle temp file creation failures gracefully', async () => {
    vi.mocked(window.electron.createTempFile).mockRejectedValue(new Error('Disk full'));

    const { actions } = useFilesStore.getState();

    // Try to create new file
    await actions.createNewFile();

    // Should not crash, but also shouldn't have created file
    const { files } = useFilesStore.getState();
    expect(files).toHaveLength(0);
  });

  it('should properly transition from temp to saved file', async () => {
    const permanentPath = '/saved/document.json';
    vi.mocked(window.electron.showSaveDialog).mockResolvedValue(permanentPath);

    const { actions } = useFilesStore.getState();
    const storage = new StorageService();

    // Create new temp file
    await actions.createNewFile();
    const tempPath = useFilesStore.getState().activeFilePath!;

    // Verify it's temp
    expect(await storage.isTempFile(tempPath)).toBe(true);

    // Edit content
    const store = storeManager.getStoreForFile(tempPath);
    store.getState().actions.updateContent(store.getState().rootNodeId, 'Important data');

    // Save as permanent file
    await actions.saveActiveFile();

    // Verify temp file was cleaned up
    expect(tempFilesMetadata.includes(tempPath)).toBe(false);

    // Verify new file is not temp
    expect(await storage.isTempFile(permanentPath)).toBe(false);

    // Verify file is now tracked as permanent
    const { files, activeFilePath } = useFilesStore.getState();
    expect(activeFilePath).toBe(permanentPath);
    expect(files[0].path).toBe(permanentPath);
    expect(files[0].isTemporary).toBe(false);
  });

  it('should maintain temp file metadata consistency', async () => {
    const { actions } = useFilesStore.getState();

    // Create 3 temp files
    await actions.createNewFile();
    await actions.createNewFile();
    await actions.createNewFile();

    const initialMetadata = [...tempFilesMetadata];
    expect(initialMetadata).toHaveLength(3);

    // Save one as permanent
    vi.mocked(window.electron.showSaveDialog).mockResolvedValue('/saved/file1.json');
    await actions.saveFileAs(initialMetadata[1]);

    // Verify metadata was updated
    const updatedMetadata = await (new StorageService()).getTempFiles();
    expect(updatedMetadata).toHaveLength(2);
    expect(updatedMetadata.includes(initialMetadata[1])).toBe(false);
  });
});
