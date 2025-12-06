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

/**
 * Extract only blueprint nodes from a tree, preserving structure and content.
 * Non-blueprint nodes are removed, and their children references are filtered.
 */
export function extractBlueprintNodes(
  nodes: Record<string, TreeNode>,
  rootNodeId: string
): Record<string, TreeNode> {
  const result: Record<string, TreeNode> = {};

  function collectBlueprintNode(nodeId: string): void {
    const node = nodes[nodeId];
    if (!node) return;

    if (node.metadata.isBlueprint) {
      result[nodeId] = {
        ...node,
        children: node.children.filter((childId) => {
          const child = nodes[childId];
          return child?.metadata.isBlueprint;
        }),
      };
    }

    // Recursively check all children regardless of current node's blueprint status
    for (const childId of node.children) {
      collectBlueprintNode(childId);
    }
  }

  collectBlueprintNode(rootNodeId);
  return result;
}

export function createArboFile(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  existingMeta?: { created: string; author: string },
  isBlueprint?: boolean
): ArboFile {
  const file: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: existingMeta?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    author: existingMeta?.author || 'unknown',
    rootNodeId,
    nodes: stripTransientMetadataFromNodes(nodes),
  };

  if (isBlueprint) {
    file.isBlueprint = true;
  }

  return file;
}
