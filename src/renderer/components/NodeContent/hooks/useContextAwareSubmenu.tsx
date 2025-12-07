import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getActiveContextIdWithInheritance, ContextActionType } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';

export interface ContextAwareSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  requiresContext?: boolean;
  actionType?: ContextActionType;
  onTerminalAction: () => void;
  onBrowserAction: () => void;
  onSetActiveContext: (nodeId: string, contextId: string | null, actionType?: ContextActionType) => void;
}

const SEPARATOR: ContextMenuItem = { label: '-', onClick: () => {} };

function createBaseActions(
  onTerminalAction: () => void,
  onBrowserAction: () => void,
  disabled: boolean
): ContextMenuItem[] {
  return [
    { label: 'In terminal', onClick: onTerminalAction, disabled },
    { label: 'In browser', onClick: onBrowserAction, disabled },
  ];
}

function createContextHeading(): ContextMenuItem {
  return {
    label: 'Available contexts',
    onClick: () => {},
    disabled: true,
  };
}

function createContextSelectionItem(
  context: ContextDeclarationInfo,
  isActive: boolean,
  nodeId: string,
  onSetActiveContext: (nodeId: string, contextId: string | null, actionType?: ContextActionType) => void,
  actionType?: ContextActionType
): ContextMenuItem {
  const contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;
  const Icon = getIconByName(context.icon);

  return {
    label: contextName,
    icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
    radioSelected: isActive,
    keepOpenOnClick: true,
    onClick: () => {
      // Toggle behavior: click again to clear selection
      if (isActive) {
        onSetActiveContext(nodeId, null, actionType);
      } else {
        onSetActiveContext(nodeId, context.nodeId, actionType);
      }
    },
  };
}

export function buildContextAwareSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  requiresContext = false,
  actionType,
  onTerminalAction,
  onBrowserAction,
  onSetActiveContext,
}: ContextAwareSubmenuParams): ContextMenuItem[] {
  // Get active context considering inheritance from ancestors
  const activeContextId = getActiveContextIdWithInheritance(node.id, nodes, ancestorRegistry, actionType);

  // Filter out contexts that are ancestors of the current node (can't apply ancestor as context)
  const ancestors = ancestorRegistry[node.id] || [];
  const availableContexts = contextDeclarations.filter(
    ctx => ctx.nodeId !== node.id && !ancestors.includes(ctx.nodeId)
  );

  const hasContext = activeContextId !== undefined;
  const actionsDisabled = requiresContext && !hasContext;
  const baseActions = createBaseActions(onTerminalAction, onBrowserAction, actionsDisabled);

  // No available contexts
  if (availableContexts.length === 0) {
    if (requiresContext) {
      return [
        ...baseActions,
        SEPARATOR,
        { label: 'No contexts available', onClick: () => {}, disabled: true },
      ];
    }
    return baseActions;
  }

  const contextItems: ContextMenuItem[] = [
    SEPARATOR,
    createContextHeading(),
  ];

  const selectionItems = availableContexts.map((context) =>
    createContextSelectionItem(
      context,
      context.nodeId === activeContextId,
      node.id,
      onSetActiveContext,
      actionType
    )
  );
  contextItems.push(...selectionItems);

  return [...baseActions, ...contextItems];
}
