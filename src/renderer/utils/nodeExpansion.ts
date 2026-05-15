import { TreeNode } from '../../shared/types';
import { AncestorRegistry } from './ancestry';
import { updateNodeMetadata } from './nodeHelpers';

export interface ExpandResult {
  nodes: Record<string, TreeNode>;
  changed: boolean;
}

export function expandCollapsedAncestors(
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  nodeId: string,
): ExpandResult {
  const ancestors = ancestorRegistry[nodeId] || [];
  let updatedNodes = nodes;
  let changed = false;

  for (const ancestorId of ancestors) {
    const ancestor = updatedNodes[ancestorId];
    if (ancestor && ancestor.children.length > 0 && ancestor.metadata.expanded === false) {
      updatedNodes = updateNodeMetadata(updatedNodes, ancestorId, { expanded: true });
      changed = true;
    }
  }

  return { nodes: updatedNodes, changed };
}
