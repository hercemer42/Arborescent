import type { TreeNode } from '../../../../shared/types';
import { useTerminalStore } from '../../terminal/terminalStore';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';
import { getSessionLiveness } from '../../../utils/sessionLiveness';

interface SessionResumeState {
  nodes: Record<string, TreeNode>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
}

export interface SessionResumeManager {
  resumeSession: (nodeId: string) => Promise<void>;
  bindSessionTab: (terminalId: string, sessionId: string) => void;
}

export interface SessionResumeDeps {
  get: () => SessionResumeState;
  set: (partial: {
    nodes?: Record<string, TreeNode>;
    workflowSessionMap?: Record<string, string>;
  }) => void;
}

export function clearBrokenChainOnNode(
  nodes: Record<string, TreeNode>,
  nodeId: string,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  if (node.metadata.brokenChain !== true) return nodes;
  const nextMetadata = { ...node.metadata };
  delete nextMetadata.brokenChain;
  return { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } };
}

export function inheritSessionOnNode(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  sessionId: string,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  const nextMetadata = { ...node.metadata, sessionId };
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
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  if (node.metadata.sessionId === sessionId && node.metadata.brokenChain !== true) return nodes;

  const nextMetadata = { ...node.metadata, sessionId };
  delete nextMetadata.brokenChain;
  return { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } };
}

export function createSessionResumeManager(deps: SessionResumeDeps): SessionResumeManager {
  const { get, set } = deps;

  async function resumeSession(nodeId: string): Promise<void> {
    const { nodes, workflowSessionMap, sessionRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const sessionId = node.metadata.sessionId;
    if (!sessionId) {
      useToastStore.getState().addToast('Session is no longer available', 'warning');
      return;
    }

    const liveness = getSessionLiveness(node, workflowSessionMap);

    if (liveness === 'alive-attached') {
      const mappedTerminalId = workflowSessionMap[sessionId];
      useTerminalStore.getState().setActiveTerminal(mappedTerminalId);
      bindSessionTab(mappedTerminalId, sessionId);
      return;
    }

    const cwd = sessionRegistry[sessionId]?.cwd;
    if (!cwd) {
      useToastStore.getState().addToast('Session has no recorded working directory', 'error');
      return;
    }

    try {
      const created = await useTerminalStore.getState().createNewTerminal('Resume', cwd, nodeId);
      if (!created) throw new Error('Resume terminal was not created');
      await window.electron.terminalWrite(created.id, `claude --resume ${sessionId}\r`);
      bindSessionTab(created.id, sessionId);
    } catch (error) {
      logger.error('Failed to resume session', error as Error, 'WorkflowExecution');
      useToastStore.getState().addToast('Failed to resume session — terminal could not be opened', 'error');
    }
  }

  function bindSessionTab(terminalId: string, sessionId: string): void {
    if (!terminalId || !sessionId) return;
    const { workflowSessionMap } = get();

    const updatedMap = { ...workflowSessionMap };
    for (const [existingSession, existingTerminal] of Object.entries(updatedMap)) {
      if (existingTerminal === terminalId) delete updatedMap[existingSession];
    }
    updatedMap[sessionId] = terminalId;

    set({ workflowSessionMap: updatedMap });
  }

  return { resumeSession, bindSessionTab };
}
