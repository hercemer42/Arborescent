import { StorageService } from '../../../../shared/interfaces';
import { storeManager } from '../../storeManager';
import { logger } from '../../../services/logger';
import { createArboFile } from '../../../utils/document';
import { createBlankDocument } from '../../../data/defaultTemplate';
import { File } from '../filesStore';

export interface FileActions {
  closeFile: (filePath: string) => Promise<void>;
  openFileWithDialog: () => Promise<void>;
  createNewFile: () => Promise<void>;
  saveActiveFile: () => Promise<void>;
  saveFileAs: (filePath: string) => Promise<void>;
  loadAndOpenFile: (path: string, logContext?: string, showToast?: boolean) => Promise<void>;
}

type StoreState = {
  files: File[];
  activeFilePath: string | null;
  openFile: (path: string, displayName: string, isTemporary?: boolean) => void;
  closeFile: (path: string) => void;
  markAsSaved: (oldPath: string, newPath: string, newDisplayName: string) => void;
};
type StoreGetter = () => StoreState;

export const createFileActions = (get: StoreGetter, storage: StorageService): FileActions => {
  async function promptUnsavedChanges(displayName: string): Promise<'save' | 'discard' | 'cancel'> {
    const response = await storage.showUnsavedChangesDialog(displayName);
    if (response === 0) return 'save';
    if (response === 1) return 'discard';
    return 'cancel';
  }

  return {
    closeFile: async (filePath: string) => {
      const { closeFile: closeFileAction, markAsSaved } = get();
      const isTemporary = storage.isTempFile(filePath);

      if (isTemporary) {
        const untitledNumber = filePath.match(/untitled-(\d+)/)?.[1] || '1';
        const displayName = `Untitled ${untitledNumber}`;
        const choice = await promptUnsavedChanges(displayName);

        if (choice === 'cancel') return;

        if (choice === 'save') {
          const path = await storage.showSaveDialog();
          if (!path) return;

          try {
            const store = storeManager.getStoreForFile(filePath);
            const { fileMeta, actions } = store.getState();
            await actions.saveToPath(path, fileMeta || undefined);

            await storage.deleteTempFile(filePath);
            const savedDisplayName = path.split(/[\\/]/).pop() || path;
            markAsSaved(filePath, path, savedDisplayName);

            logger.success(`File saved: ${path}`, 'FileSaveAs', false);
          } catch (error) {
            logger.error(
              `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error instanceof Error ? error : undefined,
              'FileSaveAs',
              true
            );
            return;
          }
        } else {
          await storage.deleteTempFile(filePath);
        }
      }

      await storeManager.closeFile(filePath);
      closeFileAction(filePath);
    },

    openFileWithDialog: async () => {
      try {
        const path = await storage.showOpenDialog();
        if (!path) return;

        const { openFile } = get();
        const store = storeManager.getStoreForFile(path);
        const { actions } = store.getState();
        await actions.loadFromPath(path);

        const isTemporary = storage.isTempFile(path);
        const displayName = isTemporary
          ? `Untitled ${path.match(/untitled-(\d+)/)?.[1] || '1'}`
          : path.split(/[\\/]/).pop() || path;

        openFile(path, displayName, isTemporary);
        logger.success(`File loaded: ${path}`, 'FileLoad', false);
      } catch (error) {
        const message = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message, error instanceof Error ? error : undefined, 'FileLoad', true);
      }
    },

    createNewFile: async () => {
      try {
        const { openFile } = get();
        const blank = createBlankDocument();
        const arboFile = createArboFile(blank.nodes, blank.rootNodeId);
        const tempPath = await storage.createTempFile(arboFile);

        const store = storeManager.getStoreForFile(tempPath);
        const { actions } = store.getState();

        actions.initialize(blank.nodes, blank.rootNodeId);
        actions.selectNode(blank.firstNodeId, 0);
        actions.setFilePath(tempPath);

        const untitledNumber = tempPath.match(/untitled-(\d+)/)?.[1] || '1';
        openFile(tempPath, `Untitled ${untitledNumber}`, true);

        logger.success(`New file created: ${tempPath}`, 'FileNew', false);
      } catch (error) {
        const message = `Failed to create new file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message, error instanceof Error ? error : undefined, 'FileNew', true);
      }
    },

    saveActiveFile: async () => {
      try {
        const { activeFilePath, markAsSaved } = get();
        const currentFilePath = activeFilePath;

        const isTemporary = currentFilePath && storage.isTempFile(currentFilePath);
        const path = (isTemporary || !currentFilePath)
          ? await storage.showSaveDialog()
          : currentFilePath;

        if (!path) return;

        const store = storeManager.getStoreForFile(currentFilePath || path);
        const { fileMeta, actions } = store.getState();

        await actions.saveToPath(path, fileMeta || undefined);

        if (isTemporary && currentFilePath) {
          await storage.deleteTempFile(currentFilePath);
          const displayName = path.split(/[\\/]/).pop() || path;
          markAsSaved(currentFilePath, path, displayName);
        }

        logger.success(`File saved: ${path}`, 'FileSave', false);
      } catch (error) {
        const message = `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message, error instanceof Error ? error : undefined, 'FileSave', true);
      }
    },

    saveFileAs: async (filePath: string) => {
      const path = await storage.showSaveDialog();
      if (!path) return;

      try {
        const { markAsSaved } = get();
        const store = storeManager.getStoreForFile(filePath);
        const { fileMeta, actions } = store.getState();

        await actions.saveToPath(path, fileMeta || undefined);

        const isTemporary = storage.isTempFile(filePath);
        if (isTemporary) {
          await storage.deleteTempFile(filePath);
          const displayName = path.split(/[\\/]/).pop() || path;
          markAsSaved(filePath, path, displayName);
        }

        logger.success(`File saved: ${path}`, 'FileSaveAs', false);
      } catch (error) {
        logger.error(
          `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined,
          'FileSaveAs',
          true
        );
      }
    },

    loadAndOpenFile: async (path: string, logContext: string = 'FileLoad', showToast: boolean = false) => {
      const { openFile } = get();
      const store = storeManager.getStoreForFile(path);
      const { actions } = store.getState();
      await actions.loadFromPath(path);

      const isTemporary = storage.isTempFile(path);
      const displayName = isTemporary
        ? `Untitled ${path.match(/untitled-(\d+)/)?.[1] || '1'}`
        : path.split(/[\\/]/).pop() || path;

      openFile(path, displayName, isTemporary);

      logger.success(`File loaded: ${path}`, logContext, showToast);
    },
  };
};
