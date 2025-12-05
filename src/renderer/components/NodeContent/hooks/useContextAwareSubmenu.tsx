import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getActiveContextId, getEffectiveContextIds } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';
import { getIconByName } from '../../ui/IconPicker/IconPicker';

export interface ContextAwareSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  hasEffectiveContext: boolean;
  onTerminalAction: () => void;
  onBrowserAction: () => void;
  onSetActiveContext: (nodeId: string, contextId: string) => void;
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
    label: 'Applied contexts',
    onClick: () => {},
    disabled: true,
  };
}

function createContextInfoItem(contextNode: TreeNode | undefined): ContextMenuItem {
  const contextName = contextNode?.content.slice(0, 30) || 'Context';
  const iconName = contextNode?.metadata.contextIcon as string | undefined;
  const Icon = iconName ? getIconByName(iconName) : null;

  return {
    label: contextName,
    icon: Icon ? createElement(Icon, { size: 14 }) : undefined,
    onClick: () => {},
    disabled: true,
  };
}

function createContextSelectionItem(
  contextId: string,
  contextNode: TreeNode | undefined,
  isActive: boolean,
  nodeId: string,
  onSetActiveContext: (nodeId: string, contextId: string) => void
): ContextMenuItem {
  const contextName = contextNode?.content.slice(0, 30) || 'Context';
  const iconName = contextNode?.metadata.contextIcon as string | undefined;
  const Icon = iconName ? getIconByName(iconName) : null;

  return {
    label: contextName,
    icon: Icon ? createElement(Icon, { size: 14 }) : undefined,
    radioSelected: isActive,
    keepOpenOnClick: true,
    onClick: () => {
      if (!isActive) {
        onSetActiveContext(nodeId, contextId);
      }
    },
  };
}

export function buildContextAwareSubmenu({
  node,
  nodes,
  ancestorRegistry,
  hasEffectiveContext,
  onTerminalAction,
  onBrowserAction,
  onSetActiveContext,
}: ContextAwareSubmenuParams): ContextMenuItem[] {
  const effectiveContextIds = getEffectiveContextIds(node.id, nodes, ancestorRegistry);
  const activeContextId = getActiveContextId(node.id, nodes, ancestorRegistry);

  const actionsDisabled = !hasEffectiveContext;
  const baseActions = createBaseActions(onTerminalAction, onBrowserAction, actionsDisabled);

  if (!hasEffectiveContext || effectiveContextIds.length === 0) {
    return baseActions;
  }

  const contextItems: ContextMenuItem[] = [
    SEPARATOR,
    createContextHeading(),
  ];

  if (effectiveContextIds.length === 1) {
    const contextNode = nodes[effectiveContextIds[0]];
    contextItems.push(createContextInfoItem(contextNode));
  } else {
    const selectionItems = effectiveContextIds.map((contextId) =>
      createContextSelectionItem(
        contextId,
        nodes[contextId],
        contextId === activeContextId,
        node.id,
        onSetActiveContext
      )
    );
    contextItems.push(...selectionItems);
  }

  return [...baseActions, ...contextItems];
}
