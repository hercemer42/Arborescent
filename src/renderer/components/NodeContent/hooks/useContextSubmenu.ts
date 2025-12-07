import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';
import { AncestorRegistry } from '../../../services/ancestry';

interface BuildContextSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  openIconPicker: (nodeId: string | null, callback: (selection: { icon: string; color?: string }) => void) => void;
  actions: {
    declareAsContext: (nodeId: string, icon?: string, color?: string) => void;
    removeContextDeclaration: (nodeId: string) => void;
    applyContext: (nodeId: string, contextNodeId: string) => void;
    removeAppliedContext: (nodeId: string, contextNodeId?: string) => void;
  };
}

export function buildContextSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  openIconPicker,
  actions,
}: BuildContextSubmenuParams): ContextMenuItem | null {
  const isContextDeclaration = node.metadata.isContextDeclaration === true;
  const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];
  const hasAppliedContext = appliedContextIds.length > 0;

  const canDeclareAsContext = (() => {
    if (isContextDeclaration) return false;
    const ancestors = ancestorRegistry[node.id] || [];
    const parentId = ancestors[ancestors.length - 1];
    const parent = parentId ? nodes[parentId] : null;
    return parent?.metadata.isBlueprint === true;
  })();

  const handleDeclareAsContext = () => {
    openIconPicker(null, (selection) => {
      actions.declareAsContext(node.id, selection.icon, selection.color);
    });
  };

  const handleRemoveContextDeclaration = () => {
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

    actions.removeContextDeclaration(node.id);
  };

  const ancestors = ancestorRegistry[node.id] || [];
  const contextSelectionItems: ContextMenuItem[] = contextDeclarations
    .filter(ctx => ctx.nodeId !== node.id)
    .filter(ctx => !appliedContextIds.includes(ctx.nodeId))
    .filter(ctx => !ancestors.includes(ctx.nodeId))
    .map(ctx => {
      const Icon = getIconByName(ctx.icon);
      return {
        label: ctx.content.length > 30 ? ctx.content.slice(0, 30) + '...' : ctx.content,
        onClick: () => actions.applyContext(node.id, ctx.nodeId),
        icon: Icon ? createElement(Icon, { size: 14 }) : undefined,
      };
    });

  const removeContextItems: ContextMenuItem[] = [];
  for (const contextId of appliedContextIds) {
    const contextNode = nodes[contextId];
    if (!contextNode) continue;
    const contextDecl = contextDeclarations.find(c => c.nodeId === contextId);
    const Icon = contextDecl ? getIconByName(contextDecl.icon) : null;
    const content = contextNode.content || 'Untitled context';
    removeContextItems.push({
      label: content.length > 30 ? content.slice(0, 30) + '...' : content,
      onClick: () => actions.removeAppliedContext(node.id, contextId),
      icon: Icon ? createElement(Icon, { size: 14 }) : undefined,
    });
  }

  const submenuItems: ContextMenuItem[] = [];

  submenuItems.push({
    label: 'Apply context',
    submenu: contextSelectionItems,
    disabled: contextSelectionItems.length === 0,
  });

  if (hasAppliedContext) {
    submenuItems.push({
      label: 'Remove context',
      submenu: removeContextItems,
    });
  }

  if (canDeclareAsContext) {
    submenuItems.push({
      label: 'Declare as context',
      onClick: handleDeclareAsContext,
    });
  }

  if (isContextDeclaration) {
    submenuItems.push({
      label: 'Remove context declaration',
      onClick: handleRemoveContextDeclaration,
    });
  }

  if (submenuItems.length === 0) {
    return null;
  }

  return {
    label: 'Context',
    submenu: submenuItems,
  };
}
