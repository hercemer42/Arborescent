import { Menu } from 'electron';

/**
 * Removes the default Electron application menu.
 * All menu operations are now handled by the renderer's MenuBar component.
 */
export function createApplicationMenu() {
  Menu.setApplicationMenu(null);
}
