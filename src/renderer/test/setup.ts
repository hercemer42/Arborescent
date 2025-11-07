import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('zustand');

vi.mock('../store/plugins/pluginStore', () => ({
  usePluginStore: vi.fn((selector) => {
    const state = {
      plugins: [],
      enabledPlugins: [],
      registerPlugin: vi.fn(),
      unregisterPlugin: vi.fn(),
      enablePlugin: vi.fn(),
      disablePlugin: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../plugins/core/renderer/Provider', () => ({
  PluginProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../plugins/core/renderer/Registry', () => ({
  PluginRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    initializeAll: vi.fn(),
    disposeAll: vi.fn(),
    getPlugin: vi.fn(),
    getAllPlugins: vi.fn(() => []),
    getEnabledPlugins: vi.fn(() => []),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
  },
}));

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

global.window.electron = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showUnsavedChangesDialog: vi.fn(),
  saveSession: vi.fn(),
  getSession: vi.fn(),
  getTempDir: vi.fn(),
  createTempFile: vi.fn(),
  deleteTempFile: vi.fn(),
  listTempFiles: vi.fn(),
  saveTempFilesMetadata: vi.fn(),
  getTempFilesMetadata: vi.fn(),
  isTempFile: vi.fn(),
  setMenuNewHandler: vi.fn(),
  setMenuOpenHandler: vi.fn(),
  setMenuSaveHandler: vi.fn(),
  setMenuSaveAsHandler: vi.fn(),
  setMainErrorHandler: vi.fn(),
  pluginStart: vi.fn().mockResolvedValue({ success: true }),
  pluginStop: vi.fn().mockResolvedValue({ success: true }),
  pluginRegister: vi.fn().mockResolvedValue({ success: true, manifest: {} }),
  pluginUnregister: vi.fn().mockResolvedValue({ success: true }),
  pluginInitializeAll: vi.fn().mockResolvedValue({ success: true }),
  pluginDisposeAll: vi.fn().mockResolvedValue({ success: true }),
  pluginInvokeExtension: vi.fn().mockResolvedValue({ success: true, result: {} }),
};
