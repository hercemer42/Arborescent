import { createElement } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getInheritedContextId, resolveContextMode, BASIC_EXECUTE_CONTEXT_ID } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../utils/ancestry';
import { getIconByName } from '../../ui/CustomizeDialog/CustomizeDialog';
import { ContextDeclarationInfo, ContextMode } from '../../../store/tree/treeStore';

export interface SendSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  contextDeclarations: ContextDeclarationInfo[];
  collaboratingNodeId: string | null;
  onSendInTerminal: (mode: ContextMode) => void;
  onSendInBrowser: (mode: ContextMode) => void;
  onSetActiveContext: (nodeId: string, contextId: string | null) => void;
}

function getExplicitContextId(node: TreeNode): string | undefined {
  return node.metadata.appliedContextId as string | undefined;
}

const SEPARATOR: ContextMenuItem = { label: '-', onClick: () => {} };

export function buildSendSubmenu({
  node,
  nodes,
  ancestorRegistry,
  contextDeclarations,
  collaboratingNodeId,
  onSendInTerminal,
  onSendInBrowser,
  onSetActiveContext,
}: SendSubmenuParams): ContextMenuItem[] {
  const explicitContextId = getExplicitContextId(node);
  const inheritedContextId = getInheritedContextId(node.id, nodes, ancestorRegistry);
  const effectiveContextId = explicitContextId || inheritedContextId;
  const effectiveMode = resolveContextMode(effectiveContextId, nodes, contextDeclarations);

  const collaborateDisabled = effectiveMode === 'collaborate' && !!collaboratingNodeId;

  const ancestors = ancestorRegistry[node.id] || [];
  const availableContexts = contextDeclarations.filter(
    ctx => ctx.nodeId !== node.id && !ancestors.includes(ctx.nodeId)
  );

  const baseActions = createActionItems(onSendInTerminal, onSendInBrowser, effectiveMode, collaborateDisabled);
  const contextItems = buildContextPickerItems(
    node, availableContexts, explicitContextId, inheritedContextId, onSetActiveContext
  );

  return [...baseActions, ...contextItems];
}

function createActionItems(
  onSendInTerminal: (mode: ContextMode) => void,
  onSendInBrowser: (mode: ContextMode) => void,
  effectiveMode: ContextMode,
  collaborateDisabled: boolean,
): ContextMenuItem[] {
  return [
    {
      label: 'In terminal',
      onClick: () => onSendInTerminal(effectiveMode),
      disabled: collaborateDisabled,
    },
    {
      label: 'In browser',
      onClick: () => onSendInBrowser(effectiveMode),
      disabled: collaborateDisabled,
    },
  ];
}

function createBuiltInCollaborateItem(
  explicitContextId: string | undefined,
  nodeId: string,
  onSetActiveContext: (nodeId: string, contextId: string | null) => void,
): ContextMenuItem[] {
  const ReviewIcon = getIconByName('Eye');
  return [{
    label: 'Basic review (default)',
    icon: ReviewIcon ? createElement(ReviewIcon, { size: 14 }) : undefined,
    radioSelected: !explicitContextId,
    keepOpenOnClick: true,
    disabled: !explicitContextId,
    onClick: () => {
      if (explicitContextId) {
        onSetActiveContext(nodeId, null);
      }
    },
  }];
}

function createBuiltInExecuteItem(
  explicitContextId: string | undefined,
  nodeId: string,
  onSetActiveContext: (nodeId: string, contextId: string | null) => void,
): ContextMenuItem[] {
  const ExecIcon = getIconByName('Zap');
  const isBasicExecuteSelected = explicitContextId === BASIC_EXECUTE_CONTEXT_ID;
  return [{
    label: 'Basic execution',
    icon: ExecIcon ? createElement(ExecIcon, { size: 14 }) : undefined,
    radioSelected: isBasicExecuteSelected,
    keepOpenOnClick: true,
    disabled: isBasicExecuteSelected,
    onClick: () => {
      if (!isBasicExecuteSelected) {
        onSetActiveContext(nodeId, BASIC_EXECUTE_CONTEXT_ID);
      }
    },
  }];
}

function buildContextPickerItems(
  node: TreeNode,
  availableContexts: ContextDeclarationInfo[],
  explicitContextId: string | undefined,
  inheritedContextId: string | undefined,
  onSetActiveContext: (nodeId: string, contextId: string | null) => void,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    SEPARATOR,
    { label: 'Apply a context', onClick: () => {}, disabled: true },
  ];

  const showBuiltIns = !inheritedContextId;
  const collaborateContexts = availableContexts.filter(c => c.mode === 'collaborate');
  const executeContexts = availableContexts.filter(c => c.mode === 'execute');

  const hasCollaborateSection = showBuiltIns || collaborateContexts.length > 0;
  const hasExecuteSection = showBuiltIns || executeContexts.length > 0;

  if (hasCollaborateSection) {
    items.push(SEPARATOR);
    items.push({ label: 'Collaborate', onClick: () => {}, disabled: true });
    if (showBuiltIns) {
      items.push(...createBuiltInCollaborateItem(explicitContextId, node.id, onSetActiveContext));
    }
    for (const context of collaborateContexts) {
      items.push(createContextItem(context, node, explicitContextId, inheritedContextId, onSetActiveContext));
    }
  }

  if (hasExecuteSection) {
    items.push(SEPARATOR);
    items.push({ label: 'Execute', onClick: () => {}, disabled: true });
    if (showBuiltIns) {
      items.push(...createBuiltInExecuteItem(explicitContextId, node.id, onSetActiveContext));
    }
    for (const context of executeContexts) {
      items.push(createContextItem(context, node, explicitContextId, inheritedContextId, onSetActiveContext));
    }
  }

  return items;
}

function createContextItem(
  context: ContextDeclarationInfo,
  node: TreeNode,
  explicitContextId: string | undefined,
  inheritedContextId: string | undefined,
  onSetActiveContext: (nodeId: string, contextId: string | null) => void,
): ContextMenuItem {
  let contextName = context.content.length > 30 ? context.content.slice(0, 30) + '...' : context.content;
  const isActive = context.nodeId === explicitContextId;
  const isInherited = context.nodeId === inheritedContextId;
  const isInheritedActive = isInherited && !explicitContextId;

  if (isInherited) {
    contextName += ' (inherited)';
  }

  const Icon = getIconByName(context.icon);

  return {
    label: contextName,
    icon: Icon ? createElement(Icon, { size: 14, style: context.color ? { color: context.color } : undefined }) : undefined,
    radioSelected: isInheritedActive ? true : (isActive && !isInherited),
    keepOpenOnClick: true,
    disabled: isInheritedActive,
    onClick: () => {
      if (isInheritedActive) return;
      if (isInherited || isActive) {
        onSetActiveContext(node.id, null);
      } else {
        onSetActiveContext(node.id, context.nodeId);
      }
    },
  };
}
