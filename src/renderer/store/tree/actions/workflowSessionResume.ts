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
  bindSessionTab: (terminalId: string, sessionId: string) => void;
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
  if (
    node.metadata.sessionStarting === true
    && node.metadata.sessionTabId === terminalId
    && node.metadata.brokenChain !== true
  ) {
    return nodes;
  }
  const cwd = lookupTerminalCwd(terminalId);
  const nextMetadata = {
    ...node.metadata,
    sessionStarting: true,
    sessionTabId: terminalId,
    ...(cwd ? { sessionWorkingDirectory: cwd } : {}),
  };
  delete nextMetadata.brokenChain;
  return { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } };
}

export function rebindNodesForSession(
  nodes: Record<string, TreeNode>,
  sessionId: string,
  terminalId: string,
): Record<string, TreeNode> {
  let updated: Record<string, TreeNode> | null = null;
  for (const [id, node] of Object.entries(nodes)) {
    if (node.metadata.sessionId !== sessionId) continue;
    if (node.metadata.sessionTabId === terminalId && node.metadata.sessionLiveness === 'alive-attached') continue;

    const nextMetadata = {
      ...node.metadata,
      sessionTabId: terminalId,
      sessionLiveness: 'alive-attached' as const,
    };
    if (!updated) updated = { ...nodes };
    updated[id] = { ...node, metadata: nextMetadata };
  }
  return updated ?? nodes;
}

export function inheritSessionOnNode(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  terminalId: string,
  parentSessionId: string,
  parentCwd: string | undefined,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  const nextMetadata = {
    ...node.metadata,
    sessionId: parentSessionId,
    sessionLiveness: 'alive-attached' as const,
    sessionTabId: terminalId,
    ...(parentCwd ? { sessionWorkingDirectory: parentCwd } : {}),
  };
  delete nextMetadata.sessionStarting;
  delete nextMetadata.brokenChain;
  return { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } };
}

export function markBrokenChainOnNode(
  nodes: Record<string, TreeNode>,
  nodeId: string,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  if (node.metadata.brokenChain === true) return nodes;
  return {
    ...nodes,
    [nodeId]: { ...node, metadata: { ...node.metadata, brokenChain: true } },
  };
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
  delete nextMetadata.brokenChain;

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
      bindSessionTab(focused, sessionId);
      return;
    }

    if (!cwd) {
      useToastStore.getState().addToast('Session has no recorded working directory', 'error');
      return;
    }

    try {
      const newId = await openResumeTerminal(sessionId, cwd);
      bindSessionTab(newId, sessionId);
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

  function bindSessionTab(terminalId: string, sessionId: string): void {
    if (!terminalId || !sessionId) return;
    const { nodes, workflowSessionMap } = get();

    const updatedMap = { ...workflowSessionMap };
    for (const [existingSession, existingTerminal] of Object.entries(updatedMap)) {
      if (existingTerminal === terminalId) delete updatedMap[existingSession];
    }
    updatedMap[sessionId] = terminalId;

    const updatedNodes = rebindNodesForSession(nodes, sessionId, terminalId);

    if (updatedNodes === nodes && updatedMap[sessionId] === workflowSessionMap[sessionId]) return;

    set({
      nodes: updatedNodes,
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

  return { resumeSession, markSessionLost, refreshSessionCwd, bindSessionTab };
}
