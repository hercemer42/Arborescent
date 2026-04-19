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

const SEPARATOR: ContextMenuItem = { separator: true };

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

  const ancestors = ancestorRegistry[node.id] || [];
  const availableContexts = contextDeclarations.filter(
    ctx => ctx.nodeId !== node.id && !ancestors.includes(ctx.nodeId)
  );

  if (availableContexts.length === 0) {
    return null;
  }

  const collaborateContexts = availableContexts.filter(c => c.mode === 'collaborate');
  const executeContexts = availableContexts.filter(c => c.mode === 'execute');

  const items: ContextMenuItem[] = [];

  items.push({ label: 'Collaborate', disabled: true });
  items.push(...buildContextItems(collaborateContexts, explicitContextId, inheritedContextId, onSetAppliedContext));

  items.push(SEPARATOR);

  items.push({ label: 'Execute', disabled: true });
  items.push(...buildContextItems(executeContexts, explicitContextId, inheritedContextId, onSetAppliedContext));

  items.push(SEPARATOR);
  items.push({ label: 'Close', onClick: () => {} });

  return items;
}

function buildContextItems(
  contexts: ContextDeclarationInfo[],
  explicitContextId: string | undefined,
  inheritedContextId: string | undefined,
  onSetAppliedContext: (contextId: string | null) => void,
): ContextMenuItem[] {
  return contexts.map(context => {
    const contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;
    const Icon = getIconByName(context.icon);
    const isActive = context.nodeId === explicitContextId;
    const isInherited = context.nodeId === inheritedContextId;
    const isInheritedAndNoExplicit = isInherited && !explicitContextId;

    let label = contextName;
    if (isInherited) {
      label += ' (inherited)';
    }

    return {
      label,
      icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
      radioSelected: isInheritedAndNoExplicit ? true : isActive,
      keepOpenOnClick: true,
      disabled: isInheritedAndNoExplicit,
      onClick: () => {
        if (isInheritedAndNoExplicit) return;
        if (isActive || isInherited) {
          onSetAppliedContext(null);
        } else {
          onSetAppliedContext(context.nodeId);
        }
      },
    };
  });
}
