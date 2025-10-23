import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { createFileActions } from './fileActions';
import type { StorageService } from '@shared/interfaces';
import type { File } from '../filesStore';

// Mock dependencies
vi.mock('../../storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(),
    closeFile: vi.fn(),
  },
}));

vi.mock('../../../services/logger', () => ({
  logger: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/document', () => ({
  createArboFile: vi.fn(() => ({
    format: 'Arborescent',
    version: '1.0.0',
    nodes: {},
    rootNodeId: 'root',
  })),
}));

vi.mock('../../../data/defaultTemplate', () => ({
  createBlankDocument: vi.fn(() => ({
    nodes: { root: { id: 'root', content: '', children: [], metadata: {} } },
    rootNodeId: 'root',
    firstNodeId: 'root',
  })),
}));

import { storeManager } from '../../storeManager';
import { logger } from '../../../services/logger';
import { createArboFile } from '../../../utils/document';
import { createBlankDocument } from '../../../data/defaultTemplate';

describe('fileActions', () => {
  let state: {
    files: File[];
    activeFilePath: string | null;
    openFile: Mock;
    closeFile: Mock;
    markAsSaved: Mock;
    setActiveFile: Mock;
  };
  let get: () => typeof state;
  let mockStorage: StorageService;
  let actions: ReturnType<typeof createFileActions>;

  beforeEach(() => {
    vi.clearAllMocks();

    state = {
      files: [],
      activeFilePath: null,
      openFile: vi.fn(),
      closeFile: vi.fn(),
      markAsSaved: vi.fn(),
      setActiveFile: vi.fn(),
    };

    get = () => state;

    mockStorage = {
      loadDocument: vi.fn(),
      saveDocument: vi.fn(),
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      showUnsavedChangesDialog: vi.fn(),
      saveSession: vi.fn(),
      getSession: vi.fn(),
      createTempFile: vi.fn(),
      deleteTempFile: vi.fn(),
      getTempFiles: vi.fn(() => Promise.resolve([])),
      isTempFile: vi.fn(() => Promise.resolve(false)),
    };

    // Mock storeManager responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(storeManager.getStoreForFile).mockReturnValue({
      getState: () => ({
        fileMeta: null,
        actions: {
          saveToPath: vi.fn(() => Promise.resolve()),
          loadFromPath: vi.fn(() => Promise.resolve({ created: '', author: '' })),
          initialize: vi.fn(),
          selectNode: vi.fn(),
          setFilePath: vi.fn(),
        },
      }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    actions = createFileActions(get, mockStorage);
  });

  describe('createNewFile', () => {
    it('should create a new temporary file', async () => {
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      await actions.createNewFile();

      expect(createBlankDocument).toHaveBeenCalled();
      expect(createArboFile).toHaveBeenCalled();
      expect(mockStorage.createTempFile).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(logger.success).toHaveBeenCalledWith('New file created: /tmp/untitled-1.arbo', 'FileNew', false);
    });

    it('should initialize the store for the new file', async () => {
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      const mockActions = {
        initialize: vi.fn(),
        selectNode: vi.fn(),
        setFilePath: vi.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          fileMeta: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actions: mockActions as any,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.createNewFile();

      expect(mockActions.initialize).toHaveBeenCalled();
      expect(mockActions.selectNode).toHaveBeenCalled();
      expect(mockActions.setFilePath).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
    });

    it('should log error on failure', async () => {
      const error = new Error('Failed to create temp file');
      vi.mocked(mockStorage.createTempFile).mockRejectedValue(error);

      await actions.createNewFile();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create new file: Failed to create temp file',
        error,
        'FileNew',
        true
      );
    });
  });

  describe('openFileWithDialog', () => {
    it('should open file selected from dialog', async () => {
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/test/file.arbo');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.openFileWithDialog();

      expect(mockStorage.showOpenDialog).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/test/file.arbo', 'file.arbo', false);
      expect(logger.success).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'FileLoad', false);
    });

    it('should handle temporary files', async () => {
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/tmp/untitled-5.arbo');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);

      await actions.openFileWithDialog();

      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-5.arbo', 'Untitled 5', true);
    });

    it('should do nothing if dialog is cancelled', async () => {
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue(null);

      await actions.openFileWithDialog();

      expect(state.openFile).not.toHaveBeenCalled();
    });

    it('should log error on failure', async () => {
      const error = new Error('Failed to load');
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/test/file.arbo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          actions: {
            loadFromPath: vi.fn(() => Promise.reject(error)),
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.openFileWithDialog();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load file: Failed to load',
        error,
        'FileLoad',
        true
      );
    });
  });

  describe('closeFile', () => {
    it('should close a non-temporary file', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.closeFile('/test/file.arbo');

      expect(storeManager.closeFile).toHaveBeenCalledWith('/test/file.arbo');
      expect(state.closeFile).toHaveBeenCalledWith('/test/file.arbo');
    });

    it('should prompt for unsaved changes when closing temporary file', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(1); // discard

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(mockStorage.showUnsavedChangesDialog).toHaveBeenCalledWith('Untitled 1');
      expect(mockStorage.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.closeFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
    });

    it('should save temporary file before closing when user chooses save', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(0); // save
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/saved/file.arbo');

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(mockStorage.showSaveDialog).toHaveBeenCalled();
      expect(mockStorage.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.markAsSaved).toHaveBeenCalledWith('/tmp/untitled-1.arbo', '/saved/file.arbo', 'file.arbo');
      expect(state.closeFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
    });

    it('should not close file when user cancels', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(2); // cancel

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(state.closeFile).not.toHaveBeenCalled();
      expect(storeManager.closeFile).not.toHaveBeenCalled();
    });

    it('should not close file when save dialog is cancelled', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(0); // save
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(state.closeFile).not.toHaveBeenCalled();
      expect(storeManager.closeFile).not.toHaveBeenCalled();
    });

    it('should not close file when save fails', async () => {
      const error = new Error('Save failed');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(0); // save
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/saved/file.arbo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          fileMeta: null,
          actions: {
            saveToPath: vi.fn(() => Promise.reject(error)),
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save file: Save failed',
        error,
        'FileSaveAs',
        true
      );
      expect(state.closeFile).not.toHaveBeenCalled();
    });
  });

  describe('saveActiveFile', () => {
    it('should save non-temporary file to its current path', async () => {
      state.activeFilePath = '/test/file.arbo';
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.saveActiveFile();

      expect(logger.success).toHaveBeenCalledWith('File saved: /test/file.arbo', 'FileSave', false);
    });

    it('should prompt for path when saving temporary file', async () => {
      state.activeFilePath = '/tmp/untitled-1.arbo';
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/saved/file.arbo');

      await actions.saveActiveFile();

      expect(mockStorage.showSaveDialog).toHaveBeenCalled();
      expect(mockStorage.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.markAsSaved).toHaveBeenCalledWith('/tmp/untitled-1.arbo', '/saved/file.arbo', 'file.arbo');
    });

    it('should do nothing when no active file', async () => {
      state.activeFilePath = null;
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.saveActiveFile();

      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should do nothing when save dialog is cancelled', async () => {
      state.activeFilePath = '/tmp/untitled-1.arbo';
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.saveActiveFile();

      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should log error on failure', async () => {
      const error = new Error('Save failed');
      state.activeFilePath = '/test/file.arbo';
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          fileMeta: null,
          actions: {
            saveToPath: vi.fn(() => Promise.reject(error)),
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.saveActiveFile();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save file: Save failed',
        error,
        'FileSave',
        true
      );
    });
  });

  describe('saveFileAs', () => {
    it('should save file to new path', async () => {
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/new/path.arbo');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.saveFileAs('/test/file.arbo');

      expect(mockStorage.showSaveDialog).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('File saved: /new/path.arbo', 'FileSaveAs', false);
    });

    it('should cleanup temporary file when saving as', async () => {
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/new/path.arbo');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);

      await actions.saveFileAs('/tmp/untitled-1.arbo');

      expect(mockStorage.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.markAsSaved).toHaveBeenCalledWith('/tmp/untitled-1.arbo', '/new/path.arbo', 'path.arbo');
    });

    it('should do nothing when dialog is cancelled', async () => {
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.saveFileAs('/test/file.arbo');

      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should log error on failure', async () => {
      const error = new Error('Save failed');
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/new/path.arbo');
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          fileMeta: null,
          actions: {
            saveToPath: vi.fn(() => Promise.reject(error)),
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.saveFileAs('/test/file.arbo');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save file: Save failed',
        error,
        'FileSaveAs',
        true
      );
    });
  });

  describe('loadAndOpenFile', () => {
    it('should load and open file with default log context', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.loadAndOpenFile('/test/file.arbo');

      expect(state.openFile).toHaveBeenCalledWith('/test/file.arbo', 'file.arbo', false);
      expect(logger.success).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'FileLoad', false);
    });

    it('should load and open file with custom log context', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.loadAndOpenFile('/test/file.arbo', 'CustomContext', true);

      expect(logger.success).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'CustomContext', true);
    });

    it('should handle temporary files', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);

      await actions.loadAndOpenFile('/tmp/untitled-2.arbo');

      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-2.arbo', 'Untitled 2', true);
    });
  });

  describe('initializeSession', () => {
    it('should restore all files from session in order', async () => {
      vi.mocked(mockStorage.getSession).mockResolvedValue({
        openFiles: ['/test/file1.arbo', '/tmp/untitled-1.arbo', '/test/file2.arbo'],
        activeFilePath: '/tmp/untitled-1.arbo',
      });
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue(['/tmp/untitled-1.arbo']);
      vi.mocked(mockStorage.isTempFile).mockImplementation((path) =>
        Promise.resolve(path.startsWith('/tmp'))
      );

      await actions.initializeSession();

      expect(state.openFile).toHaveBeenNthCalledWith(1, '/test/file1.arbo', 'file1.arbo', false);
      expect(state.openFile).toHaveBeenNthCalledWith(2, '/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(state.openFile).toHaveBeenNthCalledWith(3, '/test/file2.arbo', 'file2.arbo', false);
      expect(state.setActiveFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(logger.success).toHaveBeenCalledWith('Restored 3 file(s)', 'SessionRestore', false);
    });

    it('should restore orphaned temporary files not in session', async () => {
      vi.mocked(mockStorage.getSession).mockResolvedValue({
        openFiles: ['/test/file1.arbo'],
        activeFilePath: '/test/file1.arbo',
      });
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue(['/tmp/untitled-1.arbo', '/tmp/untitled-2.arbo']);
      vi.mocked(mockStorage.isTempFile).mockImplementation((path) =>
        Promise.resolve(path.startsWith('/tmp'))
      );

      await actions.initializeSession();

      expect(state.openFile).toHaveBeenCalledWith('/test/file1.arbo', 'file1.arbo', false);
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-2.arbo', 'Untitled 2', true);
      expect(logger.success).toHaveBeenCalledWith('Restored 1 file(s)', 'SessionRestore', false);
      expect(logger.success).toHaveBeenCalledWith('Restored 2 orphaned temporary file(s)', 'SessionRestore', false);
    });

    it('should create new file when no session to restore', async () => {
      vi.mocked(mockStorage.getSession).mockResolvedValue(null);
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      await actions.initializeSession();

      expect(createBlankDocument).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(logger.success).toHaveBeenCalledWith('New file created: /tmp/untitled-1.arbo', 'FileNew', false);
    });

    it('should handle errors when restoring files from session', async () => {
      const error = new Error('Failed to load');
      vi.mocked(mockStorage.getSession).mockResolvedValue({
        openFiles: ['/test/file1.arbo', '/test/file2.arbo'],
        activeFilePath: '/test/file1.arbo',
      });
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      let callCount = 0;
      vi.mocked(storeManager.getStoreForFile).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            getState: () => ({
              actions: {
                loadFromPath: vi.fn(() => Promise.reject(error)),
              },
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        }
        return {
          getState: () => ({
            actions: {
              loadFromPath: vi.fn(() => Promise.resolve({ created: '', author: '' })),
              initialize: vi.fn(),
              selectNode: vi.fn(),
              setFilePath: vi.fn(),
            },
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      await actions.initializeSession();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to restore file: /test/file1.arbo',
        error,
        'SessionRestore',
        false
      );
      // Should still open the second file
      expect(state.openFile).toHaveBeenCalledWith('/test/file2.arbo', 'file2.arbo', false);
    });

    it('should handle errors when restoring orphaned temporary files', async () => {
      const error = new Error('Failed to load temp');
      vi.mocked(mockStorage.getSession).mockResolvedValue({
        openFiles: ['/test/file1.arbo'],
        activeFilePath: '/test/file1.arbo',
      });
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue(['/tmp/untitled-1.arbo']);
      vi.mocked(mockStorage.isTempFile).mockImplementation((path) =>
        Promise.resolve(path.startsWith('/tmp'))
      );
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-2.arbo');

      let callCount = 0;
      vi.mocked(storeManager.getStoreForFile).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds (for /test/file1.arbo)
          return {
            getState: () => ({
              actions: {
                loadFromPath: vi.fn(() => Promise.resolve({ created: '', author: '' })),
              },
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        }
        // Second call fails (for /tmp/untitled-1.arbo)
        return {
          getState: () => ({
            actions: {
              loadFromPath: vi.fn(() => Promise.reject(error)),
              initialize: vi.fn(),
              selectNode: vi.fn(),
              setFilePath: vi.fn(),
            },
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      await actions.initializeSession();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to restore temporary file: /tmp/untitled-1.arbo',
        error,
        'SessionRestore',
        false
      );
      // Should have opened the session file successfully
      expect(state.openFile).toHaveBeenCalledWith('/test/file1.arbo', 'file1.arbo', false);
    });

    it('should not set active file if none restored', async () => {
      vi.mocked(mockStorage.getSession).mockResolvedValue({
        openFiles: ['/test/file1.arbo'],
        activeFilePath: '/test/file1.arbo',
      });
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      const error = new Error('Failed to load');
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          actions: {
            loadFromPath: vi.fn(() => Promise.reject(error)),
            initialize: vi.fn(),
            selectNode: vi.fn(),
            setFilePath: vi.fn(),
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.initializeSession();

      expect(state.setActiveFile).not.toHaveBeenCalled();
      // Should create new file when all files fail to restore
      expect(createBlankDocument).toHaveBeenCalled();
    });
  });
});
