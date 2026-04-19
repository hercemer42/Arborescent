import type { AncestorRegistry } from './ancestry';

/**
 * Parent-id lookup primitives. Extracted to a leaf module so
 * treeNavigation can depend on them without re-entering the
 * nodeHelpers hub (which re-exports from treeNavigation, forming a
 * cycle that confused eslint's import graph).
 */

export function getParentId(
  nodeId: string,
  ancestorRegistry: AncestorRegistry,
  rootNodeId: string,
): string {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors[ancestors.length - 1] || rootNodeId;
}

/**
 * Parent-id lookup with no root fallback. Returns null when the node is
 * root-level (no ancestors). Use this when the caller needs to detect
 * "this IS the root" instead of treating root as self-parented.
 */
export function getParentIdOrNull(
  nodeId: string,
  ancestorRegistry: AncestorRegistry,
): string | null {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
}
