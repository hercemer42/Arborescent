import { MenuService } from '../../shared/interfaces';

export class ElectronMenuService implements MenuService {
  onMenuNew(callback: () => void): void {
    window.electron.onMenuNew(callback);
  }

  onMenuOpen(callback: () => void): void {
    window.electron.onMenuOpen(callback);
  }

  onMenuSave(callback: () => void): void {
    window.electron.onMenuSave(callback);
  }

  onMenuSaveAs(callback: () => void): void {
    window.electron.onMenuSaveAs(callback);
  }
}
