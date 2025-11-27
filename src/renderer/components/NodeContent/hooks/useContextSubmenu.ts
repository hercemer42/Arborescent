import { useMemo, useCallback, createElement } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useStore } from '../../../store/tree/useStore';
import { useIconPickerStore } from '../../../store/iconPicker/iconPickerStore';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getIconByName } from '../../ui/IconPicker/IconPicker';

export function useContextSubmenu(node: TreeNode) {
  const nodes = useStore((state) => state.nodes);
  const contextDeclarations = useStore((state) => state.contextDeclarations);
  const declareAsContext = useStore((state) => state.actions.declareAsContext);
  const removeContextDeclaration = useStore((state) => state.actions.removeContextDeclaration);
  const applyContext = useStore((state) => state.actions.applyContext);
  const removeAppliedContext = useStore((state) => state.actions.removeAppliedContext);
  const openIconPicker = useIconPickerStore((state) => state.open);

  const isContextDeclaration = node.metadata.isContextDeclaration === true;
  const hasAppliedContext = !!node.metadata.appliedContextId;

  const handleDeclareAsContext = useCallback(() => {
    openIconPicker(null, (iconName) => {
      declareAsContext(node.id, iconName);
    });
  }, [openIconPicker, declareAsContext, node.id]);

  const handleRemoveContextDeclaration = useCallback(() => {
    // Check how many nodes have this context applied
    const affectedNodes = Object.values(nodes).filter(
      n => n.metadata.appliedContextId === node.id
    );

    if (affectedNodes.length > 0) {
      const confirmed = window.confirm(
        `This context is applied to ${affectedNodes.length} node${affectedNodes.length === 1 ? '' : 's'}. ` +
        `Removing the declaration will also remove the context from ${affectedNodes.length === 1 ? 'that node' : 'those nodes'}.\n\n` +
        `Continue?`
      );
      if (!confirmed) return;
    }

    removeContextDeclaration(node.id);
  }, [nodes, node.id, removeContextDeclaration]);

  // Build context submenu items (for applying context to a node)
  const contextSubmenuItems: ContextMenuItem[] = useMemo(() => {
    return contextDeclarations
      .filter(ctx => ctx.nodeId !== node.id) // Don't show self
      .map(ctx => {
        const iconDef = getIconByName(ctx.icon);
        return {
          label: ctx.content.length > 30 ? ctx.content.slice(0, 30) + '...' : ctx.content,
          onClick: () => applyContext(node.id, ctx.nodeId),
          icon: iconDef ? createElement(FontAwesomeIcon, { icon: iconDef }) : undefined,
        };
      });
  }, [contextDeclarations, node.id, applyContext]);

  // Context declaration menu items (for declaring a node as context)
  const contextDeclarationMenuItems: ContextMenuItem[] = useMemo(() => {
    return isContextDeclaration
      ? [
          {
            label: 'Remove context declaration',
            onClick: handleRemoveContextDeclaration,
            disabled: false,
          },
        ]
      : [
          {
            label: 'Declare as context',
            onClick: handleDeclareAsContext,
            disabled: false,
          },
        ];
  }, [isContextDeclaration, handleRemoveContextDeclaration, handleDeclareAsContext]);

  // Context application menu item (only show if not a context declaration itself)
  // - If context is applied: show "Remove context" (direct action)
  // - If no context applied: show "Add context" (with submenu)
  const applyContextMenuItem: ContextMenuItem[] = useMemo(() => {
    if (isContextDeclaration) {
      return [];
    }

    if (hasAppliedContext) {
      return [
        {
          label: 'Remove context',
          onClick: () => removeAppliedContext(node.id),
        },
      ];
    }

    return [
      {
        label: 'Add context',
        submenu: contextSubmenuItems,
        disabled: contextDeclarations.length === 0,
      },
    ];
  }, [isContextDeclaration, hasAppliedContext, contextSubmenuItems, contextDeclarations.length, removeAppliedContext, node.id]);

  return {
    contextDeclarationMenuItems,
    applyContextMenuItem,
  };
}
