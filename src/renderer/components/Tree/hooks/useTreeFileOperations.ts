import { useStore } from '../../../store/tree/useStore';
import { useTabsStore } from '../../../store/tabs/tabsStore';
import { storeManager } from '../../../store/storeManager';
import { logger } from '../../../services/logger';
import { ElectronStorageService } from '@platform/storage';

const storageService = new ElectronStorageService();

export function useTreeFileOperations() {
  const currentFilePath = useStore((state) => state.currentFilePath);
  const fileMeta = useStore((state) => state.fileMeta);
  const saveToPath = useStore((state) => state.actions.saveToPath);
  const openFile = useTabsStore((state) => state.openFile);

  const handleLoad = async () => {
    try {
      const path = await storageService.showOpenDialog();
      if (!path) return;

      const store = storeManager.getStoreForFile(path);
      const { actions } = store.getState();

      await actions.loadFromPath(path);

      const displayName = path.split(/[\\/]/).pop() || path;
      openFile(path, displayName);

      logger.success(`File loaded: ${path}`, 'FileLoad', false);
    } catch (error) {
      const message = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message, error instanceof Error ? error : undefined, 'FileLoad', true);
    }
  };

  const handleSave = async () => {
    try {
      const path = currentFilePath || (await storageService.showSaveDialog());
      if (!path) return;

      await saveToPath(path, fileMeta || undefined);
      logger.success(`File saved: ${path}`, 'FileSave', false);
    } catch (error) {
      const message = `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message, error instanceof Error ? error : undefined, 'FileSave', true);
    }
  };

  const handleSaveAs = async () => {
    try {
      const path = await storageService.showSaveDialog();
      if (!path) return;

      await saveToPath(path, fileMeta || undefined);
      logger.success(`File saved: ${path}`, 'FileSaveAs', false);
    } catch (error) {
      const message = `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message, error instanceof Error ? error : undefined, 'FileSaveAs', true);
    }
  };

  return {
    handleLoad,
    handleSave,
    handleSaveAs,
  };
}
