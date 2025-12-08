import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getActiveContextIdWithInheritance, getAppliedContextIdWithInheritance, ContextActionType } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';
import { useToastStore } from '../../../store/toast/toastStore';

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

/**
 * Get the explicit context ID for a given action type (not inherited).
 * Only checks the node itself, not ancestors.
 */
function getExplicitContextId(
  node: TreeNode,
  actionType?: ContextActionType
): string | undefined {
  if (actionType === 'execute') {
    return node.metadata.activeExecuteContextId as string | undefined;
  }
  if (actionType === 'collaborate') {
    return node.metadata.activeCollaborateContextId as string | undefined;
  }
  return node.metadata.activeContextId as string | undefined;
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

interface ContextSelectionItemParams {
  context: ContextDeclarationInfo;
  isActive: boolean;
  isInheritedDefault: boolean;
  nodeId: string;
  onSetActiveContext: (nodeId: string, contextId: string | null, actionType?: ContextActionType) => void;
  actionType?: ContextActionType;
}

function createContextSelectionItem({
  context,
  isActive,
  isInheritedDefault,
  nodeId,
  onSetActiveContext,
  actionType,
}: ContextSelectionItemParams): ContextMenuItem {
  let contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;

  // Add "(default)" suffix for inherited default context
  if (isInheritedDefault) {
    contextName += ' (default)';
  }

  const Icon = getIconByName(context.icon);

  // Inherited default when selected: greyed out style
  const isInheritedAndSelected = isInheritedDefault && isActive;

  return {
    label: contextName,
    icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
    radioSelected: isActive,
    keepOpenOnClick: true,
    // Grey out style for inherited selected context
    disabled: isInheritedAndSelected,
    onClick: () => {
      if (isInheritedDefault && isActive) {
        // Can't uncheck inherited default - show message
        useToastStore.getState().addToast("Can't uncheck an inherited context", 'info');
        return;
      }

      if (isActive) {
        // Explicit selection: toggle off (clear override, falls back to default)
        onSetActiveContext(nodeId, null, actionType);
      } else {
        // Select this context (sets explicit override)
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
  // Get active context considering full inheritance (explicit + applied fallback)
  const activeContextId = getActiveContextIdWithInheritance(node.id, nodes, ancestorRegistry, actionType);

  // Get explicit context on this node (not inherited)
  const explicitContextId = getExplicitContextId(node, actionType);

  // Get inherited applied context (the default)
  const inheritedAppliedContextId = getAppliedContextIdWithInheritance(node.id, nodes, ancestorRegistry);

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

  const selectionItems = availableContexts.map((context) => {
    const isActive = context.nodeId === activeContextId;
    // This context is the inherited default if:
    // 1. It matches the inherited applied context
    // 2. AND there's no explicit selection on this node
    const isInheritedDefault =
      context.nodeId === inheritedAppliedContextId && !explicitContextId;

    return createContextSelectionItem({
      context,
      isActive,
      isInheritedDefault,
      nodeId: node.id,
      onSetActiveContext,
      actionType,
    });
  });
  contextItems.push(...selectionItems);

  return [...baseActions, ...contextItems];
}
