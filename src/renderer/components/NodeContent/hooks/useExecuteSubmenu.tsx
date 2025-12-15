import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';
import { buildContextAwareSubmenu } from './useContextAwareSubmenu';

interface BuildExecuteSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  onExecuteInBrowser: () => void;
  onExecuteInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string | null) => void;
}

export function buildExecuteSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  onExecuteInBrowser,
  onExecuteInTerminal,
  onSetActiveContext,
}: BuildExecuteSubmenuParams): ContextMenuItem[] {
  return buildContextAwareSubmenu({
    node,
    nodes,
    ancestorRegistry,
    contextDeclarations,
    onTerminalAction: onExecuteInTerminal,
    onBrowserAction: onExecuteInBrowser,
    onSetActiveContext,
  });
}
