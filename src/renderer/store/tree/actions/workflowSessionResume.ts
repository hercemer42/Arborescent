import type { TreeNode } from '../../../../shared/types';
import { useTerminalStore } from '../../terminal/terminalStore';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';
import { focusTerminal } from '../../../services/terminalFocusRegistry';
import { waitForShellPrompt } from '../../../services/shellPromptReadiness';
import { getSessionLiveness } from '../../../utils/sessionLiveness';
import { extractTaskTitle } from '../../../utils/terminalTabTitle';
import { bindSessionInNodes } from './bindSessionToNode';

interface SessionResumeState {
  nodes: Record<string, TreeNode>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
}

export interface SessionResumeManager {
  resumeSession: (nodeId: string) => Promise<void>;
  resumeRestoredTerminal: (terminalId: string, sessionId: string) => Promise<void>;
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
  const cleared = bindSessionInNodes(nodes, sessionId, nodeId);
  const target = cleared[nodeId];
  if (!target) return nodes;
  if (target.metadata.brokenChain !== true) return cleared;
  const nextMetadata = { ...target.metadata };
  delete nextMetadata.brokenChain;
  return { ...cleared, [nodeId]: { ...target, metadata: nextMetadata } };
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

  const cleared = bindSessionInNodes(nodes, sessionId, nodeId);
  const target = cleared[nodeId];
  if (!target) return nodes;
  if (target.metadata.brokenChain !== true) return cleared;
  const nextMetadata = { ...target.metadata };
  delete nextMetadata.brokenChain;
  return { ...cleared, [nodeId]: { ...target, metadata: nextMetadata } };
}

export function shortSessionId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

export function resumeTabTitle(node: TreeNode | undefined, sessionId?: string): string {
  const taskTitle = node ? extractTaskTitle(node) : '';
  const base = taskTitle || `Terminal ${useTerminalStore.getState().terminals.length + 1}`;
  return sessionId ? `${base} · ${shortSessionId(sessionId)}` : base;
}

export async function checkClaudeSessionExists(cwd: string, sessionId: string): Promise<boolean | null> {
  const probe = window.electron.claudeSessionExists;
  if (typeof probe !== 'function') return null;
  try {
    return await probe(cwd, sessionId);
  } catch (error) {
    logger.warn(`claudeSessionExists failed: ${(error as Error).message}`, 'WorkflowExecution');
    return null;
  }
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
      focusTerminal(mappedTerminalId);
      bindSessionTab(mappedTerminalId, sessionId);
      return;
    }

    const cwd = sessionRegistry[sessionId]?.cwd;
    if (!cwd) {
      useToastStore.getState().addToast('Session has no recorded working directory', 'error');
      return;
    }

    const sessionExists = await checkClaudeSessionExists(cwd, sessionId);
    if (sessionExists === false) {
      useToastStore.getState().addToast(
        `Session ${shortSessionId(sessionId)} no longer exists on disk`,
        'error',
      );
      return;
    }

    try {
      const title = resumeTabTitle(node, sessionId);
      const created = await useTerminalStore.getState().createNewTerminal(title, cwd, nodeId);
      if (!created) throw new Error('Resume terminal was not created');

      // A resume command written into a shell that hasn't drawn its prompt is
      // eaten or mangled; on timeout leave the usable plain shell untouched
      // rather than write blindly.
      const promptReady = await waitForShellPrompt(created.id);
      if (!promptReady) {
        logger.warn(`Shell prompt not ready for resume terminal ${created.id}; left a plain shell`, 'WorkflowExecution');
        focusTerminal(created.id);
        return;
      }

      await window.electron.terminalWrite(created.id, `claude --resume ${sessionId}\r`);
      bindSessionTab(created.id, sessionId);
      focusTerminal(created.id);
    } catch (error) {
      logger.error('Failed to resume session', error as Error, 'WorkflowExecution');
      useToastStore.getState().addToast('Failed to resume session — terminal could not be opened', 'error');
    }
  }

  // Launch-time resume into an already-materialized terminal. Reuses the manual
  // path's primitives (on-disk probe + shell-prompt gate + binding) but stays
  // quiet: a missing session, missing cwd, or unready prompt leaves the plain
  // shell untouched with no toast, so restoring many files cannot raise an
  // error storm.
  async function resumeRestoredTerminal(terminalId: string, sessionId: string): Promise<void> {
    if (!terminalId || !sessionId) return;

    const cwd = get().sessionRegistry[sessionId]?.cwd;
    if (!cwd) return;

    const sessionExists = await checkClaudeSessionExists(cwd, sessionId);
    if (sessionExists === false) return;

    const promptReady = await waitForShellPrompt(terminalId);
    if (!promptReady) {
      logger.warn(`Shell prompt not ready for restored terminal ${terminalId}; left a plain shell`, 'WorkflowExecution');
      return;
    }

    try {
      await window.electron.terminalWrite(terminalId, `claude --resume ${sessionId}\r`);
      bindSessionTab(terminalId, sessionId);
    } catch (error) {
      logger.error('Failed to resume restored session', error as Error, 'WorkflowExecution');
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

  return { resumeSession, resumeRestoredTerminal, bindSessionTab };
}
