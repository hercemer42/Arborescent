import { StorageService } from '../../../../shared/interfaces';
import { storeManager } from '../../storeManager';
import { logger } from '../../../services/logger';
import { createArboFile, extractBlueprintNodes } from '../../../utils/document';
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
  exportAsBlueprint: (filePath: string) => Promise<void>;
  importFromBlueprint: () => Promise<void>;
}

type StoreState = {
  files: File[];
  activeFilePath: string | null;
  openFile: (path: string, displayName: string, isTemporary?: boolean) => void;
  closeFile: (path: string) => void;
  markAsSaved: (oldPath: string, newPath: string, newDisplayName: string) => void;
  setActiveFile: (path: string) => void;
  openZoomTab: (sourceFilePath: string, nodeId: string, nodeContent: string) => void;
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

    // Move the store from old path to new path in storeManager
    storeManager.moveStore(oldPath, newPath);

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

  function parseZoomPath(filePath: string): { sourceFilePath: string; nodeId: string } | null {
    if (!filePath.startsWith('zoom://')) return null;
    const withoutPrefix = filePath.slice('zoom://'.length);
    const hashIndex = withoutPrefix.lastIndexOf('#');
    if (hashIndex === -1) return null;
    return {
      sourceFilePath: withoutPrefix.slice(0, hashIndex),
      nodeId: withoutPrefix.slice(hashIndex + 1),
    };
  }

  async function restoreSessionFiles(): Promise<boolean> {
    const session = await storage.getSession();
    if (!session || session.openFiles.length === 0) {
      return false;
    }

    const { openFile } = get();
    let restoredAny = false;

    // First pass: restore regular files (not zoom tabs)
    // Zoom tabs need their source file loaded first
    const regularFiles: string[] = [];
    const zoomTabs: Array<{ path: string; sourceFilePath: string; nodeId: string }> = [];

    for (const filePath of session.openFiles) {
      const zoomInfo = parseZoomPath(filePath);
      if (zoomInfo) {
        zoomTabs.push({ path: filePath, ...zoomInfo });
      } else {
        regularFiles.push(filePath);
      }
    }

    // Restore regular files first
    for (const filePath of regularFiles) {
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

    // Then restore zoom tabs (only if their source file was restored)
    for (const zoom of zoomTabs) {
      try {
        // Check if source file was restored
        const { files } = get();
        const sourceFileRestored = files.some(f => f.path === zoom.sourceFilePath);
        if (!sourceFileRestored) {
          logger.error(
            `Skipping zoom tab - source file not available: ${zoom.sourceFilePath}`,
            undefined,
            'SessionRestore',
            false
          );
          continue;
        }

        // Check if zoomed node still exists
        const store = storeManager.getStoreForFile(zoom.sourceFilePath);
        const node = store.getState().nodes[zoom.nodeId];
        if (!node) {
          logger.error(
            `Skipping zoom tab - zoomed node no longer exists: ${zoom.nodeId}`,
            undefined,
            'SessionRestore',
            false
          );
          continue;
        }

        const { openZoomTab } = get();
        openZoomTab(zoom.sourceFilePath, zoom.nodeId, node.content);
        restoredAny = true;
      } catch (error) {
        logger.error(
          `Failed to restore zoom tab: ${zoom.path}`,
          error instanceof Error ? error : undefined,
          'SessionRestore',
          false
        );
      }
    }

    if (restoredAny && session.activeFilePath) {
      const { setActiveFile, files } = get();
      // Only set active if it was restored
      const activeWasRestored = files.some(f => f.path === session.activeFilePath);
      if (activeWasRestored) {
        setActiveFile(session.activeFilePath);
      }
    }

    if (restoredAny) {
      logger.success(`Restored ${regularFiles.length + zoomTabs.length} file(s)`, 'SessionRestore', false);
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
      const zoomInfo = activeFilePath ? parseZoomPath(activeFilePath) : null;
      const currentFilePath = zoomInfo ? zoomInfo.sourceFilePath : activeFilePath;

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
    // For existing files, default to the file's directory; for temp files, use last saved directory
    const isTemporary = await storage.isTempFile(filePath);
    const defaultDir = isTemporary ? undefined : filePath.substring(0, filePath.lastIndexOf('/'));

    const path = await storage.showSaveDialog(defaultDir);
    if (!path) return;

    try {
      await save(filePath, path, 'FileSaveAs');

      if (isTemporary) {
        await cleanUp(filePath, path);
      } else {
        // For non-temporary files, still need to update the tab name and store mapping
        const { markAsSaved } = get();
        const displayName = getDisplayName(path, false);
        storeManager.moveStore(filePath, path);
        markAsSaved(filePath, path, displayName);
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

  async function exportAsBlueprint(filePath: string): Promise<void> {
    try {
      const store = storeManager.getStoreForFile(filePath);
      const { nodes, rootNodeId, fileMeta } = store.getState();

      // Extract only blueprint nodes
      const blueprintNodes = extractBlueprintNodes(nodes, rootNodeId);

      if (Object.keys(blueprintNodes).length === 0) {
        logger.error('No blueprint nodes to export', undefined, 'BlueprintExport', true);
        return;
      }

      // Show save dialog
      const path = await storage.showSaveDialog();
      if (!path) return;

      // Create blueprint file with isBlueprint flag
      const arboFile = createArboFile(blueprintNodes, rootNodeId, fileMeta || undefined, true);
      await storage.saveDocument(path, arboFile);

      // If exporting to the same path as the open file, update the store to reflect the new state
      if (path === filePath) {
        const { actions } = store.getState();
        // Reinitialize with blueprint nodes only and set blueprint flags
        actions.initialize(blueprintNodes, rootNodeId);
        store.setState({
          isFileBlueprintFile: true,
          blueprintModeEnabled: true,
        });
      }

      logger.success(`Blueprint exported: ${path}`, 'BlueprintExport', true);
    } catch (error) {
      logger.error(
        `Failed to export blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        'BlueprintExport',
        true
      );
    }
  }

  async function importFromBlueprint(): Promise<void> {
    try {
      // Show open dialog to select blueprint file
      const path = await storage.showOpenDialog();
      if (!path) return;

      // Load the blueprint file
      const data = await storage.loadDocument(path);

      if (!data.isBlueprint) {
        logger.error('Selected file is not a blueprint', undefined, 'BlueprintImport', true);
        return;
      }

      // Create a new temp file based on the blueprint
      const { openFile } = get();

      // Remove isBlueprint flag from the imported copy (it's now a regular file)
      const importedNodes = { ...data.nodes };

      const arboFile = createArboFile(importedNodes, data.rootNodeId);
      const tempPath = await storage.createTempFile(arboFile);

      const store = storeManager.getStoreForFile(tempPath);
      const { actions } = store.getState();

      actions.initialize(importedNodes, data.rootNodeId);
      actions.setFilePath(tempPath);

      // Open in normal mode (not blueprint mode)
      const displayName = getDisplayName(tempPath, true);
      openFile(tempPath, displayName, true);

      logger.success('Blueprint imported as new file', 'BlueprintImport', true);
    } catch (error) {
      logger.error(
        `Failed to import blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        'BlueprintImport',
        true
      );
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
    exportAsBlueprint,
    importFromBlueprint,
  };
};
