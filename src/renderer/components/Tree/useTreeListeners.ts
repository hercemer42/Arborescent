import { useState, useEffect, useCallback } from 'react';
import { useTreeStore } from '../../store/treeStore';
import { hotkeyService } from '../../services/hotkeyService';

export function useTreeListeners() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ created: string; author: string } | null>(null);

  const loadFromPath = useTreeStore((state) => state.actions.loadFromPath);
  const saveToPath = useTreeStore((state) => state.actions.saveToPath);
  const moveUp = useTreeStore((state) => state.actions.moveUp);
  const moveDown = useTreeStore((state) => state.actions.moveDown);

  const handleLoad = async () => {
    try {
      const path = await window.electron.showOpenDialog();
      if (!path) return;

      const meta = await loadFromPath(path);
      setFilePath(path);
      setFileMeta(meta);
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

  const handleSave = async () => {
    try {
      const path = filePath || (await window.electron.showSaveDialog());
      if (!path) return;

      await saveToPath(path, fileMeta || undefined);
      setFilePath(path);
      console.log('File saved:', path);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const handleSaveAs = async () => {
    try {
      const path = await window.electron.showSaveDialog();
      if (!path) return;

      await saveToPath(path, fileMeta || undefined);
      setFilePath(path);
      console.log('File saved:', path);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const handleMoveUp = useCallback(() => {
    moveUp();
  }, [moveUp]);

  const handleMoveDown = useCallback(() => {
    moveDown();
  }, [moveDown]);

  useEffect(() => {
    window.electron.onMenuOpen(handleLoad);
    window.electron.onMenuSave(handleSave);
    window.electron.onMenuSaveAs(handleSaveAs);

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
