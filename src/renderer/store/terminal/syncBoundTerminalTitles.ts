import type { TreeNode } from '../../../shared/types';
import { extractTaskTitle } from '../../utils/terminalTabTitle';
import { useTerminalStore } from './terminalStore';

export function syncBoundTerminalTitles(nodeId: string, node: TreeNode | undefined): void {
  if (!node) return;
  const taskTitle = extractTaskTitle(node);
  if (!taskTitle) return;

  const store = useTerminalStore.getState();
  for (const terminal of store.terminals) {
    if (terminal.originNodeId !== nodeId) continue;
    if (terminal.title === taskTitle) continue;
    store.updateTerminal(terminal.id, { title: taskTitle });
  }
}
