import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getIsContextChild, getParentIdOrNull } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../utils/ancestry';
import { ContextMode } from '../../../store/tree/treeStore';

interface BuildBlueprintSubmenuParams {
  node: TreeNode;
  getNodes: () => Record<string, TreeNode>;
  getAncestorRegistry: () => AncestorRegistry;
  onAddToBlueprint: () => void;
  onAddToBlueprintWithDescendants: () => void;
  onRemoveFromBlueprint: () => void;
  onDeclareAsContext: () => void;
  onRemoveContextDeclaration: () => void;
  onSetContextMode?: (mode: ContextMode) => void;
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
  onSetContextMode,
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

    if (onSetContextMode) {
      const currentMode = (node.metadata.contextMode as ContextMode) || 'collaborate';
      submenuItems.push({
        label: 'Context mode',
        submenu: [
          {
            label: 'Collaborate',
            radioSelected: currentMode === 'collaborate',
            keepOpenOnClick: true,
            disabled: currentMode === 'collaborate',
            onClick: () => onSetContextMode('collaborate'),
          },
          {
            label: 'Execute',
            radioSelected: currentMode === 'execute',
            keepOpenOnClick: true,
            disabled: currentMode === 'execute',
            onClick: () => onSetContextMode('execute'),
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
