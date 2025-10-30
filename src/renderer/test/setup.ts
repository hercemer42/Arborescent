import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('zustand');

vi.mock('../plugins/core', () => ({
  usePlugins: () => ({
    plugins: [],
    enabledPlugins: [],
    loading: false,
  }),
  PluginProvider: ({ children }: { children: React.ReactNode }) => children,
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
  setMenuNewHandler: vi.fn(),
  setMenuOpenHandler: vi.fn(),
  setMenuSaveHandler: vi.fn(),
  setMenuSaveAsHandler: vi.fn(),
  setMainErrorHandler: vi.fn(),
  claudeGetProjectPath: vi.fn().mockResolvedValue('/test/project'),
  claudeListSessions: vi.fn(),
  claudeSendToSession: vi.fn(),
};
