import { MenuService } from '../../shared/interfaces';

export class ElectronMenuService implements MenuService {
  onMenuNew(callback: () => void): void {
    window.electron.setMenuNewHandler(callback);
  }

  onMenuOpen(callback: () => void): void {
    window.electron.setMenuOpenHandler(callback);
  }

  onMenuSave(callback: () => void): void {
    window.electron.setMenuSaveHandler(callback);
  }

  onMenuSaveAs(callback: () => void): void {
    window.electron.setMenuSaveAsHandler(callback);
  }
}
