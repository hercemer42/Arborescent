/**
 * Platform adapter layer
 *
 * This file exports the current platform implementation.
 * To build for web: import from './web/*'
 * To build for Electron: import from './electron/*'
 */

export { Storage as StorageService } from './electron/services/Storage';
export { Menu as MenuService } from './electron/services/Menu';
export { ErrorHandler as ErrorService } from './electron/services/ErrorHandler';
