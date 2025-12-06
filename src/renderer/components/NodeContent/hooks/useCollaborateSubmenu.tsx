import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';
import { ContextActionType } from '../../../utils/nodeHelpers';
import { buildContextAwareSubmenu } from './useContextAwareSubmenu';

interface BuildCollaborateSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  hasEffectiveContext: boolean;
  onCollaborate: () => void;
  onCollaborateInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string, actionType?: ContextActionType) => void;
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
    requiresContext: true,
    actionType: 'collaborate',
    onTerminalAction: onCollaborateInTerminal,
    onBrowserAction: onCollaborate,
    onSetActiveContext,
  });
}
