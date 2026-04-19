import type { TreeNode } from '../../../../shared/types';
import {
  exportNodeAsMarkdown,
  exportMultipleNodesAsMarkdown,
} from '../../../utils/markdown';
import {
  sortNodeIdsByTreeOrder,
  getParentId,
} from '../../../utils/nodeHelpers';
import type { VisualEffectsActions } from './visualEffectsActions';

/**
 * Pure, stateless helpers used by clipboardActions for selection
 * inspection, validation, and content export. Extracted to keep the
 * main factory focused on the paste-command orchestration.
 */

export type SelectionResult =
  | { type: 'multi'; nodeIds: string[] }
  | { type: 'single'; nodeId: string }
  | { type: 'none' };

export interface SelectionState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null;
  multiSelectedNodeIds: Set<string>;
}

export function selectionContainsRoot(nodeIds: string[], nodes: Record<string, TreeNode>): boolean {
  return nodeIds.some((id) => nodes[id]?.metadata.isRoot === true);
}

/**
 * Filter out selections that are descendants of another selected node.
 * When a user selects a node and one of its children, paste/cut should
 * operate on the root-level selection only.
 */
export function getRootLevelSelections(
  nodeIds: string[],
  ancestorRegistry: Record<string, string[]>
): string[] {
  const selectionSet = new Set(nodeIds);
  return nodeIds.filter((nodeId) => {
    const ancestors = ancestorRegistry[nodeId] || [];
    return !ancestors.some((ancestorId) => selectionSet.has(ancestorId));
  });
}

export function getSelection(state: SelectionState): SelectionResult {
  const { activeNodeId, nodes, multiSelectedNodeIds, ancestorRegistry, rootNodeId } = state;

  if (multiSelectedNodeIds.size > 0) {
    const rootLevelIds = getRootLevelSelections(
      Array.from(multiSelectedNodeIds),
      ancestorRegistry
    );
    const sortedIds = sortNodeIdsByTreeOrder(rootLevelIds, rootNodeId, nodes, ancestorRegistry);
    return { type: 'multi', nodeIds: sortedIds };
  }

  if (activeNodeId && nodes[activeNodeId]) {
    return { type: 'single', nodeId: activeNodeId };
  }

  return { type: 'none' };
}

export function exportSelectionAsMarkdown(
  selection: SelectionResult,
  nodes: Record<string, TreeNode>
): string | null {
  if (selection.type === 'multi') {
    return exportMultipleNodesAsMarkdown(selection.nodeIds, nodes);
  }
  if (selection.type === 'single') {
    const node = nodes[selection.nodeId];
    return node ? exportNodeAsMarkdown(node, nodes) : null;
  }
  return null;
}

export function getNodeIdsFromSelection(selection: SelectionResult): string[] {
  if (selection.type === 'multi') return selection.nodeIds;
  if (selection.type === 'single') return [selection.nodeId];
  return [];
}

export function flashNodes(
  nodeIds: string | string[],
  visualEffects: VisualEffectsActions
): void {
  visualEffects.flashNode(nodeIds, 'light');
}

export function containsBlueprintNodes(nodesMap: Record<string, TreeNode>): boolean {
  return Object.values(nodesMap).some((node) => node.metadata.isBlueprint === true);
}

export function isTargetBlueprint(targetParentId: string, nodes: Record<string, TreeNode>): boolean {
  const targetParent = nodes[targetParentId];
  return targetParent?.metadata.isBlueprint === true;
}

/**
 * Reject moves that would be impossible or no-ops:
 *  - target is one of the moved nodes
 *  - target is a descendant of any moved node (would cut the target off)
 *  - all moved nodes already share the target as parent (no-op)
 */
export function isInvalidMoveTarget(
  nodeIds: string[],
  targetParentId: string,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): boolean {
  if (nodeIds.includes(targetParentId)) {
    return true;
  }
  const targetAncestors = ancestorRegistry[targetParentId] || [];
  if (nodeIds.some((id) => targetAncestors.includes(id))) {
    return true;
  }
  const firstNodeParent = getParentId(nodeIds[0], ancestorRegistry, rootNodeId);
  const allSameParent = nodeIds.every(
    (id) => getParentId(id, ancestorRegistry, rootNodeId) === firstNodeParent
  );
  if (allSameParent && firstNodeParent === targetParentId) {
    return true;
  }
  return false;
}
