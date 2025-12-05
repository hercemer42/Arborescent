import { ArboFile, TreeNode } from '../../shared/types';

/**
 * Strip transient metadata from a node before persisting.
 * The entire `metadata.transient` object is removed.
 */
function stripTransientMetadata(node: TreeNode): TreeNode {
  if (!node.metadata.transient) {
    return node;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { transient, ...cleanedMetadata } = node.metadata;
  return { ...node, metadata: cleanedMetadata };
}

/**
 * Strip transient metadata from all nodes before persisting.
 */
function stripTransientMetadataFromNodes(
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const result: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    result[id] = stripTransientMetadata(node);
  }
  return result;
}

export function createArboFile(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  existingMeta?: { created: string; author: string }
): ArboFile {
  return {
    format: 'Arborescent',
    version: '1.0.0',
    created: existingMeta?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    author: existingMeta?.author || 'unknown',
    rootNodeId,
    nodes: stripTransientMetadataFromNodes(nodes),
  };
}
