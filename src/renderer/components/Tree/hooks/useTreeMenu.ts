import { useEffect } from 'react';
import { MenuService } from '@platform';
import { useStore } from '../../../store/tree/useStore';
import { useFilesStore } from '../../../store/files/filesStore';

const menuService = new MenuService();

export function useTreeMenu() {
  const currentFilePath = useStore((state) => state.currentFilePath);
  const createNewFile = useFilesStore((state) => state.actions.createNewFile);
  const openFileWithDialog = useFilesStore((state) => state.actions.openFileWithDialog);
  const saveActiveFile = useFilesStore((state) => state.actions.saveActiveFile);
  const saveFileAs = useFilesStore((state) => state.actions.saveFileAs);

  useEffect(() => {
    const handleNew = () => createNewFile();
    const handleLoad = () => openFileWithDialog();
    const handleSave = () => saveActiveFile();
    const handleSaveAs = () => currentFilePath && saveFileAs(currentFilePath);

    menuService.onMenuNew(handleNew);
    menuService.onMenuOpen(handleLoad);
    menuService.onMenuSave(handleSave);
    menuService.onMenuSaveAs(handleSaveAs);
  }, [currentFilePath, createNewFile, openFileWithDialog, saveActiveFile, saveFileAs]);
}
