import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('zustand');

// Pre-import stores once at module load time (cached by Node)
let terminalStore: { setState?: (state: unknown) => void } | null = null;
let toastStore: { setState?: (state: unknown) => void } | null = null;
let panelStore: { setState?: (state: unknown) => void } | null = null;
let browserStore: { setState?: (state: unknown) => void } | null = null;
let stepConfigDialogStore: { setState?: (state: unknown) => void } | null = null;

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
  if (stepConfigDialogStore === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      stepConfigDialogStore = require('../store/stepConfigDialog/stepConfigDialogStore').useStepConfigDialogStore;
    } catch { stepConfigDialogStore = undefined as unknown as null; }
  }
}

function resetStores() {
  getStores();
  terminalStore?.setState?.({ terminals: [], activeTerminalId: null });
  toastStore?.setState?.({ toasts: [] });
  panelStore?.setState?.({ isOpen: false, activeContent: null });
  browserStore?.setState?.({ tabs: [], activeTabId: null });
  stepConfigDialogStore?.setState?.({ isOpen: false, nodeId: null });
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
  showRunningWorkflowDialog: vi.fn(),
  showActiveSessionDialog: vi.fn(),
  saveSession: vi.fn(),
  getSession: vi.fn(),
  saveBrowserSession: vi.fn(),
  getBrowserSession: vi.fn(),
  saveTerminalSession: vi.fn(),
  getTerminalSession: vi.fn(),
  savePanelSession: vi.fn(),
  getPanelSession: vi.fn(),
  createTempFile: vi.fn(),
  deleteTempFile: vi.fn(),
  saveTempFilesMetadata: vi.fn(),
  getTempFilesMetadata: vi.fn(),
  isTempFile: vi.fn(),
  startClipboardMonitor: vi.fn(),
  stopClipboardMonitor: vi.fn(),
  recordClipboardSelfWrite: vi.fn().mockResolvedValue(undefined),
  onClipboardContentDetected: vi.fn().mockReturnValue(vi.fn()),
  setMenuNewHandler: vi.fn(),
  setMenuOpenHandler: vi.fn(),
  setMenuSaveHandler: vi.fn(),
  setMenuSaveAsHandler: vi.fn(),
  setMainErrorHandler: vi.fn(),
  showNotification: vi.fn(),
  isWindowFocused: vi.fn().mockResolvedValue(false),
  savePreferences: vi.fn(),
  getPreferences: vi.fn().mockResolvedValue(null),
  terminalCreate: vi.fn().mockResolvedValue({ id: 'test', title: 'Test', cwd: '/test', shellCommand: 'bash', shellArgs: [] }),
  terminalWrite: vi.fn(),
  terminalResize: vi.fn(),
  terminalDestroy: vi.fn(),
  terminalGetCwd: vi.fn().mockResolvedValue(null),
  getTerminalRecentOutput: vi.fn().mockResolvedValue(''),
  claudeSessionExists: vi.fn().mockResolvedValue(true),
  onTerminalData: vi.fn().mockReturnValue(vi.fn()),
  onTerminalExit: vi.fn().mockReturnValue(vi.fn()),
  onContextMenuParams: vi.fn().mockReturnValue(vi.fn()),
  replaceMisspelling: vi.fn().mockResolvedValue(undefined),
  appQuit: vi.fn().mockResolvedValue(undefined),
  onCloseBrowserTab: vi.fn().mockReturnValue(vi.fn()),
  onHookEvent: vi.fn().mockReturnValue(vi.fn()),
  onRebindRequest: vi.fn().mockReturnValue(vi.fn()),
  onRebindCancelled: vi.fn().mockReturnValue(vi.fn()),
  respondToRebindRequest: vi.fn().mockResolvedValue(undefined),
  onMcpTreeReadRequest: vi.fn().mockReturnValue(vi.fn()),
  respondToMcpTreeRead: vi.fn().mockResolvedValue(undefined),
  onMcpTreeMutateRequest: vi.fn().mockReturnValue(vi.fn()),
  respondToMcpTreeMutate: vi.fn().mockResolvedValue(undefined),
  onMcpStepOutputApplyRequest: vi.fn().mockReturnValue(vi.fn()),
  respondToMcpStepOutputApply: vi.fn().mockResolvedValue(undefined),
  onMcpProposalRequest: vi.fn().mockReturnValue(vi.fn()),
  respondToMcpProposal: vi.fn().mockResolvedValue(undefined),
  seedSessionBindings: vi.fn().mockResolvedValue(undefined),
  clearSessionBindings: vi.fn().mockResolvedValue(undefined),
  notifyManualCollabResolved: vi.fn().mockResolvedValue(undefined),
  startKeepAwake: vi.fn().mockResolvedValue(undefined),
  stopKeepAwake: vi.fn().mockResolvedValue(undefined),
  appendLog: vi.fn().mockResolvedValue(undefined),
  openLogFile: vi.fn().mockResolvedValue(undefined),
  getLogFilePath: vi.fn().mockResolvedValue(null),
};
