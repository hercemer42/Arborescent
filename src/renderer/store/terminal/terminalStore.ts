import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { TerminalSession, TerminalSessionEntry } from '../../../shared/interfaces';
import { exportNodeAsMarkdown } from '../../utils/markdown';
import { executeInTerminal as executeInTerminalUtil } from '../../services/terminalExecution';
import { createTerminal as createTerminalService } from '../../services/terminalService';
import { StorageService } from '../../services/storageService';
import { logger } from '../../services/logger';
import { resolveToSourceFilePath } from '../../utils/zoomPath';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
  pinnedToBottom: boolean;
  originNodeId?: string;
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

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,
  currentFilePath: null,
  fileStates: {},

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
      const terminalInfo = await createTerminalService(title, undefined, undefined, cwd);
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
      logger.info(`Closed terminal: ${id}`, 'TerminalStore');
    } catch (error) {
      logger.error('Failed to close terminal', error as Error, 'TerminalStore');
    }
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
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;

    const fileState = fileStates[currentFilePath];
    if (!fileState?.pendingRestore?.length) return;

    const pending = fileState.pendingRestore;
    const clearedFileStates = updateFileState(fileStates, currentFilePath, {
      pendingRestore: undefined,
    });
    set({ fileStates: clearedFileStates });

    for (const entry of pending) {
      try {
        const terminalInfo = await createTerminalService(entry.title, undefined, undefined, entry.cwd);
        const restored = entry.originNodeId
          ? { ...terminalInfo, originNodeId: entry.originNodeId }
          : terminalInfo;
        get().addTerminal(restored);
      } catch (error) {
        logger.error('Failed to restore terminal', error as Error, 'TerminalStore');
      }
    }
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
    const { currentFilePath } = get();
    const currentState = currentFilePath === filePath
      ? { terminals: [], activeTerminalId: null }
      : {};
    set({ fileStates: updated, ...currentState });
    void saveTerminalSession(updated);
  },
}));
