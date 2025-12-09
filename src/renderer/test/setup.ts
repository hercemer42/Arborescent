import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('zustand');

// Pre-import stores once at module load time (cached by Node)
let terminalStore: { setState?: (state: unknown) => void } | null = null;
let toastStore: { setState?: (state: unknown) => void } | null = null;
let panelStore: { setState?: (state: unknown) => void } | null = null;
let browserStore: { setState?: (state: unknown) => void } | null = null;

// Lazy load stores once on first use
function getStores() {
  if (terminalStore === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      terminalStore = require('../store/terminal/terminalStore').useTerminalStore;
    } catch { terminalStore = undefined as unknown as null; }
  }
  if (toastStore === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      toastStore = require('../store/toast/toastStore').useToastStore;
    } catch { toastStore = undefined as unknown as null; }
  }
  if (panelStore === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      panelStore = require('../store/panel/panelStore').usePanelStore;
    } catch { panelStore = undefined as unknown as null; }
  }
  if (browserStore === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      browserStore = require('../store/browser/browserStore').useBrowserStore;
    } catch { browserStore = undefined as unknown as null; }
  }
}

function resetStores() {
  getStores();
  terminalStore?.setState?.({ terminals: [], activeTerminalId: null });
  toastStore?.setState?.({ toasts: [] });
  panelStore?.setState?.({ isOpen: false, activeContent: null });
  browserStore?.setState?.({ tabs: [], activeTabId: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStores();
});

afterEach(() => {
  vi.clearAllTimers();
  resetStores();
});

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

global.window.electron = {
  platform: 'linux',
  openExternal: vi.fn(),
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
  startFeedbackFileWatcher: vi.fn(),
  stopFeedbackFileWatcher: vi.fn(),
  getFeedbackFilePath: vi.fn(),
  onFeedbackFileContentDetected: vi.fn().mockReturnValue(vi.fn()),
  setMenuNewHandler: vi.fn(),
  setMenuOpenHandler: vi.fn(),
  setMenuSaveHandler: vi.fn(),
  setMenuSaveAsHandler: vi.fn(),
  setMainErrorHandler: vi.fn(),
  savePreferences: vi.fn(),
  getPreferences: vi.fn().mockResolvedValue(null),
  terminalCreate: vi.fn().mockResolvedValue({ id: 'test', title: 'Test', cwd: '/test', shellCommand: 'bash', shellArgs: [] }),
  terminalWrite: vi.fn(),
  terminalResize: vi.fn(),
  terminalDestroy: vi.fn(),
  onTerminalData: vi.fn().mockReturnValue(vi.fn()),
  onTerminalExit: vi.fn().mockReturnValue(vi.fn()),
};
