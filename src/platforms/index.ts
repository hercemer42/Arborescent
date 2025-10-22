/**
 * Platform adapter layer
 *
 * This file exports the current platform implementation.
 * To build for web: import from './web/*'
 * To build for Electron: import from './electron/*'
 */

export { ElectronStorageService as StorageService } from './electron/storage';
export { ElectronMenuService as MenuService } from './electron/menu';
export { ElectronErrorService as ErrorService } from './electron/error';
