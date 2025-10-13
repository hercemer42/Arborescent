import { useEffect } from 'react';
import { ElectronMenuService } from '@platform/menu';

const menuService = new ElectronMenuService();

interface UseTreeMenuProps {
  handleLoad: () => void;
  handleSave: () => void;
  handleSaveAs: () => void;
}

export function useTreeMenu({
  handleLoad,
  handleSave,
  handleSaveAs,
}: UseTreeMenuProps) {
  useEffect(() => {
    menuService.onMenuOpen(handleLoad);
    menuService.onMenuSave(handleSave);
    menuService.onMenuSaveAs(handleSaveAs);
  }, [handleLoad, handleSave, handleSaveAs]);
}
