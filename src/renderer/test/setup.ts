import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('zustand');

// Force garbage collection hints after each test
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Clear all timers to prevent memory leaks
  vi.clearAllTimers();

  // Reset Zustand stores to initial state to prevent state leakage between tests
  // Import stores dynamically to avoid circular dependencies
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTerminalStore } = require('../store/terminal/terminalStore');
    useTerminalStore?.setState?.({ terminals: [], activeTerminalId: null });
  } catch { /* Store may not be loaded */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useToastStore } = require('../store/toast/toastStore');
    useToastStore?.setState?.({ toasts: [] });
  } catch { /* Store may not be loaded */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePanelStore } = require('../store/panel/panelStore');
    usePanelStore?.setState?.({ isOpen: false, activeContent: null });
  } catch { /* Store may not be loaded */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useBrowserStore } = require('../store/browser/browserStore');
    useBrowserStore?.setState?.({ tabs: [], activeTabId: null });
  } catch { /* Store may not be loaded */ }
});

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
  platform: 'linux',
  readFile: vi.fn(),
  writeFile: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showUnsavedChangesDialog: vi.fn(),
  saveSession: vi.fn(),
  getSession: vi.fn(),
  saveBrowserSession: vi.fn(),
  getBrowserSession: vi.fn(),
  savePanelSession: vi.fn(),
  getPanelSession: vi.fn(),
  saveReviewSession: vi.fn(),
  getReviewSession: vi.fn().mockResolvedValue(null),
  getTempDir: vi.fn(),
  createTempFile: vi.fn(),
  readTempFile: vi.fn().mockResolvedValue(null),
  deleteTempFile: vi.fn(),
  listTempFiles: vi.fn(),
  saveTempFilesMetadata: vi.fn(),
  getTempFilesMetadata: vi.fn(),
  isTempFile: vi.fn(),
  startClipboardMonitor: vi.fn(),
  stopClipboardMonitor: vi.fn(),
  onClipboardContentDetected: vi.fn().mockReturnValue(vi.fn()),
  startReviewFileWatcher: vi.fn(),
  stopReviewFileWatcher: vi.fn(),
  getReviewFilePath: vi.fn(),
  onReviewFileContentDetected: vi.fn().mockReturnValue(vi.fn()),
  setMenuNewHandler: vi.fn(),
  setMenuOpenHandler: vi.fn(),
  setMenuSaveHandler: vi.fn(),
  setMenuSaveAsHandler: vi.fn(),
  setMainErrorHandler: vi.fn(),
  terminalCreate: vi.fn().mockResolvedValue({ id: 'test', title: 'Test', cwd: '/test', shellCommand: 'bash', shellArgs: [] }),
  terminalWrite: vi.fn(),
  terminalResize: vi.fn(),
  terminalDestroy: vi.fn(),
  onTerminalData: vi.fn().mockReturnValue(vi.fn()),
  onTerminalExit: vi.fn().mockReturnValue(vi.fn()),
  pluginStart: vi.fn().mockResolvedValue({ success: true }),
  pluginStop: vi.fn().mockResolvedValue({ success: true }),
  pluginRegister: vi.fn().mockResolvedValue({ success: true, manifest: {} }),
  pluginUnregister: vi.fn().mockResolvedValue({ success: true }),
  pluginInitializeAll: vi.fn().mockResolvedValue({ success: true }),
  pluginDisposeAll: vi.fn().mockResolvedValue({ success: true }),
  pluginInvokeExtension: vi.fn().mockResolvedValue({ success: true, result: {} }),
};
