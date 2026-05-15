import type { TreeNode } from '../../shared/types';

function findIdsToStrip(nodes: Record<string, TreeNode>): Set<string> {
  const ids = new Set<string>();
  const childIds = new Set<string>();
  for (const node of Object.values(nodes)) {
    for (const childId of node.children) childIds.add(childId);
  }

  function walk(nodeId: string, insideWorkflow: boolean): void {
    const node = nodes[nodeId];
    if (!node) return;

    const isWorkflow = node.metadata.isWorkflow === true;
    const isContextDeclaration = node.metadata.isContextDeclaration === true;
    if (insideWorkflow && !isWorkflow && !isContextDeclaration) {
      const hasIcon = node.metadata.blueprintIcon !== undefined;
      const hasColor = node.metadata.blueprintColor !== undefined;
      if (hasIcon || hasColor) ids.add(nodeId);
    }

    const nextInside = insideWorkflow || isWorkflow;
    for (const childId of node.children) walk(childId, nextInside);
  }

  for (const id of Object.keys(nodes)) {
    if (!childIds.has(id)) walk(id, false);
  }

  return ids;
}

function stripIconFields(node: TreeNode): TreeNode {
  const cleanMetadata = { ...node.metadata };
  delete cleanMetadata.blueprintIcon;
  delete cleanMetadata.blueprintColor;
  return { ...node, metadata: cleanMetadata };
}

export function migrateWorkflowStepIcons(
  nodes: Record<string, TreeNode>,
): Record<string, TreeNode> {
  const ids = findIdsToStrip(nodes);
  if (ids.size === 0) return nodes;

  const migrated: Record<string, TreeNode> = { ...nodes };
  for (const id of ids) {
    migrated[id] = stripIconFields(nodes[id]);
  }
  return migrated;
}
