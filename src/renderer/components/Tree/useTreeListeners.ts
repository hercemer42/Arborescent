import { useEffect, useCallback } from 'react';
import { useStore } from '../../store/tree/useStore';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { storeManager } from '../../store/storeManager';
import { hotkeyService } from '../../services/hotkeyService';
import { logger } from '../../services/logger';
import { ElectronStorageService } from '@platform/storage';
import { ElectronMenuService } from '@platform/menu';

const storageService = new ElectronStorageService();
const menuService = new ElectronMenuService();

export function useTreeListeners() {
  const currentFilePath = useStore((state) => state.currentFilePath);
  const fileMeta = useStore((state) => state.fileMeta);
  const saveToPath = useStore((state) => state.actions.saveToPath);
  const moveUp = useStore((state) => state.actions.moveUp);
  const moveDown = useStore((state) => state.actions.moveDown);
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

  const handleMoveUp = useCallback(() => {
    moveUp();
  }, [moveUp]);

  const handleMoveDown = useCallback(() => {
    moveDown();
  }, [moveDown]);

  useEffect(() => {
    menuService.onMenuOpen(handleLoad);
    menuService.onMenuSave(handleSave);
    menuService.onMenuSaveAs(handleSaveAs);

    const unregisterUp = hotkeyService.register('navigation.moveUp', handleMoveUp);
    const unregisterDown = hotkeyService.register('navigation.moveDown', handleMoveDown);

    const handleKeyDown = (event: KeyboardEvent) => {
      hotkeyService.handleKeyDown(event);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unregisterUp();
      unregisterDown();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLoad, handleSave, handleSaveAs, handleMoveUp, handleMoveDown]);
}
