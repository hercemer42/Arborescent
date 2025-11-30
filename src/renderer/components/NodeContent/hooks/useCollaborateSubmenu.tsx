import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getActiveContextId } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';
import { getIconByName } from '../../ui/IconPicker/IconPicker';

interface UseCollaborateSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  hasEffectiveContext: boolean;
  onCollaborate: () => void;
  onCollaborateInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string) => void;
}

const SEPARATOR: ContextMenuItem = { label: '-', onClick: () => {} };

function createBaseActions(
  onCollaborate: () => void,
  onCollaborateInTerminal: () => void
): ContextMenuItem[] {
  return [
    { label: 'In browser', onClick: onCollaborate },
    { label: 'In terminal', onClick: onCollaborateInTerminal },
  ];
}

function createContextInfoItem(
  contextNode: TreeNode | undefined,
  label?: string
): ContextMenuItem {
  const contextName = label || contextNode?.content.slice(0, 30) || 'Context';
  const iconName = contextNode?.metadata.contextIcon as string | undefined;
  const iconDef = iconName ? getIconByName(iconName) : null;

  return {
    label: `Context: ${contextName}`,
    icon: iconDef ? <FontAwesomeIcon icon={iconDef} /> : undefined,
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
  const iconDef = iconName ? getIconByName(iconName) : null;

  return {
    label: contextName,
    icon: iconDef ? <FontAwesomeIcon icon={iconDef} /> : undefined,
    radioSelected: isActive,
    keepOpenOnClick: true,
    onClick: () => {
      if (!isActive) {
        onSetActiveContext(nodeId, contextId);
      }
    },
  };
}

export function useCollaborateSubmenu({
  node,
  nodes,
  ancestorRegistry,
  hasEffectiveContext,
  onCollaborate,
  onCollaborateInTerminal,
  onSetActiveContext,
}: UseCollaborateSubmenuParams): ContextMenuItem[] {
  const appliedContextIds = useMemo(
    () => (node.metadata.appliedContextIds as string[]) || [],
    [node.metadata.appliedContextIds]
  );

  const activeContextId = useMemo(
    () => getActiveContextId(node.id, nodes, ancestorRegistry),
    [node.id, nodes, ancestorRegistry]
  );

  const isInheritingContext = appliedContextIds.length === 0 && hasEffectiveContext;
  const isContextDeclaration = node.metadata.isContextDeclaration === true;

  return useMemo(() => {
    const baseActions = createBaseActions(onCollaborate, onCollaborateInTerminal);

    // Context declarations don't have active context selection
    if (isContextDeclaration) {
      return baseActions;
    }

    // No context applied - just base actions
    if (appliedContextIds.length === 0) {
      // Inheriting context - show as read-only info
      if (isInheritingContext && activeContextId) {
        const inheritedContextNode = nodes[activeContextId];
        return [
          createContextInfoItem(inheritedContextNode),
          SEPARATOR,
          ...baseActions,
        ];
      }
      return baseActions;
    }

    // Single context - show as info (no radio button)
    if (appliedContextIds.length === 1) {
      const contextNode = nodes[appliedContextIds[0]];
      return [
        createContextInfoItem(contextNode),
        SEPARATOR,
        ...baseActions,
      ];
    }

    // Multiple contexts - show selection with radio indicators
    const selectionItems = appliedContextIds.map((contextId) =>
      createContextSelectionItem(
        contextId,
        nodes[contextId],
        contextId === activeContextId,
        node.id,
        onSetActiveContext
      )
    );

    return [...selectionItems, SEPARATOR, ...baseActions];
  }, [
    appliedContextIds,
    activeContextId,
    isContextDeclaration,
    isInheritingContext,
    nodes,
    node.id,
    onCollaborate,
    onCollaborateInTerminal,
    onSetActiveContext,
  ]);
}
