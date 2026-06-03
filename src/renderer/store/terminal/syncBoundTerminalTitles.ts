import type { TreeNode } from '../../../shared/types';
import { extractTaskTitle } from '../../utils/terminalTabTitle';
import { useTerminalStore, type TerminalInfo } from './terminalStore';

type TerminalStoreState = ReturnType<typeof useTerminalStore.getState>;

export function syncBoundTerminalTitles(nodeId: string, node: TreeNode | undefined): void {
  if (!node) return;
  const taskTitle = extractTaskTitle(node);
  if (!taskTitle) return;

  const store = useTerminalStore.getState();
  for (const terminal of store.terminals) {
    if (terminal.originNodeId !== nodeId) continue;
    retitle(store, terminal, taskTitle);
  }
}

// Post-batch variant for write paths that mutate many nodes at once (e.g. an
// accepted feedback subtree rebuild): re-derives every bound terminal title
// from the settled nodes map, which also covers originNodeId migration.
export function resyncBoundTerminalTitles(nodes: Record<string, TreeNode>): void {
  const store = useTerminalStore.getState();
  for (const terminal of store.terminals) {
    if (!terminal.originNodeId) continue;
    const node = nodes[terminal.originNodeId];
    if (!node) continue;
    const taskTitle = extractTaskTitle(node);
    if (!taskTitle) continue;
    retitle(store, terminal, taskTitle);
  }
}

function retitle(store: TerminalStoreState, terminal: TerminalInfo, taskTitle: string): void {
  if (terminal.title === taskTitle) return;
  store.updateTerminal(terminal.id, { title: taskTitle });
}
