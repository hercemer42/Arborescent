import { TreeNode } from '../../../../shared/types';
import { useTerminalStore } from '../../../store/terminal/terminalStore';

export function useTerminalActions() {
  const sendNodeToTerminal = useTerminalStore((state) => state.sendNodeToTerminal);
  const executeNodeInTerminal = useTerminalStore((state) => state.executeNodeInTerminal);

  return {
    sendToTerminal: (node: TreeNode, nodes: Record<string, TreeNode>) => sendNodeToTerminal(node, nodes),
    executeInTerminal: (node: TreeNode, nodes: Record<string, TreeNode>) => executeNodeInTerminal(node, nodes),
  };
}
