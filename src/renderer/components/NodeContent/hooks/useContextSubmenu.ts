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
  const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];
  const hasAppliedContext = appliedContextIds.length > 0;

  const handleDeclareAsContext = useCallback(() => {
    openIconPicker(null, (iconName) => {
      declareAsContext(node.id, iconName);
    });
  }, [openIconPicker, declareAsContext, node.id]);

  const handleRemoveContextDeclaration = useCallback(() => {
    // Check how many nodes have this context applied
    const affectedNodes = Object.values(nodes).filter(
      n => {
        const ids = (n.metadata.appliedContextIds as string[]) || [];
        return ids.includes(node.id);
      }
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

  // Build context selection submenu items (for applying context to a node)
  const contextSelectionItems: ContextMenuItem[] = useMemo(() => {
    return contextDeclarations
      .filter(ctx => ctx.nodeId !== node.id) // Don't show self
      .filter(ctx => !appliedContextIds.includes(ctx.nodeId)) // Don't show already applied
      .map(ctx => {
        const iconDef = getIconByName(ctx.icon);
        return {
          label: ctx.content.length > 30 ? ctx.content.slice(0, 30) + '...' : ctx.content,
          onClick: () => applyContext(node.id, ctx.nodeId),
          icon: iconDef ? createElement(FontAwesomeIcon, { icon: iconDef }) : undefined,
        };
      });
  }, [contextDeclarations, node.id, applyContext, appliedContextIds]);

  // Build remove context submenu items (for removing applied contexts)
  const removeContextItems: ContextMenuItem[] = useMemo(() => {
    const items: ContextMenuItem[] = [];
    for (const contextId of appliedContextIds) {
      const contextNode = nodes[contextId];
      if (!contextNode) continue;
      const contextDecl = contextDeclarations.find(c => c.nodeId === contextId);
      const iconDef = contextDecl ? getIconByName(contextDecl.icon) : null;
      const content = contextNode.content || 'Untitled context';
      items.push({
        label: content.length > 30 ? content.slice(0, 30) + '...' : content,
        onClick: () => removeAppliedContext(node.id, contextId),
        icon: iconDef ? createElement(FontAwesomeIcon, { icon: iconDef }) : undefined,
      });
    }
    return items;
  }, [appliedContextIds, nodes, contextDeclarations, removeAppliedContext, node.id]);

  // Build the unified "Context" submenu with all context-related options
  const contextMenuItem: ContextMenuItem | null = useMemo(() => {
    const submenuItems: ContextMenuItem[] = [];

    // 1. Apply context (with nested submenu for context selection)
    // Only show if not a context declaration itself
    if (!isContextDeclaration) {
      submenuItems.push({
        label: 'Apply context',
        submenu: contextSelectionItems,
        disabled: contextDeclarations.length === 0,
      });
    }

    // 2. Remove context (only if context is applied)
    if (hasAppliedContext) {
      if (appliedContextIds.length === 1) {
        // Single context - direct action
        submenuItems.push({
          label: 'Remove context',
          onClick: () => removeAppliedContext(node.id, appliedContextIds[0]),
        });
      } else {
        // Multiple contexts - show submenu
        submenuItems.push({
          label: 'Remove context',
          submenu: removeContextItems,
        });
      }
    }

    // 3. Declare as context (only if not already a context declaration)
    if (!isContextDeclaration) {
      submenuItems.push({
        label: 'Declare as context',
        onClick: handleDeclareAsContext,
      });
    }

    // 4. Remove context declaration (only if this is a context declaration)
    if (isContextDeclaration) {
      submenuItems.push({
        label: 'Remove context declaration',
        onClick: handleRemoveContextDeclaration,
      });
    }

    // Return null if no items (shouldn't happen, but safety check)
    if (submenuItems.length === 0) {
      return null;
    }

    return {
      label: 'Context',
      submenu: submenuItems,
    };
  }, [
    isContextDeclaration,
    hasAppliedContext,
    appliedContextIds,
    contextSelectionItems,
    removeContextItems,
    contextDeclarations.length,
    removeAppliedContext,
    node.id,
    handleDeclareAsContext,
    handleRemoveContextDeclaration,
  ]);

  return {
    contextMenuItem,
  };
}
