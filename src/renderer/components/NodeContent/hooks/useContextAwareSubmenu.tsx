import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getInheritedContextId } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';

export interface ContextAwareSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  requiresContext?: boolean;
  onTerminalAction: () => void;
  onBrowserAction: () => void;
  onSetActiveContext: (nodeId: string, contextId: string | null) => void;
}

function getExplicitContextId(node: TreeNode): string | undefined {
  return node.metadata.appliedContextId as string | undefined;
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
    label: 'Apply a context',
    onClick: () => {},
    disabled: true,
  };
}

interface ContextSelectionItemParams {
  context: ContextDeclarationInfo;
  isActive: boolean;
  isInherited: boolean;
  hasExplicitContext: boolean;
  nodeId: string;
  onSetActiveContext: (nodeId: string, contextId: string | null) => void;
}

function createContextSelectionItem({
  context,
  isActive,
  isInherited,
  hasExplicitContext,
  nodeId,
  onSetActiveContext,
}: ContextSelectionItemParams): ContextMenuItem {
  let contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;

  if (isInherited) {
    contextName += ' (inherited)';
  }

  const Icon = getIconByName(context.icon);

  const isInheritedAndNoExplicit = isInherited && !hasExplicitContext;

  return {
    label: contextName,
    icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
    radioSelected: isInheritedAndNoExplicit ? true : (isActive && !isInherited),
    keepOpenOnClick: true,
    disabled: isInheritedAndNoExplicit,
    onClick: () => {
      if (isInheritedAndNoExplicit) {
        return;
      }

      if (isActive && !isInherited) {
        onSetActiveContext(nodeId, null);
      } else if (isInherited) {
        onSetActiveContext(nodeId, null);
      } else {
        onSetActiveContext(nodeId, context.nodeId);
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
  onTerminalAction,
  onBrowserAction,
  onSetActiveContext,
}: ContextAwareSubmenuParams): ContextMenuItem[] {
  const explicitContextId = getExplicitContextId(node);
  const inheritedContextId = getInheritedContextId(node.id, nodes, ancestorRegistry);
  const effectiveContextId = explicitContextId || inheritedContextId;

  const ancestors = ancestorRegistry[node.id] || [];
  const availableContexts = contextDeclarations.filter(
    ctx => ctx.nodeId !== node.id && !ancestors.includes(ctx.nodeId)
  );

  const hasContext = effectiveContextId !== undefined;
  const actionsDisabled = requiresContext && !hasContext;
  const baseActions = createBaseActions(onTerminalAction, onBrowserAction, actionsDisabled);

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
    const isActive = context.nodeId === explicitContextId;
    const isInherited = context.nodeId === inheritedContextId;

    return createContextSelectionItem({
      context,
      isActive,
      isInherited,
      hasExplicitContext: !!explicitContextId,
      nodeId: node.id,
      onSetActiveContext,
    });
  });
  contextItems.push(...selectionItems);

  return [...baseActions, ...contextItems];
}
