import { StorageService } from '../../../../shared/interfaces';
import { storeManager } from '../../storeManager';
import { logger } from '../../../services/logger';
import { createArboFile } from '../../../utils/document';
import { createBlankDocument } from '../../../data/defaultTemplate';
import { File } from '../filesStore';
import { getDisplayName } from '../../../../shared/utils/fileNaming';

export interface FileActions {
  closeFile: (filePath: string) => Promise<void>;
  openFileWithDialog: () => Promise<void>;
  createNewFile: () => Promise<void>;
  saveActiveFile: () => Promise<void>;
  saveFileAs: (filePath: string) => Promise<void>;
  loadAndOpenFile: (path: string, logContext?: string, showToast?: boolean) => Promise<void>;
  initializeSession: () => Promise<void>;
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

  async function save(
    filePath: string,
    newPath: string,
    logContext: string
  ): Promise<void> {
    const store = storeManager.getStoreForFile(filePath);
    const { fileMeta, actions } = store.getState();
    await actions.saveToPath(newPath, fileMeta || undefined);
    logger.success(`File saved: ${newPath}`, logContext, false);
  }

  async function cleanUp(oldPath: string, newPath: string): Promise<void> {
    const { markAsSaved } = get();
    await storage.deleteTempFile(oldPath);
    const displayName = getDisplayName(newPath, false);
    markAsSaved(oldPath, newPath, displayName);
  }

  async function open(
    path: string,
    logContext: string = 'FileLoad',
    showToast: boolean = false
  ): Promise<void> {
    const { openFile } = get();
    const store = storeManager.getStoreForFile(path);
    const { actions } = store.getState();
    await actions.loadFromPath(path);

    const isTemporary = storage.isTempFile(path);
    const displayName = getDisplayName(path, isTemporary);

    openFile(path, displayName, isTemporary);
    logger.success(`File loaded: ${path}`, logContext, showToast);
  }

  return {
    closeFile: async (filePath: string) => {
      const { closeFile: closeFileAction } = get();
      const isTemporary = storage.isTempFile(filePath);

      if (isTemporary) {
        const displayName = getDisplayName(filePath, true);
        const choice = await promptUnsavedChanges(displayName);

        if (choice === 'cancel') return;

        if (choice === 'save') {
          const path = await storage.showSaveDialog();
          if (!path) return;

          try {
            await save(filePath, path, 'FileSaveAs');
            await cleanUp(filePath, path);
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

        await open(path, 'FileLoad', false);
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

        const displayName = getDisplayName(tempPath, true);
        openFile(tempPath, displayName, true);

        logger.success(`New file created: ${tempPath}`, 'FileNew', false);
      } catch (error) {
        const message = `Failed to create new file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message, error instanceof Error ? error : undefined, 'FileNew', true);
      }
    },

    saveActiveFile: async () => {
      try {
        const { activeFilePath } = get();
        const currentFilePath = activeFilePath;

        const isTemporary = currentFilePath && storage.isTempFile(currentFilePath);
        const path = (isTemporary || !currentFilePath)
          ? await storage.showSaveDialog()
          : currentFilePath;

        if (!path) return;

        await save(currentFilePath || path, path, 'FileSave');
        if (isTemporary && currentFilePath) {
          await cleanUp(currentFilePath, path);
        }
      } catch (error) {
        const message = `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message, error instanceof Error ? error : undefined, 'FileSave', true);
      }
    },

    saveFileAs: async (filePath: string) => {
      const path = await storage.showSaveDialog();
      if (!path) return;

      try {
        await save(filePath, path, 'FileSaveAs');
        const isTemporary = storage.isTempFile(filePath);
        if (isTemporary) {
          await cleanUp(filePath, path);
        }
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
      await open(path, logContext, showToast);
    },

    initializeSession: async () => {
      async function restoreLastSession(): Promise<boolean> {
        const lastSession = storage.getLastSession();
        const isTempFile = lastSession && storage.isTempFile(lastSession);

        if (lastSession && !isTempFile) {
          try {
            await open(lastSession, 'SessionRestore', false);
            return true;
          } catch (error) {
            logger.error(
              `Failed to restore session: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error instanceof Error ? error : undefined,
              'SessionRestore',
              false
            );
          }
        }
        return false;
      }

      async function restoreTempFiles(): Promise<boolean> {
        const tempFiles = storage.getTempFiles();
        if (tempFiles.length > 0) {
          try {
            for (const tempPath of tempFiles) {
              await open(tempPath, 'SessionRestore', false);
            }
            logger.success(`Restored ${tempFiles.length} temporary file(s)`, 'SessionRestore', false);
            return true;
          } catch (error) {
            logger.error(
              `Failed to restore temporary files: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error instanceof Error ? error : undefined,
              'SessionRestore',
              false
            );
          }
        }
        return false;
      }

      async function createDefaultFile(): Promise<void> {
        const { openFile } = get();
        const blank = createBlankDocument();
        const arboFile = createArboFile(blank.nodes, blank.rootNodeId);
        const tempPath = await storage.createTempFile(arboFile);

        const store = storeManager.getStoreForFile(tempPath);
        const { actions } = store.getState();

        actions.initialize(blank.nodes, blank.rootNodeId);
        actions.selectNode(blank.firstNodeId, 0);
        actions.setFilePath(tempPath);

        const displayName = getDisplayName(tempPath, true);
        openFile(tempPath, displayName, true);

        logger.success(`New file created: ${tempPath}`, 'FileNew', false);
      }

      const hasLastSession = await restoreLastSession();
      const hasTempFiles = await restoreTempFiles();

      if (!hasLastSession && !hasTempFiles) {
        await createDefaultFile();
      }
    },
  };
};
