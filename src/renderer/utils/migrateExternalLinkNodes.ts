import type { TreeNode } from '../../shared/types';

function needsMigration(node: TreeNode): boolean {
  return node.metadata.isExternalLink === true;
}

function migrateNode(node: TreeNode): TreeNode {
  const externalUrl = node.metadata.externalUrl as string | undefined;
  const trimmedContent = node.content?.trim() ?? '';
  const nextContent = trimmedContent.length > 0
    ? node.content
    : (externalUrl ?? node.content);

  const remainingMetadata = { ...node.metadata };
  delete remainingMetadata.isExternalLink;
  delete remainingMetadata.externalUrl;

  return {
    ...node,
    content: nextContent,
    metadata: remainingMetadata,
  };
}

export function migrateExternalLinkNodes(
  nodes: Record<string, TreeNode>,
): Record<string, TreeNode> {
  let migrated: Record<string, TreeNode> | null = null;

  for (const [id, node] of Object.entries(nodes)) {
    if (!needsMigration(node)) continue;
    if (!migrated) migrated = { ...nodes };
    migrated[id] = migrateNode(node);
  }

  return migrated ?? nodes;
}
