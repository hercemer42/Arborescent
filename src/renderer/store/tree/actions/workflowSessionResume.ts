import type { TreeNode } from '../../../../shared/types';
import { useTerminalStore } from '../../terminal/terminalStore';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';

interface SessionResumeState {
  nodes: Record<string, TreeNode>;
  workflowSessionMap: Record<string, string>;
}

export interface SessionResumeManager {
  resumeSession: (nodeId: string) => Promise<void>;
  markSessionLost: (nodeId: string) => void;
  refreshSessionCwd: (nodeId: string, terminalId: string) => Promise<void>;
}

export interface SessionResumeDeps {
  get: () => SessionResumeState;
  set: (partial: {
    nodes?: Record<string, TreeNode>;
    workflowSessionMap?: Record<string, string>;
  }) => void;
  triggerAutosave?: () => void;
}

export function lookupTerminalCwd(terminalId: string): string | null {
  const term = useTerminalStore.getState().terminals.find((t) => t.id === terminalId);
  return term?.cwd ?? null;
}

export function markNodeStartingSession(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  terminalId: string,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  if (node.metadata.sessionStarting === true && node.metadata.sessionTabId === terminalId) {
    return nodes;
  }
  const cwd = lookupTerminalCwd(terminalId);
  const updated: TreeNode = {
    ...node,
    metadata: {
      ...node.metadata,
      sessionStarting: true,
      sessionTabId: terminalId,
      ...(cwd ? { sessionWorkingDirectory: cwd } : {}),
    },
  };
  return { ...nodes, [nodeId]: updated };
}

export function captureSessionOnNode(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  sessionId: string,
  terminalId: string,
  liveCwd?: string | null,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  const cwd = liveCwd ?? lookupTerminalCwd(terminalId) ?? node.metadata.sessionWorkingDirectory ?? null;

  const nextMetadata = {
    ...node.metadata,
    sessionId,
    sessionLiveness: 'alive-attached' as const,
    sessionTabId: terminalId,
    ...(cwd ? { sessionWorkingDirectory: cwd } : {}),
  };
  delete nextMetadata.sessionStarting;

  return { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } };
}

export function createSessionResumeManager(deps: SessionResumeDeps): SessionResumeManager {
  const { get, set, triggerAutosave } = deps;

  async function resumeSession(nodeId: string): Promise<void> {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const sessionId = node.metadata.sessionId;
    const liveness = node.metadata.sessionLiveness;
    const cwd = node.metadata.sessionWorkingDirectory;

    if (!sessionId || liveness === 'lost') {
      useToastStore.getState().addToast('Session is no longer available', 'warning');
      markSessionLost(nodeId);
      return;
    }

    const focused = focusExistingSessionTab(node.metadata.sessionTabId);
    if (focused) {
      bindSessionTab(nodeId, focused, sessionId);
      return;
    }

    if (!cwd) {
      useToastStore.getState().addToast('Session has no recorded working directory', 'error');
      return;
    }

    try {
      const newId = await openResumeTerminal(sessionId, cwd);
      bindSessionTab(nodeId, newId, sessionId);
    } catch (error) {
      logger.error('Failed to resume session', error as Error, 'WorkflowExecution');
      useToastStore.getState().addToast('Failed to resume session — terminal could not be opened', 'error');
    }
  }

  function focusExistingSessionTab(tabId: string | undefined): string | null {
    if (!tabId) return null;
    const termStore = useTerminalStore.getState();
    if (!termStore.terminals.find((t) => t.id === tabId)) return null;
    termStore.setActiveTerminal(tabId);
    return tabId;
  }

  async function openResumeTerminal(sessionId: string, cwd: string): Promise<string> {
    const created = await useTerminalStore.getState().createNewTerminal('Resume', cwd);
    if (!created) throw new Error('Resume terminal was not created');
    await window.electron.terminalWrite(created.id, `claude --resume ${sessionId}\r`);
    return created.id;
  }

  function bindSessionTab(nodeId: string, terminalId: string, sessionId: string): void {
    const { nodes, workflowSessionMap } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const updatedMap = { ...workflowSessionMap };
    for (const [existingSession, existingTerminal] of Object.entries(updatedMap)) {
      if (existingTerminal === terminalId) delete updatedMap[existingSession];
    }
    updatedMap[sessionId] = terminalId;

    const updatedNode: TreeNode = {
      ...node,
      metadata: {
        ...node.metadata,
        sessionTabId: terminalId,
        sessionLiveness: 'alive-attached',
      },
    };

    set({
      nodes: { ...nodes, [nodeId]: updatedNode },
      workflowSessionMap: updatedMap,
    });
    triggerAutosave?.();
  }

  async function refreshSessionCwd(nodeId: string, terminalId: string): Promise<void> {
    try {
      const liveCwd = await window.electron.terminalGetCwd(terminalId);
      if (!liveCwd) return;
      const { nodes } = get();
      const node = nodes[nodeId];
      if (!node) return;
      if (node.metadata.sessionWorkingDirectory === liveCwd) return;

      const updatedNode: TreeNode = {
        ...node,
        metadata: { ...node.metadata, sessionWorkingDirectory: liveCwd },
      };
      set({ nodes: { ...nodes, [nodeId]: updatedNode } });
      triggerAutosave?.();
    } catch {
      // Live cwd query is best-effort; the cached spawn-time cwd is the fallback.
    }
  }

  function markSessionLost(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;
    if (node.metadata.sessionLiveness === 'lost') return;

    const nextMetadata = {
      ...node.metadata,
      sessionLiveness: 'lost' as const,
    };
    delete nextMetadata.sessionTabId;

    set({ nodes: { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } } });
    triggerAutosave?.();
  }

  return { resumeSession, markSessionLost, refreshSessionCwd };
}
