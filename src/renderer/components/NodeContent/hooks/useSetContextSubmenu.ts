import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../utils/ancestry';
import { ContextDeclarationInfo } from '../../../store/tree/treeStore';
import { getIconByName } from '../../ui/CustomizeDialog/CustomizeDialog';
import { getInheritedContextId } from '../../../utils/nodeHelpers';

interface BuildSetContextSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  onSetAppliedContext: (contextId: string | null) => void;
}

export function buildSetContextSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  onSetAppliedContext,
}: BuildSetContextSubmenuParams): ContextMenuItem[] | null {
  if (contextDeclarations.length === 0) {
    return null;
  }

  const explicitContextId = node.metadata.appliedContextId as string | undefined;
  const inheritedContextId = getInheritedContextId(node.id, nodes, ancestorRegistry);

  const submenuItems: ContextMenuItem[] = [];

  const ancestors = ancestorRegistry[node.id] || [];
  const availableContexts = contextDeclarations.filter(
    ctx => ctx.nodeId !== node.id && !ancestors.includes(ctx.nodeId)
  );

  if (availableContexts.length === 0) {
    return null;
  }

  for (const context of availableContexts) {
    const contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;
    const Icon = getIconByName(context.icon);
    const isActive = context.nodeId === explicitContextId;
    const isInherited = context.nodeId === inheritedContextId;
    const isInheritedAndNoExplicit = isInherited && !explicitContextId;

    let label = contextName;
    if (isInherited) {
      label += ' (inherited)';
    }

    submenuItems.push({
      label,
      icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
      radioSelected: isInheritedAndNoExplicit ? true : isActive,
      keepOpenOnClick: true,
      disabled: isInheritedAndNoExplicit,
      onClick: () => {
        if (isInheritedAndNoExplicit) {
          return;
        }
        if (isActive) {
          onSetAppliedContext(null);
        } else if (isInherited) {
          onSetAppliedContext(null);
        } else {
          onSetAppliedContext(context.nodeId);
        }
      },
    });
  }

  if (submenuItems.length > 0) {
    submenuItems.push({ label: '-', onClick: () => {} });
    submenuItems.push({
      label: 'Close',
      onClick: () => {},
    });
  }

  return submenuItems;
}
