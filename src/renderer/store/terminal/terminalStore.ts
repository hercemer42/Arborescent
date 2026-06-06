import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { TerminalSession, TerminalSessionEntry } from '../../../shared/interfaces';
import { exportNodeAsMarkdown } from '../../utils/markdown';
import { executeInTerminal as executeInTerminalUtil } from '../../services/terminalExecution';
import { createTerminal as createTerminalService } from '../../services/terminalService';
import { StorageService } from '../../services/storageService';
import { logger } from '../../services/logger';
import { resolveToSourceFilePath } from '../../utils/zoomPath';
import { extractTaskTitle } from '../../utils/terminalTabTitle';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
  pinnedToBottom: boolean;
  originNodeId?: string;
  // The Claude session this terminal was restored to carry. initializeExecutionState
  // wipes the live workflowSessionMap on load, so until a session re-binds this run
  // the resolver can't see it; this preserves the persisted sessionId across the
  // post-materialize save instead of erasing it. A live binding always takes
  // precedence (see buildTerminalSession).
  restoredSessionId?: string;
}

interface FileTerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  pendingRestore?: TerminalSessionEntry[];
}

interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  currentFilePath: string | null;
  fileStates: Record<string, FileTerminalState>;
  terminalProcessing: Record<string, boolean>;

  setActiveFile: (filePath: string | null) => void;
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  togglePinnedToBottom: (id: string) => void;
  openTerminal: (originNodeId?: string) => Promise<string | null>;
  sendNodeToTerminal: (node: TreeNode, nodes: Record<string, TreeNode>) => Promise<void>;
  executeNodeInTerminal: (node: TreeNode, nodes: Record<string, TreeNode>) => Promise<void>;
  createNewTerminal: (title?: string, cwd?: string, originNodeId?: string) => Promise<TerminalInfo | null>;
  closeTerminal: (id: string) => Promise<void>;
  closeFileTerminals: (filePath: string) => Promise<void>;
  restoreTerminalSession: () => Promise<void>;
  materializeRestoredTerminals: () => Promise<void>;
  materializeAllRestoredTerminals: () => Promise<LaunchResumeTarget[]>;
  markTerminalProcessing: (id: string, isProcessing: boolean) => void;
  isTerminalProcessing: (id: string) => boolean;
}

function getFileState(fileStates: Record<string, FileTerminalState>, filePath: string | null): FileTerminalState {
  if (!filePath) return { terminals: [], activeTerminalId: null };
  return fileStates[filePath] || { terminals: [], activeTerminalId: null };
}

function updateFileState(
  fileStates: Record<string, FileTerminalState>,
  filePath: string | null,
  update: Partial<FileTerminalState>,
): Record<string, FileTerminalState> {
  if (!filePath) return fileStates;
  const current = fileStates[filePath] || { terminals: [], activeTerminalId: null };
  return { ...fileStates, [filePath]: { ...current, ...update } };
}

const storage = new StorageService();

const MAX_RESTORED_TERMINALS_PER_FILE = 5;

export interface LaunchResumeTarget {
  filePath: string;
  terminalId: string;
  sessionId: string;
}

type TerminalGet = () => TerminalState;
type TerminalSet = (
  partial: Partial<TerminalState> | ((state: TerminalState) => Partial<TerminalState>),
) => void;

// Injected by storeManager so buildTerminalSession can persist each terminal's
// Claude sessionId without the terminal store importing the per-file tree store
// (which would close an import cycle).
let resolveTerminalSessionId: (filePath: string, terminalId: string) => string | undefined = () => undefined;

export function setTerminalSessionResolver(
  resolver: (filePath: string, terminalId: string) => string | undefined,
): void {
  resolveTerminalSessionId = resolver;
}

async function refreshLiveCwd(terminal: TerminalInfo): Promise<string> {
  try {
    const liveCwd = await window.electron.terminalGetCwd(terminal.id);
    return liveCwd ?? terminal.cwd;
  } catch {
    return terminal.cwd;
  }
}

async function buildTerminalSession(
  fileStates: Record<string, FileTerminalState>,
): Promise<TerminalSession> {
  const sessionFileStates: TerminalSession['fileStates'] = {};
  for (const [filePath, state] of Object.entries(fileStates)) {
    if (state.terminals.length === 0 && !state.pendingRestore?.length) continue;
    const terminals: TerminalSessionEntry[] = await Promise.all(
      state.terminals.map(async (t) => {
        const entry: TerminalSessionEntry = {
          title: t.title,
          cwd: await refreshLiveCwd(t),
        };
        if (t.originNodeId) entry.originNodeId = t.originNodeId;
        // Prefer the live binding; fall back to the sessionId this terminal was
        // restored with so a wiped workflowSessionMap (post-load, pre-rebind)
        // can't silently erase a resumable session from the persisted record.
        const sessionId = resolveTerminalSessionId(filePath, t.id) ?? t.restoredSessionId;
        if (sessionId) entry.sessionId = sessionId;
        return entry;
      }),
    );
    const activeIndex = state.activeTerminalId
      ? state.terminals.findIndex((t) => t.id === state.activeTerminalId)
      : -1;
    sessionFileStates[filePath] = {
      terminals,
      activeTerminalIndex: activeIndex >= 0 ? activeIndex : null,
    };
  }
  return { fileStates: sessionFileStates };
}

async function saveTerminalSession(fileStates: Record<string, FileTerminalState>): Promise<void> {
  try {
    const session = await buildTerminalSession(fileStates);
    await storage.saveTerminalSession(session);
  } catch (error) {
    logger.error('Failed to save terminal session', error as Error, 'TerminalStore');
  }
}

async function materializeFileTerminals(
  get: TerminalGet,
  set: TerminalSet,
  targetFilePath: string,
): Promise<LaunchResumeTarget[]> {
  const fileState = get().fileStates[targetFilePath];
  if (!fileState?.pendingRestore?.length) return [];

  const pending = fileState.pendingRestore;
  set({ fileStates: updateFileState(get().fileStates, targetFilePath, { pendingRestore: undefined }) });

  const allocateTerminalNumber = createTerminalNumberAllocator([
    ...fileState.terminals.map((t) => t.title),
    ...pending.map((entry) => entry.title),
  ]);

  const restored: TerminalInfo[] = [];
  const resumeTargets: LaunchResumeTarget[] = [];
  for (const entry of pending) {
    const restoredTitle = entry.title === 'Resume'
      ? `Terminal ${allocateTerminalNumber()}`
      : entry.title;
    try {
      // The saved originNodeId flows into ARBORESCENT_NODE_UUID in the restored shell so the
      // SessionStart hook can bind whatever conversation lands in this tab back to its
      // original node. If a different session ends up here, the rebind dialog will surface.
      const terminalInfo = await createTerminalService(restoredTitle, undefined, undefined, entry.cwd, entry.originNodeId);
      let info = entry.originNodeId ? { ...terminalInfo, originNodeId: entry.originNodeId } : terminalInfo;
      if (entry.sessionId) {
        // Carry the session forward as both a resume target (acted on now) and a
        // durable record on the terminal (survives the workflowSessionMap wipe so
        // the next save re-persists it even if resume hasn't re-bound yet).
        info = { ...info, restoredSessionId: entry.sessionId };
        resumeTargets.push({ filePath: targetFilePath, terminalId: info.id, sessionId: entry.sessionId });
      }
      restored.push(info);
    } catch {
      // The persisted folder may no longer exist, so the spawn fails. Fall back to a
      // plain shell in the default cwd so the tab still restores quietly — no resume,
      // no error toast — rather than spawning in the wrong place or vanishing.
      try {
        const fallback = await createTerminalService(restoredTitle, undefined, undefined, undefined, entry.originNodeId);
        restored.push(entry.originNodeId ? { ...fallback, originNodeId: entry.originNodeId } : fallback);
      } catch (error) {
        logger.error('Failed to restore terminal', error as Error, 'TerminalStore');
      }
    }
  }

  if (restored.length === 0) return [];

  const latestFileStates = get().fileStates;
  const targetTerminals = [...getFileState(latestFileStates, targetFilePath).terminals, ...restored];
  const activeTerminalId = restored[restored.length - 1].id;
  const newFileStates = updateFileState(latestFileStates, targetFilePath, {
    terminals: targetTerminals,
    activeTerminalId,
  });

  set({
    fileStates: newFileStates,
    ...(get().currentFilePath === targetFilePath ? { terminals: targetTerminals, activeTerminalId } : {}),
  });
  void saveTerminalSession(newFileStates);
  return resumeTargets;
}

function createTerminalNumberAllocator(existingTitles: string[]): () => number {
  const usedNumbers = new Set<number>();
  for (const title of existingTitles) {
    const match = title.match(/^Terminal (\d+)$/);
    if (match) usedNumbers.add(parseInt(match[1], 10));
  }
  return function allocateTerminalNumber(): number {
    let n = 1;
    while (usedNumbers.has(n)) n++;
    usedNumbers.add(n);
    return n;
  };
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,
  currentFilePath: null,
  fileStates: {},
  terminalProcessing: {},

  setActiveFile: (filePath: string | null) => {
    const resolved = resolveToSourceFilePath(filePath);
    const { fileStates } = get();
    const fileState = getFileState(fileStates, resolved);
    set({
      currentFilePath: resolved,
      terminals: fileState.terminals,
      activeTerminalId: fileState.activeTerminalId,
    });
  },

  addTerminal: (terminal: TerminalInfo) => {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;
    const current = getFileState(fileStates, currentFilePath);
    const newTerminals = [...current.terminals, terminal];
    const newFileStates = updateFileState(fileStates, currentFilePath, {
      terminals: newTerminals,
      activeTerminalId: terminal.id,
    });
    set({
      terminals: newTerminals,
      activeTerminalId: terminal.id,
      fileStates: newFileStates,
    });
    void saveTerminalSession(newFileStates);
  },

  removeTerminal: (id: string) => {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;
    const current = getFileState(fileStates, currentFilePath);
    const newTerminals = current.terminals.filter((t) => t.id !== id);
    const newActiveId = current.activeTerminalId === id
      ? newTerminals[0]?.id || null
      : current.activeTerminalId;
    const newFileStates = updateFileState(fileStates, currentFilePath, {
      terminals: newTerminals,
      activeTerminalId: newActiveId,
    });
    set({
      terminals: newTerminals,
      activeTerminalId: newActiveId,
      fileStates: newFileStates,
    });
    void saveTerminalSession(newFileStates);
  },

  setActiveTerminal: (id: string | null) => {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;
    const newFileStates = updateFileState(fileStates, currentFilePath, { activeTerminalId: id });
    set({ activeTerminalId: id, fileStates: newFileStates });
  },

  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;
    const current = getFileState(fileStates, currentFilePath);
    const newTerminals = current.terminals.map((t) => t.id === id ? { ...t, ...updates } : t);
    const newFileStates = updateFileState(fileStates, currentFilePath, { terminals: newTerminals });
    set({ terminals: newTerminals, fileStates: newFileStates });
  },

  togglePinnedToBottom: (id: string) => {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;
    const current = getFileState(fileStates, currentFilePath);
    const newTerminals = current.terminals.map((t) =>
      t.id === id ? { ...t, pinnedToBottom: !t.pinnedToBottom } : t
    );
    const newFileStates = updateFileState(fileStates, currentFilePath, { terminals: newTerminals });
    set({ terminals: newTerminals, fileStates: newFileStates });
  },

  openTerminal: async (originNodeId?: string) => {
    const { activeTerminalId } = get();
    if (activeTerminalId) return activeTerminalId;

    await get().createNewTerminal(undefined, undefined, originNodeId);
    return get().activeTerminalId;
  },

  sendNodeToTerminal: async (node: TreeNode, nodes: Record<string, TreeNode>) => {
    const terminalId = await get().openTerminal(node.id || undefined);
    if (!terminalId) {
      logger.error('Failed to create terminal', new Error('No terminal available'), 'TerminalStore');
      return;
    }

    const taskTitle = extractTaskTitle(node);
    if (taskTitle) {
      get().updateTerminal(terminalId, { title: taskTitle });
    }

    try {
      const formattedContent = exportNodeAsMarkdown(node, nodes);
      await window.electron.terminalWrite(terminalId, formattedContent + '\n');
      logger.info('Sent content to terminal', 'TerminalStore');
    } catch (error) {
      logger.error('Failed to send to terminal', error as Error, 'TerminalStore');
    }
  },

  executeNodeInTerminal: async (node: TreeNode, nodes: Record<string, TreeNode>) => {
    const terminalId = await get().openTerminal(node.id || undefined);
    if (!terminalId) {
      logger.error('Failed to create terminal', new Error('No terminal available'), 'TerminalStore');
      return;
    }

    const taskTitle = extractTaskTitle(node);
    if (taskTitle) {
      get().updateTerminal(terminalId, { title: taskTitle });
    }

    try {
      const formattedContent = exportNodeAsMarkdown(node, nodes);
      await executeInTerminalUtil(terminalId, formattedContent);
      logger.info('Executed content in terminal', 'TerminalStore');
    } catch (error) {
      logger.error('Failed to execute in terminal', error as Error, 'TerminalStore');
    }
  },

  createNewTerminal: async (title = 'Terminal', cwd, originNodeId) => {
    try {
      const terminalInfo = await createTerminalService(title, undefined, undefined, cwd, originNodeId);
      const enriched = originNodeId ? { ...terminalInfo, originNodeId } : terminalInfo;
      get().addTerminal(enriched);
      logger.info(`Created new terminal: ${enriched.id}`, 'TerminalStore');
      return enriched;
    } catch (error) {
      logger.error('Failed to create terminal', error as Error, 'TerminalStore');
      return null;
    }
  },

  closeTerminal: async (id: string) => {
    try {
      await window.electron.terminalDestroy(id);
      get().removeTerminal(id);
      const processing = get().terminalProcessing;
      if (Object.prototype.hasOwnProperty.call(processing, id)) {
        const next = { ...processing };
        delete next[id];
        set({ terminalProcessing: next });
      }
      logger.info(`Closed terminal: ${id}`, 'TerminalStore');
    } catch (error) {
      logger.error('Failed to close terminal', error as Error, 'TerminalStore');
    }
  },

  markTerminalProcessing: (id: string, isProcessing: boolean) => {
    if (!id || !id.trim()) return;
    const current = get().terminalProcessing;
    const existing = Boolean(current[id]);
    if (existing === isProcessing) return;
    const next = { ...current };
    if (isProcessing) {
      next[id] = true;
    } else {
      delete next[id];
    }
    set({ terminalProcessing: next });
  },

  isTerminalProcessing: (id: string) => {
    if (!id) return false;
    return Boolean(get().terminalProcessing[id]);
  },

  restoreTerminalSession: async () => {
    const session = await storage.getTerminalSession();
    if (!session) {
      logger.info('No terminal session found', 'TerminalStore');
      return;
    }

    const fileStates: Record<string, FileTerminalState> = {};
    for (const [filePath, state] of Object.entries(session.fileStates)) {
      const capped = state.terminals.slice(0, MAX_RESTORED_TERMINALS_PER_FILE);
      fileStates[filePath] = {
        terminals: [],
        activeTerminalId: null,
        pendingRestore: capped,
      };
    }

    set({ fileStates });
    logger.info(`Restored terminal session (${Object.keys(fileStates).length} file(s))`, 'TerminalStore');
  },

  materializeRestoredTerminals: async () => {
    const { currentFilePath } = get();
    if (!currentFilePath) return;
    // The active file can switch while a PTY is still spawning, so bind this pass to the
    // file it started restoring rather than following the live active file.
    await materializeFileTerminals(get, set, currentFilePath);
  },

  materializeAllRestoredTerminals: async () => {
    const pendingFilePaths = Object.keys(get().fileStates).filter(
      (filePath) => get().fileStates[filePath]?.pendingRestore?.length,
    );
    const resumeTargets: LaunchResumeTarget[] = [];
    for (const filePath of pendingFilePaths) {
      resumeTargets.push(...(await materializeFileTerminals(get, set, filePath)));
    }
    return resumeTargets;
  },

  closeFileTerminals: async (filePath: string) => {
    const { fileStates } = get();
    const fileState = getFileState(fileStates, filePath);
    if (fileState.terminals.length === 0) return;

    for (const terminal of fileState.terminals) {
      try {
        await window.electron.terminalDestroy(terminal.id);
        logger.info(`Closed terminal: ${terminal.id}`, 'TerminalStore');
      } catch (error) {
        logger.error('Failed to close terminal', error as Error, 'TerminalStore');
      }
    }

    const updated = { ...fileStates };
    delete updated[filePath];
    const { currentFilePath, terminalProcessing } = get();
    const currentState = currentFilePath === filePath
      ? { terminals: [], activeTerminalId: null }
      : {};
    const nextProcessing = { ...terminalProcessing };
    for (const terminal of fileState.terminals) {
      delete nextProcessing[terminal.id];
    }
    set({ fileStates: updated, terminalProcessing: nextProcessing, ...currentState });
    void saveTerminalSession(updated);
  },
}));
