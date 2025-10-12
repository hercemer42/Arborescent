import { MenuService } from '../../renderer/services/interfaces';

export class ElectronMenuService implements MenuService {
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
