/**
 * Single source of truth for the window.electron IPC surface.
 *
 * Both sides of the bridge reference this type:
 *  - src/preload/index.ts attaches the implementation via
 *    `contextBridge.exposeInMainWorld('electron', api satisfies ElectronAPI)`
 *  - src/global.d.ts declares `Window.electron: ElectronAPI`
 *
 * If a method is renamed, added, or has its signature changed in one place
 * but not the other, `tsc --noEmit` fails at the `satisfies` check.
 */

import type { McpErrorCode } from '../utils/mcpErrorCodes';
import type { ActivityLogEntry } from './activityLog';

export interface HookEventPayload {
  session_id: string;
  hook_event_name: string;
  terminal_id?: string;
  message?: string;
  source?: string;
}

export interface RebindRequestEvent {
  sessionId: string;
  previousNodeId: string;
  newNodeId: string;
}

export interface TreeReadRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
}

export interface SerializedTreeReadState {
  nodes: Record<string, unknown>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
}

export type SerializedTreeReadResult =
  | { kind: 'ok'; state: SerializedTreeReadState }
  | { kind: 'no-session-store' }
  | { kind: 'node-not-in-open-store' };

export interface TreeReadResponse {
  requestId: string;
  state: SerializedTreeReadResult;
}

export type MutationRequest =
  | { kind: 'add-child'; parentId: string; content: string; position?: number }
  | { kind: 'append'; content: string }
  | { kind: 'mark-complete'; status: 'completed' | 'abandoned' }
  | { kind: 'set-content'; content: string }
  | { kind: 'delete' }
  | { kind: 'move'; newParentId: string; position?: number }
  | { kind: 'set-metadata'; key: string; value: unknown };

export type MutationResult = { ok: true } | { ok: false; error: string };

export interface TreeMutateRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
  request: MutationRequest;
}

export interface TreeMutateResponse {
  requestId: string;
  result: MutationResult;
}

export interface StepOutputApplyRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
  content: string;
}

export interface StepOutputApplyResponse {
  requestId: string;
  result: { ok: true } | { ok: false; error: string; code?: McpErrorCode };
}

export type ProposalPayload =
  | MutationRequest
  | { kind: 'submit-step-output'; content: string };

export interface ProposalRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
  request: ProposalPayload;
}

export interface ProposalResponse {
  requestId: string;
  result: { ok: true; proposalId: string } | { ok: false; error: string };
}

export interface ContextMenuParams {
  x: number;
  y: number;
  misspelledWord: string | null;
  suggestions: string[];
}

export interface TerminalExitInfo {
  exitCode: number;
  signal?: number;
}

export interface TerminalCreateResult {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

export interface TerminalBufferedOutput {
  data: string;
  endOffset: number;
}

export type Unsubscribe = () => void;

export interface ElectronAPI {
  platform: NodeJS.Platform;

  // Shell / navigation
  openExternal: (url: string) => Promise<void>;

  // File I/O
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;

  // Dialogs
  showOpenDialog: () => Promise<string | null>;
  showSaveDialog: (defaultPath?: string) => Promise<string | null>;
  showUnsavedChangesDialog: (fileName: string) => Promise<number>;
  showRunningWorkflowDialog: (fileName: string) => Promise<boolean>;
  showActiveSessionDialog: (fileName: string) => Promise<boolean>;

  // Session persistence (all JSON-as-string on the wire)
  saveSession: (sessionData: string) => Promise<void>;
  getSession: () => Promise<string | null>;
  saveBrowserSession: (sessionData: string) => Promise<void>;
  getBrowserSession: () => Promise<string | null>;
  savePanelSession: (sessionData: string) => Promise<void>;
  getPanelSession: () => Promise<string | null>;
  saveTerminalSession: (sessionData: string) => Promise<void>;
  getTerminalSession: () => Promise<string | null>;

  // Temp files
  createTempFile: (fileName: string, content: string) => Promise<string>;
  deleteTempFile: (filePath: string) => Promise<void>;
  saveTempFilesMetadata: (metadata: string) => Promise<void>;
  getTempFilesMetadata: () => Promise<string | null>;
  isTempFile: (filePath: string) => Promise<boolean>;

  // Clipboard monitor
  startClipboardMonitor: () => Promise<void>;
  stopClipboardMonitor: () => Promise<void>;
  recordClipboardSelfWrite: (content: string) => Promise<void>;
  onClipboardContentDetected: (callback: (content: string) => void) => Unsubscribe;

  // Menu bridge
  setMenuNewHandler: (callback: () => void) => void;
  setMenuOpenHandler: (callback: () => void) => void;
  setMenuSaveHandler: (callback: () => void) => void;
  setMenuSaveAsHandler: (callback: () => void) => void;
  setMainErrorHandler: (callback: (message: string) => void) => void;

  // Preferences
  savePreferences: (preferencesData: string) => Promise<void>;
  getPreferences: () => Promise<string | null>;

  // Terminal
  terminalCreate: (
    id: string,
    title: string,
    shellCommand?: string,
    shellArgs?: string[],
    cwd?: string,
    nodeUuid?: string
  ) => Promise<TerminalCreateResult>;
  terminalWrite: (id: string, data: string) => Promise<void>;
  terminalResize: (id: string, cols: number, rows: number) => Promise<void>;
  terminalDestroy: (id: string) => Promise<void>;
  terminalGetCwd: (id: string) => Promise<string | null>;
  // Returns a trailing window of the terminal's output already emitted, so a
  // late subscriber (the launch resume) can detect a prompt drawn before it
  // attached. onTerminalData does not replay this.
  getTerminalRecentOutput: (id: string) => Promise<string>;
  // Returns the retained output buffer plus the end offset, so a renderer that
  // attaches after the shell drew its prompt can replay the missed bytes and
  // dedupe the live stream against that offset watermark.
  getTerminalBufferedOutput: (id: string) => Promise<TerminalBufferedOutput>;
  claudeSessionExists: (cwd: string, sessionId: string) => Promise<boolean>;
  onTerminalData: (id: string, callback: (data: string, endOffset?: number) => void) => Unsubscribe;
  onTerminalExit: (id: string, callback: (exitInfo: TerminalExitInfo) => void) => Unsubscribe;

  // Spellcheck context menu
  onContextMenuParams: (callback: (data: ContextMenuParams) => void) => Unsubscribe;
  replaceMisspelling: (suggestion: string) => Promise<void>;

  // Window / app lifecycle
  appQuit: () => Promise<void>;
  onCloseBrowserTab: (callback: () => void) => Unsubscribe;
  showNotification: (title: string, body: string) => Promise<void>;
  isWindowFocused: () => Promise<boolean>;

  // Keep-awake bridge
  startKeepAwake: () => Promise<void>;
  stopKeepAwake: () => Promise<void>;

  // Hook server bridge
  onHookEvent: (callback: (event: HookEventPayload) => void) => Unsubscribe;

  // MCP rebind dialog bridge
  onRebindRequest: (callback: (event: RebindRequestEvent) => void) => Unsubscribe;
  onRebindCancelled: (callback: (sessionId: string) => void) => Unsubscribe;
  respondToRebindRequest: (sessionId: string, confirmed: boolean) => Promise<void>;

  // MCP tree-read bridge (main asks renderer for current tree state)
  onMcpTreeReadRequest: (callback: (request: TreeReadRequest) => void) => Unsubscribe;
  respondToMcpTreeRead: (response: TreeReadResponse) => Promise<void>;
  onMcpTreeMutateRequest: (callback: (request: TreeMutateRequest) => void) => Unsubscribe;
  respondToMcpTreeMutate: (response: TreeMutateResponse) => Promise<void>;
  onMcpStepOutputApplyRequest: (callback: (request: StepOutputApplyRequest) => void) => Unsubscribe;
  respondToMcpStepOutputApply: (response: StepOutputApplyResponse) => Promise<void>;
  onMcpProposalRequest: (callback: (request: ProposalRequest) => void) => Unsubscribe;
  respondToMcpProposal: (response: ProposalResponse) => Promise<void>;

  // Session-to-node binding rehydration from .arbo metadata
  seedSessionBindings: (pairs: ReadonlyArray<{ sessionId: string; nodeId: string }>) => Promise<void>;
  clearSessionBindings: (sessionIds: ReadonlyArray<string>) => Promise<void>;

  notifyManualCollabResolved: (sessionId: string) => Promise<void>;

  // Persistent activity log
  appendLog: (entry: AppendLogPayload) => Promise<void>;
  openLogFile: () => Promise<void>;
  getLogFilePath: () => Promise<string | null>;

  // Persistent workflow activity feed
  appendActivityLog: (entry: ActivityLogEntry) => Promise<void>;
  readRecentActivityLog: () => Promise<ActivityLogEntry[]>;
}

export interface AppendLogPayload {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: string;
  nodeId?: string;
  errorStack?: string;
}
