import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';
import { buildContextAwareSubmenu } from './useContextAwareSubmenu';

interface BuildCollaborateSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  onCollaborate: () => void;
  onCollaborateInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string | null) => void;
}

export function buildCollaborateSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  onCollaborate,
  onCollaborateInTerminal,
  onSetActiveContext,
}: BuildCollaborateSubmenuParams): ContextMenuItem[] {
  return buildContextAwareSubmenu({
    node,
    nodes,
    ancestorRegistry,
    contextDeclarations,
    requiresContext: true,
    onTerminalAction: onCollaborateInTerminal,
    onBrowserAction: onCollaborate,
    onSetActiveContext,
  });
}
