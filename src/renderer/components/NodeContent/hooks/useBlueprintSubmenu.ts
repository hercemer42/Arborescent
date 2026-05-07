import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getIsContextChild, getParentIdOrNull, ContextFlags } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../utils/ancestry';

interface BuildBlueprintSubmenuParams {
  node: TreeNode;
  getNodes: () => Record<string, TreeNode>;
  getAncestorRegistry: () => AncestorRegistry;
  onAddToBlueprint: () => void;
  onAddToBlueprintWithDescendants: () => void;
  onRemoveFromBlueprint: () => void;
  onDeclareAsContext: () => void;
  onRemoveContextDeclaration: () => void;
  onSetContextFlags?: (flags: ContextFlags) => void;
  onDeclareAsWorkflow?: () => void;
  onRemoveFromWorkflow?: () => void;
}

function hasDescendantBlueprints(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  const node = nodes[nodeId];
  if (!node) return false;

  for (const childId of node.children) {
    const child = nodes[childId];
    if (child?.metadata.isBlueprint === true) return true;
    if (hasDescendantBlueprints(childId, nodes)) return true;
  }
  return false;
}

const SEPARATOR: ContextMenuItem = { separator: true };

export function buildBlueprintSubmenu({
  node,
  getNodes,
  getAncestorRegistry,
  onAddToBlueprint,
  onAddToBlueprintWithDescendants,
  onRemoveFromBlueprint,
  onDeclareAsContext,
  onRemoveContextDeclaration,
  onSetContextFlags,
  onDeclareAsWorkflow,
  onRemoveFromWorkflow,
}: BuildBlueprintSubmenuParams): ContextMenuItem | null {
  const nodes = getNodes();
  const ancestorRegistry = getAncestorRegistry();
  const isContextChild = getIsContextChild(node.id, nodes, ancestorRegistry);
  const isBlueprint = node.metadata.isBlueprint === true;
  const isContextDeclaration = node.metadata.isContextDeclaration === true;
  const hasChildren = node.children.length > 0;

  // Check if parent is a blueprint (required for declaring as context)
  const ancestors = ancestorRegistry[node.id] || [];
  const parentId = getParentIdOrNull(node.id, ancestorRegistry);
  const parent = parentId ? nodes[parentId] : null;
  const canDeclareAsContext = parent?.metadata.isBlueprint === true && !isContextDeclaration;

  const handleRemove = () => {
    const hasDescendants = hasDescendantBlueprints(node.id, nodes);
    if (hasDescendants) {
      const confirmed = window.confirm(
        'This will also remove all descendant nodes from the blueprint. Continue?'
      );
      if (!confirmed) return;
    }
    onRemoveFromBlueprint();
  };

  const submenuItems: ContextMenuItem[] = [];

  const isWorkflowOrStep = node.metadata.isWorkflow === true
    || parent?.metadata.isWorkflow === true;

  // Blueprint add/remove items (not for context declarations or context children)
  if (!isContextDeclaration && !isContextChild) {
    if (!isBlueprint) {
      submenuItems.push({
        label: 'Add to Blueprint',
        onClick: onAddToBlueprint,
      });
      if (hasChildren) {
        submenuItems.push({
          label: 'Add with descendants',
          onClick: onAddToBlueprintWithDescendants,
        });
      }
    } else if (!isWorkflowOrStep) {
      submenuItems.push({
        label: 'Remove from Blueprint',
        onClick: handleRemove,
      });
    }
  }

  // Context declaration items
  if (canDeclareAsContext) {
    if (submenuItems.length > 0) submenuItems.push(SEPARATOR);
    submenuItems.push({
      label: 'Declare as Context',
      onClick: onDeclareAsContext,
    });
  }

  if (isContextDeclaration) {
    if (submenuItems.length > 0) submenuItems.push(SEPARATOR);

    if (onSetContextFlags) {
      const currentCollaborate = node.metadata.collaborate === true;
      const currentExecute = node.metadata.execute === true;
      const matches = (collaborate: boolean, execute: boolean) =>
        currentCollaborate === collaborate && currentExecute === execute;
      submenuItems.push({
        label: 'Context mode',
        submenu: [
          {
            label: 'Collaborate',
            radioSelected: matches(true, false),
            keepOpenOnClick: true,
            disabled: matches(true, false),
            onClick: () => onSetContextFlags({ collaborate: true, execute: false }),
          },
          {
            label: 'Execute',
            radioSelected: matches(false, true),
            keepOpenOnClick: true,
            disabled: matches(false, true),
            onClick: () => onSetContextFlags({ collaborate: false, execute: true }),
          },
          {
            label: 'Collaborate & Execute',
            radioSelected: matches(true, true),
            keepOpenOnClick: true,
            disabled: matches(true, true),
            onClick: () => onSetContextFlags({ collaborate: true, execute: true }),
          },
          {
            label: 'Action',
            radioSelected: matches(false, false),
            keepOpenOnClick: true,
            disabled: matches(false, false),
            onClick: () => onSetContextFlags({ collaborate: false, execute: false }),
          },
        ],
      });
    }

    submenuItems.push({
      label: 'Remove Context Declaration',
      onClick: onRemoveContextDeclaration,
    });
  }

  const isWorkflow = node.metadata.isWorkflow === true;
  const isInContext = node.metadata.isContextDeclaration === true
    || ancestors.some(id => nodes[id]?.metadata.isContextDeclaration === true);
  const canDeclareAsWorkflow = parent?.metadata.isBlueprint === true
    && !isWorkflow
    && !isInContext;

  if (canDeclareAsWorkflow && onDeclareAsWorkflow) {
    if (submenuItems.length > 0) submenuItems.push(SEPARATOR);
    submenuItems.push({
      label: 'Declare as Workflow',
      onClick: onDeclareAsWorkflow,
    });
  }

  if (isWorkflow && onRemoveFromWorkflow) {
    if (submenuItems.length > 0) submenuItems.push(SEPARATOR);
    submenuItems.push({
      label: 'Remove from Workflow',
      onClick: onRemoveFromWorkflow,
    });
  }

  // Only show menu if there's something to display
  if (submenuItems.length === 0) {
    return null;
  }

  return {
    label: 'Blueprint',
    submenu: submenuItems,
  };
}
