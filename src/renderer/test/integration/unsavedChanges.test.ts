import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { TreeNode } from '../../../shared/types';
import { createArboFile } from '../../utils/document';

/**
 * Integration Test: Unsaved Changes Dialog Flow
 *
 * Tests the complete unsaved changes handling:
 * 1. User creates/edits a temporary file
 * 2. User tries to close the file
 * 3. Dialog appears with Save/Don't Save/Cancel options
 * 4. System handles each choice correctly
 *
 * Systems tested:
 * - filesStore → Storage service → IPC → Dialog → User choice
 * - Each choice path (save/discard/cancel)
 * - Temp file cleanup
 */
describe('Integration: Unsaved Changes Handling', () => {
  const tempFilePath = '/tmp/untitled-1.json';
  const savedFilePath = '/test/saved-file.json';
  let dialogResponse: number = 2; // Default to cancel
  const savedData: Map<string, string> = new Map();

  beforeEach(() => {
    // Clear state
    useFilesStore.setState({ files: [], activeFilePath: null });
    storeManager['stores'].clear();
    savedData.clear();
    dialogResponse = 2; // Cancel

    // Mock temp file system
    vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(
      JSON.stringify([tempFilePath])
    );
    vi.mocked(window.electron.isTempFile).mockImplementation(async (path: string) => {
      return path === tempFilePath;
    });

    // Mock file I/O
    vi.mocked(window.electron.writeFile).mockImplementation(async (path, content) => {
      savedData.set(path, content);
    });

    vi.mocked(window.electron.readFile).mockImplementation(async (path) => {
      const data = savedData.get(path);
      if (!data) throw new Error('File not found');
      return data;
    });

    // Mock dialog
    vi.mocked(window.electron.showUnsavedChangesDialog).mockImplementation(async () => {
      return dialogResponse;
    });

    vi.mocked(window.electron.showSaveDialog).mockResolvedValue(savedFilePath);

    // Mock temp file operations
    vi.mocked(window.electron.deleteTempFile).mockResolvedValue(undefined);
    vi.mocked(window.electron.saveTempFilesMetadata).mockResolvedValue(undefined);

    vi.mocked(window.electron.getSession).mockResolvedValue(null);
  });

  it('should save file when user chooses "Save"', async () => {
    dialogResponse = 0; // Save

    // Create temp file with content
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['child'], metadata: {} },
      'child': { id: 'child', content: 'Important work', children: [], metadata: {} },
    };

    const store = storeManager.getStoreForFile(tempFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(tempFilePath);

    // Open in filesStore
    const { openFile } = useFilesStore.getState();
    openFile(tempFilePath, 'untitled-1', true);

    // Clear mocks to track only close operation
    vi.clearAllMocks();

    // Try to close - should trigger dialog
    const { actions } = useFilesStore.getState();
    await actions.closeFile(tempFilePath);

    // Verify dialog was shown
    expect(window.electron.showUnsavedChangesDialog).toHaveBeenCalled();

    // Verify save dialog was shown
    expect(window.electron.showSaveDialog).toHaveBeenCalled();

    // Verify file was saved to new location
    expect(savedData.has(savedFilePath)).toBe(true);
    const savedContent = JSON.parse(savedData.get(savedFilePath)!);
    expect(savedContent.nodes['child'].content).toBe('Important work');

    // Verify temp file was deleted
    expect(window.electron.deleteTempFile).toHaveBeenCalledWith(tempFilePath);

    // Verify file was closed
    const filesState = useFilesStore.getState();
    expect(filesState.files.find(f => f.path === tempFilePath)).toBeUndefined();
  });

  it('should discard changes when user chooses "Don\'t Save"', async () => {
    dialogResponse = 1; // Don't Save

    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: [], metadata: {} },
    };

    const store = storeManager.getStoreForFile(tempFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(tempFilePath);

    const { openFile } = useFilesStore.getState();
    openFile(tempFilePath, 'untitled-1', true);

    // Clear mocks to track only close operation
    vi.clearAllMocks();

    // Close file
    const { actions } = useFilesStore.getState();
    await actions.closeFile(tempFilePath);

    // Verify dialog was shown
    expect(window.electron.showUnsavedChangesDialog).toHaveBeenCalled();

    // Verify save dialog was NOT shown
    expect(window.electron.showSaveDialog).not.toHaveBeenCalled();

    // Verify temp file was deleted
    expect(window.electron.deleteTempFile).toHaveBeenCalledWith(tempFilePath);

    // Verify file was closed
    const filesState = useFilesStore.getState();
    expect(filesState.files.find(f => f.path === tempFilePath)).toBeUndefined();
  });

  it('should cancel close operation when user chooses "Cancel"', async () => {
    dialogResponse = 2; // Cancel

    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: [], metadata: {} },
    };

    const store = storeManager.getStoreForFile(tempFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(tempFilePath);

    const { openFile } = useFilesStore.getState();
    openFile(tempFilePath, 'untitled-1', true);

    // Clear mocks to track only close operation
    vi.clearAllMocks();

    // Try to close
    const { actions } = useFilesStore.getState();
    await actions.closeFile(tempFilePath);

    // Verify dialog was shown
    expect(window.electron.showUnsavedChangesDialog).toHaveBeenCalled();

    // Verify save dialog was NOT shown
    expect(window.electron.showSaveDialog).not.toHaveBeenCalled();

    // Verify temp file was NOT deleted
    expect(window.electron.deleteTempFile).not.toHaveBeenCalled();

    // Verify file is STILL open
    const filesState = useFilesStore.getState();
    expect(filesState.files.find(f => f.path === tempFilePath)).toBeDefined();
  });

  it('should not show dialog for saved files', async () => {
    const savedFilePath = '/test/saved.json';

    // Mock as saved file (not temp)
    vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify([]));
    vi.mocked(window.electron.isTempFile).mockResolvedValue(false);

    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: [], metadata: {} },
    };

    const arboFile = createArboFile(nodes, 'root');
    savedData.set(savedFilePath, JSON.stringify(arboFile));

    const store = storeManager.getStoreForFile(savedFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(savedFilePath);

    const { openFile } = useFilesStore.getState();
    openFile(savedFilePath, 'saved.json', false);

    // Clear mocks to track only close operation
    vi.clearAllMocks();

    // Close file
    const { actions } = useFilesStore.getState();
    await actions.closeFile(savedFilePath);

    // Verify dialog was NOT shown
    expect(window.electron.showUnsavedChangesDialog).not.toHaveBeenCalled();

    // Verify file was closed
    const filesState = useFilesStore.getState();
    expect(filesState.files.find(f => f.path === savedFilePath)).toBeUndefined();
  });

  it('should handle save dialog cancellation correctly', async () => {
    dialogResponse = 0; // User chooses "Save"
    vi.mocked(window.electron.showSaveDialog).mockResolvedValue(null); // But cancels save dialog

    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: [], metadata: {} },
    };

    const store = storeManager.getStoreForFile(tempFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(tempFilePath);

    const { openFile } = useFilesStore.getState();
    openFile(tempFilePath, 'untitled-1', true);

    // Clear mocks to track only close operation
    vi.clearAllMocks();

    // Try to close
    const { actions } = useFilesStore.getState();
    await actions.closeFile(tempFilePath);

    // Verify dialogs were shown
    expect(window.electron.showUnsavedChangesDialog).toHaveBeenCalled();
    expect(window.electron.showSaveDialog).toHaveBeenCalled();

    // Verify temp file was NOT deleted (save was cancelled)
    expect(window.electron.deleteTempFile).not.toHaveBeenCalled();

    // Verify file is STILL open (close was cancelled)
    const filesState = useFilesStore.getState();
    expect(filesState.files.find(f => f.path === tempFilePath)).toBeDefined();
  });

  it('should handle save errors gracefully', async () => {
    dialogResponse = 0; // Save
    vi.mocked(window.electron.writeFile).mockRejectedValue(new Error('Disk full'));

    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: [], metadata: {} },
    };

    const store = storeManager.getStoreForFile(tempFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(tempFilePath);

    const { openFile } = useFilesStore.getState();
    openFile(tempFilePath, 'untitled-1', true);

    // Clear mocks to track only close operation
    vi.clearAllMocks();
    // Re-apply the write error after clearing
    vi.mocked(window.electron.writeFile).mockRejectedValue(new Error('Disk full'));

    // Try to close
    const { actions } = useFilesStore.getState();
    await actions.closeFile(tempFilePath);

    // Verify temp file was NOT deleted (save failed)
    expect(window.electron.deleteTempFile).not.toHaveBeenCalled();

    // Verify file is STILL open (close failed)
    const filesState = useFilesStore.getState();
    expect(filesState.files.find(f => f.path === tempFilePath)).toBeDefined();
  });
});
