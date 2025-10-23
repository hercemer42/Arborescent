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
  setActiveFile: (path: string) => void;
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

    const isTemporary = await storage.isTempFile(path);
    const displayName = getDisplayName(path, isTemporary);

    openFile(path, displayName, isTemporary);
    logger.success(`File loaded: ${path}`, logContext, showToast);
  }

  async function createBlankFile(logContext: string): Promise<string> {
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

    logger.success(`New file created: ${tempPath}`, logContext, false);
    return tempPath;
  }

  async function restoreSessionFiles(): Promise<boolean> {
    const session = await storage.getSession();
    if (!session || session.openFiles.length === 0) {
      return false;
    }

    let restoredAny = false;
    for (const filePath of session.openFiles) {
      try {
        await open(filePath, 'SessionRestore', false);
        restoredAny = true;
      } catch (error) {
        logger.error(
          `Failed to restore file: ${filePath}`,
          error instanceof Error ? error : undefined,
          'SessionRestore',
          false
        );
      }
    }

    if (restoredAny && session.activeFilePath) {
      const { setActiveFile } = get();
      setActiveFile(session.activeFilePath);
    }

    if (restoredAny) {
      logger.success(`Restored ${session.openFiles.length} file(s)`, 'SessionRestore', false);
    }

    return restoredAny;
  }

  async function restoreOrphanedTempFiles(): Promise<boolean> {
    const session = await storage.getSession();
    const sessionFiles = new Set(session?.openFiles || []);
    const tempFiles = await storage.getTempFiles();

    const orphanedTempFiles = tempFiles.filter(path => !sessionFiles.has(path));

    if (orphanedTempFiles.length === 0) {
      return false;
    }

    let restoredAny = false;
    for (const tempPath of orphanedTempFiles) {
      try {
        await open(tempPath, 'SessionRestore', false);
        restoredAny = true;
      } catch (error) {
        logger.error(
          `Failed to restore temporary file: ${tempPath}`,
          error instanceof Error ? error : undefined,
          'SessionRestore',
          false
        );
      }
    }

    if (restoredAny) {
      logger.success(`Restored ${orphanedTempFiles.length} orphaned temporary file(s)`, 'SessionRestore', false);
    }

    return restoredAny;
  }

  async function closeFile(filePath: string): Promise<void> {
    const { closeFile: closeFileAction } = get();
    const isTemporary = await storage.isTempFile(filePath);

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
  }

  async function openFileWithDialog(): Promise<void> {
    try {
      const path = await storage.showOpenDialog();
      if (!path) return;

      await open(path, 'FileLoad', false);
    } catch (error) {
      const message = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message, error instanceof Error ? error : undefined, 'FileLoad', true);
    }
  }

  async function createNewFile(): Promise<void> {
    try {
      await createBlankFile('FileNew');
    } catch (error) {
      const message = `Failed to create new file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message, error instanceof Error ? error : undefined, 'FileNew', true);
    }
  }

  async function saveActiveFile(): Promise<void> {
    try {
      const { activeFilePath } = get();
      const currentFilePath = activeFilePath;

      const isTemporary = currentFilePath && await storage.isTempFile(currentFilePath);
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
  }

  async function saveFileAs(filePath: string): Promise<void> {
    const path = await storage.showSaveDialog();
    if (!path) return;

    try {
      await save(filePath, path, 'FileSaveAs');
      const isTemporary = await storage.isTempFile(filePath);
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
  }

  async function loadAndOpenFile(path: string, logContext: string = 'FileLoad', showToast: boolean = false): Promise<void> {
    await open(path, logContext, showToast);
  }

  async function initializeSession(): Promise<void> {
    const hasSessionFiles = await restoreSessionFiles();
    const hasOrphanedTempFiles = await restoreOrphanedTempFiles();

    if (!hasSessionFiles && !hasOrphanedTempFiles) {
      await createBlankFile('FileNew');
    }
  }

  return {
    closeFile,
    openFileWithDialog,
    createNewFile,
    saveActiveFile,
    saveFileAs,
    loadAndOpenFile,
    initializeSession,
  };
};
