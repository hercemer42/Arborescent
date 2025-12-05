import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';
import { buildContextAwareSubmenu } from './useContextAwareSubmenu';

interface BuildExecuteSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  hasEffectiveContext: boolean;
  onExecuteInBrowser: () => void;
  onExecuteInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string) => void;
}

export function buildExecuteSubmenu({
  node,
  nodes,
  ancestorRegistry,
  hasEffectiveContext,
  onExecuteInBrowser,
  onExecuteInTerminal,
  onSetActiveContext,
}: BuildExecuteSubmenuParams): ContextMenuItem[] {
  return buildContextAwareSubmenu({
    node,
    nodes,
    ancestorRegistry,
    hasEffectiveContext,
    onTerminalAction: onExecuteInTerminal,
    onBrowserAction: onExecuteInBrowser,
    onSetActiveContext,
  });
}
