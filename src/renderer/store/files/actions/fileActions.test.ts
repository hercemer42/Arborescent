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
    };

    get = () => state;

    mockStorage = {
      loadDocument: vi.fn(),
      saveDocument: vi.fn(),
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      showUnsavedChangesDialog: vi.fn(),
      saveLastSession: vi.fn(),
      getLastSession: vi.fn(),
      createTempFile: vi.fn(),
      deleteTempFile: vi.fn(),
      getTempFiles: vi.fn(() => []),
      listTempFiles: vi.fn(() => Promise.resolve([])),
      isTempFile: vi.fn(() => false),
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
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.openFileWithDialog();

      expect(mockStorage.showOpenDialog).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/test/file.arbo', 'file.arbo', false);
      expect(logger.success).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'FileLoad', false);
    });

    it('should handle temporary files', async () => {
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/tmp/untitled-5.arbo');
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);

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
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.closeFile('/test/file.arbo');

      expect(storeManager.closeFile).toHaveBeenCalledWith('/test/file.arbo');
      expect(state.closeFile).toHaveBeenCalledWith('/test/file.arbo');
    });

    it('should prompt for unsaved changes when closing temporary file', async () => {
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(1); // discard

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(mockStorage.showUnsavedChangesDialog).toHaveBeenCalledWith('Untitled 1');
      expect(mockStorage.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.closeFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
    });

    it('should save temporary file before closing when user chooses save', async () => {
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(0); // save
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/saved/file.arbo');

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(mockStorage.showSaveDialog).toHaveBeenCalled();
      expect(mockStorage.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.markAsSaved).toHaveBeenCalledWith('/tmp/untitled-1.arbo', '/saved/file.arbo', 'file.arbo');
      expect(state.closeFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
    });

    it('should not close file when user cancels', async () => {
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(2); // cancel

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(state.closeFile).not.toHaveBeenCalled();
      expect(storeManager.closeFile).not.toHaveBeenCalled();
    });

    it('should not close file when save dialog is cancelled', async () => {
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.showUnsavedChangesDialog).mockResolvedValue(0); // save
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.closeFile('/tmp/untitled-1.arbo');

      expect(state.closeFile).not.toHaveBeenCalled();
      expect(storeManager.closeFile).not.toHaveBeenCalled();
    });

    it('should not close file when save fails', async () => {
      const error = new Error('Save failed');
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
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
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.saveActiveFile();

      expect(logger.success).toHaveBeenCalledWith('File saved: /test/file.arbo', 'FileSave', false);
    });

    it('should prompt for path when saving temporary file', async () => {
      state.activeFilePath = '/tmp/untitled-1.arbo';
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
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
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.saveActiveFile();

      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should log error on failure', async () => {
      const error = new Error('Save failed');
      state.activeFilePath = '/test/file.arbo';
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);
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
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.saveFileAs('/test/file.arbo');

      expect(mockStorage.showSaveDialog).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('File saved: /new/path.arbo', 'FileSaveAs', false);
    });

    it('should cleanup temporary file when saving as', async () => {
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/new/path.arbo');
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);

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
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.loadAndOpenFile('/test/file.arbo');

      expect(state.openFile).toHaveBeenCalledWith('/test/file.arbo', 'file.arbo', false);
      expect(logger.success).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'FileLoad', false);
    });

    it('should load and open file with custom log context', async () => {
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.loadAndOpenFile('/test/file.arbo', 'CustomContext', true);

      expect(logger.success).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'CustomContext', true);
    });

    it('should handle temporary files', async () => {
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);

      await actions.loadAndOpenFile('/tmp/untitled-2.arbo');

      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-2.arbo', 'Untitled 2', true);
    });
  });

  describe('initializeSession', () => {
    it('should restore last session when available', async () => {
      vi.mocked(mockStorage.getLastSession).mockReturnValue('/last/session.arbo');
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);

      await actions.initializeSession();

      expect(state.openFile).toHaveBeenCalledWith('/last/session.arbo', 'session.arbo', false);
      expect(logger.success).toHaveBeenCalledWith('File loaded: /last/session.arbo', 'SessionRestore', false);
    });

    it('should not restore last session if it is a temp file', async () => {
      vi.mocked(mockStorage.getLastSession).mockReturnValue('/tmp/untitled-1.arbo');
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.getTempFiles).mockReturnValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-2.arbo');

      await actions.initializeSession();

      // Should create a new file instead
      expect(createBlankDocument).toHaveBeenCalled();
    });

    it('should restore temporary files', async () => {
      vi.mocked(mockStorage.getLastSession).mockReturnValue(null);
      vi.mocked(mockStorage.getTempFiles).mockReturnValue(['/tmp/untitled-1.arbo', '/tmp/untitled-2.arbo']);
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);

      await actions.initializeSession();

      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-2.arbo', 'Untitled 2', true);
      expect(logger.success).toHaveBeenCalledWith('Restored 2 temporary file(s)', 'SessionRestore', false);
    });

    it('should create new file when no session to restore', async () => {
      vi.mocked(mockStorage.getLastSession).mockReturnValue(null);
      vi.mocked(mockStorage.getTempFiles).mockReturnValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      await actions.initializeSession();

      expect(createBlankDocument).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(logger.success).toHaveBeenCalledWith('New file created: /tmp/untitled-1.arbo', 'FileNew', false);
    });

    it('should handle errors when restoring last session', async () => {
      const error = new Error('Failed to load');
      vi.mocked(mockStorage.getLastSession).mockReturnValue('/last/session.arbo');
      vi.mocked(mockStorage.isTempFile).mockReturnValue(false);
      vi.mocked(mockStorage.getTempFiles).mockReturnValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');
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

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to restore session: Failed to load',
        error,
        'SessionRestore',
        false
      );
      // Should fall back to creating new file
      expect(createBlankDocument).toHaveBeenCalled();
    });

    it('should handle errors when restoring temporary files', async () => {
      const error = new Error('Failed to load temp');
      vi.mocked(mockStorage.getLastSession).mockReturnValue(null);
      vi.mocked(mockStorage.getTempFiles).mockReturnValue(['/tmp/untitled-1.arbo']);
      vi.mocked(mockStorage.isTempFile).mockReturnValue(true);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-2.arbo');
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

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to restore temporary files: Failed to load temp',
        error,
        'SessionRestore',
        false
      );
      // Should fall back to creating new file
      expect(createBlankDocument).toHaveBeenCalled();
    });
  });
});
