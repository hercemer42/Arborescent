import { TreeNode, NodeStatus } from '../../shared/types';
import { AncestorRegistry } from './ancestry';

function isResolvedInRange(
  resolvedAt: string | undefined,
  dateFrom: string | null,
  dateTo: string | null
): boolean {
  if (!resolvedAt) return false;
  const date = resolvedAt.split('T')[0];
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

/**
 * Summary-mode visibility: return the set of node ids to show when the
 * user has filtered to resolved work in the given date range. A node is
 * visible if it (or any descendant) was completed/abandoned inside the
 * range; all ancestors of a visible node are pulled in for context.
 */
export function computeSummaryVisibleNodeIds(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: AncestorRegistry,
  dateFrom: string | null,
  dateTo: string | null
): Set<string> {
  const visibleIds = new Set<string>();

  for (const [nodeId, node] of Object.entries(nodes)) {
    const status = node.metadata.status as NodeStatus | undefined;
    const resolvedAt = node.metadata.resolvedAt as string | undefined;

    if ((status === 'completed' || status === 'abandoned') &&
        isResolvedInRange(resolvedAt, dateFrom, dateTo)) {
      visibleIds.add(nodeId);
      const ancestors = ancestorRegistry[nodeId] || [];
      for (const ancestorId of ancestors) {
        visibleIds.add(ancestorId);
      }
    }
  }

  if (visibleIds.size > 0) {
    visibleIds.add(rootNodeId);
  }

  return visibleIds;
}
