import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';
import { buildContextAwareSubmenu } from './useContextAwareSubmenu';

interface BuildCollaborateSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  hasEffectiveContext: boolean;
  onCollaborate: () => void;
  onCollaborateInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string) => void;
}

export function buildCollaborateSubmenu({
  node,
  nodes,
  ancestorRegistry,
  hasEffectiveContext,
  onCollaborate,
  onCollaborateInTerminal,
  onSetActiveContext,
}: BuildCollaborateSubmenuParams): ContextMenuItem[] {
  return buildContextAwareSubmenu({
    node,
    nodes,
    ancestorRegistry,
    hasEffectiveContext,
    onTerminalAction: onCollaborateInTerminal,
    onBrowserAction: onCollaborate,
    onSetActiveContext,
  });
}
