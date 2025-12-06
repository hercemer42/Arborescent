import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { createFileActions } from '../fileActions';
import type { StorageService } from '@shared/interfaces';
import type { File } from '../../filesStore';

// Mock dependencies
vi.mock('../../../storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(),
    closeFile: vi.fn(),
    moveStore: vi.fn(),
  },
}));

vi.mock('../../../../services/logger', () => ({
  logger: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/document', () => ({
  createArboFile: vi.fn(() => ({
    format: 'Arborescent',
    version: '1.0.0',
    nodes: {},
    rootNodeId: 'root',
  })),
  extractBlueprintNodes: vi.fn((nodes) => {
    // Return only nodes with isBlueprint metadata
    const result: Record<string, unknown> = {};
    Object.entries(nodes).forEach(([id, node]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((node as any).metadata?.isBlueprint) {
        result[id] = node;
      }
    });
    return result;
  }),
}));

vi.mock('../../../../data/defaultTemplate', () => ({
  createBlankDocument: vi.fn(() => ({
    nodes: { root: { id: 'root', content: '', children: [], metadata: {} } },
    rootNodeId: 'root',
    firstNodeId: 'root',
  })),
}));

import { storeManager } from '../../../storeManager';
import { logger } from '../../../../services/logger';
import { createArboFile, extractBlueprintNodes } from '../../../../utils/document';
import { createBlankDocument } from '../../../../data/defaultTemplate';

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
      saveBrowserSession: vi.fn(),
      getBrowserSession: vi.fn(() => Promise.resolve(null)),
      savePanelSession: vi.fn(),
      getPanelSession: vi.fn(() => Promise.resolve(null)),
    };

    // Mock storeManager responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (storeManager.getStoreForFile as ReturnType<typeof vi.fn>).mockReturnValue({
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

      expect(createBlankDocument as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(createArboFile as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(mockStorage.createTempFile).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('New file created: /tmp/untitled-1.arbo', 'FileNew', false);
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'FileLoad', false);
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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

      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('File saved: /test/file.arbo', 'FileSave', false);
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

      expect((logger.success as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });

    it('should do nothing when save dialog is cancelled', async () => {
      state.activeFilePath = '/tmp/untitled-1.arbo';
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.saveActiveFile();

      expect((logger.success as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('File saved: /new/path.arbo', 'FileSaveAs', false);
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

      expect((logger.success as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });

    it('should update tab name when saving non-temporary file with new name', async () => {
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/new/project.arbo');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.saveFileAs('/old/file.arbo');

      // Should pass the file's directory to the save dialog
      expect(mockStorage.showSaveDialog).toHaveBeenCalledWith('/old');
      // Should move the store to the new path
      expect(storeManager.moveStore).toHaveBeenCalledWith('/old/file.arbo', '/new/project.arbo');
      // Should update the tab with the new name
      expect(state.markAsSaved).toHaveBeenCalledWith('/old/file.arbo', '/new/project.arbo', 'project.arbo');
    });

    it('should use last saved directory for temporary files', async () => {
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/saved/file.arbo');
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(true);

      await actions.saveFileAs('/tmp/untitled-1.arbo');

      // Should not pass a default directory for temp files
      expect(mockStorage.showSaveDialog).toHaveBeenCalledWith(undefined);
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'FileLoad', false);
    });

    it('should load and open file with custom log context', async () => {
      vi.mocked(mockStorage.isTempFile).mockResolvedValue(false);

      await actions.loadAndOpenFile('/test/file.arbo', 'CustomContext', true);

      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('File loaded: /test/file.arbo', 'CustomContext', true);
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
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('Restored 3 file(s)', 'SessionRestore', false);
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
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('Restored 1 file(s)', 'SessionRestore', false);
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('Restored 2 orphaned temporary file(s)', 'SessionRestore', false);
    });

    it('should create new file when no session to restore', async () => {
      vi.mocked(mockStorage.getSession).mockResolvedValue(null);
      vi.mocked(mockStorage.getTempFiles).mockResolvedValue([]);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');

      await actions.initializeSession();

      expect(createBlankDocument as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect((logger.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('New file created: /tmp/untitled-1.arbo', 'FileNew', false);
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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

      expect((logger.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
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
      expect(createBlankDocument as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    });
  });

  describe('exportAsBlueprint', () => {
    it('should export blueprint nodes to a new file', async () => {
      const blueprintNodes = {
        'node-1': { id: 'node-1', content: 'Blueprint', children: [], metadata: { isBlueprint: true } },
      };
      const allNodes = {
        'root': { id: 'root', content: '', children: ['node-1', 'node-2'], metadata: {} },
        'node-1': { id: 'node-1', content: 'Blueprint', children: [], metadata: { isBlueprint: true } },
        'node-2': { id: 'node-2', content: 'Regular', children: [], metadata: {} },
      };

      vi.mocked(extractBlueprintNodes).mockReturnValue(blueprintNodes);
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          nodes: allNodes,
          rootNodeId: 'root',
          fileMeta: { created: '2024-01-01', author: 'test' },
          actions: { initialize: vi.fn() },
        }),
        setState: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/exported/blueprint.arbo');

      await actions.exportAsBlueprint('/test/file.arbo');

      expect(extractBlueprintNodes).toHaveBeenCalledWith(allNodes, 'root');
      expect(createArboFile).toHaveBeenCalledWith(
        blueprintNodes,
        'root',
        { created: '2024-01-01', author: 'test' },
        true
      );
      expect(mockStorage.saveDocument).toHaveBeenCalledWith('/exported/blueprint.arbo', expect.any(Object));
      expect(logger.success).toHaveBeenCalledWith('Blueprint exported: /exported/blueprint.arbo', 'BlueprintExport', true);
    });

    it('should error when no blueprint nodes exist', async () => {
      vi.mocked(extractBlueprintNodes).mockReturnValue({});
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          nodes: { root: { id: 'root', children: [], metadata: {} } },
          rootNodeId: 'root',
          fileMeta: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.exportAsBlueprint('/test/file.arbo');

      expect(logger.error).toHaveBeenCalledWith('No blueprint nodes to export', undefined, 'BlueprintExport', true);
      expect(mockStorage.showSaveDialog).not.toHaveBeenCalled();
    });

    it('should do nothing when save dialog is cancelled', async () => {
      vi.mocked(extractBlueprintNodes).mockReturnValue({
        'node-1': { id: 'node-1', content: '', children: [], metadata: { isBlueprint: true } },
      });
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          nodes: { 'node-1': { id: 'node-1', content: '', children: [], metadata: { isBlueprint: true } } },
          rootNodeId: 'root',
          fileMeta: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue(null);

      await actions.exportAsBlueprint('/test/file.arbo');

      expect(mockStorage.saveDocument).not.toHaveBeenCalled();
      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should update store when exporting to same file path', async () => {
      const blueprintNodes = {
        'node-1': { id: 'node-1', content: 'Blueprint', children: [], metadata: { isBlueprint: true } },
      };
      const mockInitialize = vi.fn();
      const mockSetState = vi.fn();

      vi.mocked(extractBlueprintNodes).mockReturnValue(blueprintNodes);
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          nodes: blueprintNodes,
          rootNodeId: 'root',
          fileMeta: null,
          actions: { initialize: mockInitialize },
        }),
        setState: mockSetState,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/test/file.arbo'); // Same path

      await actions.exportAsBlueprint('/test/file.arbo');

      expect(mockInitialize).toHaveBeenCalledWith(blueprintNodes, 'root');
      expect(mockSetState).toHaveBeenCalledWith({
        isFileBlueprintFile: true,
        blueprintModeEnabled: true,
      });
    });

    it('should log error on export failure', async () => {
      const error = new Error('Export failed');
      vi.mocked(extractBlueprintNodes).mockReturnValue({
        'node-1': { id: 'node-1', content: '', children: [], metadata: { isBlueprint: true } },
      });
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          nodes: {},
          rootNodeId: 'root',
          fileMeta: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(mockStorage.showSaveDialog).mockResolvedValue('/exported/blueprint.arbo');
      vi.mocked(mockStorage.saveDocument).mockRejectedValue(error);

      await actions.exportAsBlueprint('/test/file.arbo');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to export blueprint: Export failed',
        error,
        'BlueprintExport',
        true
      );
    });
  });

  describe('importFromBlueprint', () => {
    const createMockArboFile = (overrides: Record<string, unknown> = {}) => ({
      format: 'Arborescent' as const,
      version: '1.0.0',
      created: '2024-01-01',
      updated: '2024-01-01',
      author: 'test',
      nodes: {},
      rootNodeId: 'root',
      ...overrides,
    });

    it('should import blueprint as new temp file', async () => {
      const blueprintNodes = {
        'root': { id: 'root', content: '', children: ['node-1'], metadata: {} },
        'node-1': { id: 'node-1', content: 'Blueprint node', children: [], metadata: { isBlueprint: true } },
      };
      const blueprintData = createMockArboFile({
        nodes: blueprintNodes,
        rootNodeId: 'root',
        isBlueprint: true,
      });
      const mockInitialize = vi.fn();
      const mockSetFilePath = vi.fn();

      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/blueprints/template.arbo');
      vi.mocked(mockStorage.loadDocument).mockResolvedValue(blueprintData);
      vi.mocked(mockStorage.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');
      vi.mocked(storeManager.getStoreForFile).mockReturnValue({
        getState: () => ({
          actions: {
            initialize: mockInitialize,
            setFilePath: mockSetFilePath,
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await actions.importFromBlueprint();

      expect(mockStorage.showOpenDialog).toHaveBeenCalled();
      expect(mockStorage.loadDocument).toHaveBeenCalledWith('/blueprints/template.arbo');
      expect(mockInitialize).toHaveBeenCalledWith(blueprintNodes, 'root');
      expect(mockSetFilePath).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(state.openFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo', 'Untitled 1', true);
      expect(logger.success).toHaveBeenCalledWith('Blueprint imported as new file', 'BlueprintImport', true);
    });

    it('should error when file is not a blueprint', async () => {
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/regular/file.arbo');
      vi.mocked(mockStorage.loadDocument).mockResolvedValue(createMockArboFile({
        isBlueprint: false,
      }));

      await actions.importFromBlueprint();

      expect(logger.error).toHaveBeenCalledWith('Selected file is not a blueprint', undefined, 'BlueprintImport', true);
      expect(state.openFile).not.toHaveBeenCalled();
    });

    it('should do nothing when open dialog is cancelled', async () => {
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue(null);

      await actions.importFromBlueprint();

      expect(mockStorage.loadDocument).not.toHaveBeenCalled();
      expect(state.openFile).not.toHaveBeenCalled();
    });

    it('should log error on import failure', async () => {
      const error = new Error('Import failed');
      vi.mocked(mockStorage.showOpenDialog).mockResolvedValue('/blueprints/template.arbo');
      vi.mocked(mockStorage.loadDocument).mockRejectedValue(error);

      await actions.importFromBlueprint();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to import blueprint: Import failed',
        error,
        'BlueprintImport',
        true
      );
    });
  });
});
