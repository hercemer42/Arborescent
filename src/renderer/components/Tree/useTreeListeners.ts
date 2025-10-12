import { useState, useEffect, useCallback } from 'react';
import { useTreeStore } from '../../store/treeStore';
import { hotkeyService } from '../../services/hotkeyService';
import { logger } from '../../services/logger';
import { ElectronStorageService } from '@platform/storage';
import { ElectronMenuService } from '@platform/menu';

const storageService = new ElectronStorageService();
const menuService = new ElectronMenuService();

export function useTreeListeners() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ created: string; author: string } | null>(null);

  const loadFromPath = useTreeStore((state) => state.actions.loadFromPath);
  const saveToPath = useTreeStore((state) => state.actions.saveToPath);
  const moveUp = useTreeStore((state) => state.actions.moveUp);
  const moveDown = useTreeStore((state) => state.actions.moveDown);

  const handleLoad = async () => {
    try {
      const path = await storageService.showOpenDialog();
      if (!path) return;

      const meta = await loadFromPath(path);
      setFilePath(path);
      setFileMeta(meta);
      logger.success(`File loaded: ${path}`, 'FileLoad', false);
    } catch (error) {
      const message = `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message, error instanceof Error ? error : undefined, 'FileLoad', true);
    }
  };

  const handleSave = async () => {
    try {
      const path = filePath || (await storageService.showSaveDialog());
      if (!path) return;

      await saveToPath(path, fileMeta || undefined);
      setFilePath(path);
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
      setFilePath(path);
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
