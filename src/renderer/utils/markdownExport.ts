import { TreeNode, STATUS_SYMBOLS } from '../../shared/types';

function generateHeading(level: number): string {
  return '#'.repeat(level);
}

function formatNodeHierarchy(
  nodePath: string[],
  nodes: Record<string, TreeNode>
): string[] {
  const lines: string[] = [];

  nodePath.forEach((id, index) => {
    const currentNode = nodes[id];
    if (!currentNode) return;

    const headingLevel = index + 1;
    const heading = generateHeading(headingLevel);

    lines.push(`${heading} ${currentNode.content}`);
    lines.push('');

    if (currentNode.metadata.status) {
      lines.push(`**Status:** ${currentNode.metadata.status}`);
      lines.push('');
    }
  });

  return lines;
}

function formatSubtasks(
  node: TreeNode,
  nodes: Record<string, TreeNode>
): string[] {
  if (node.children.length === 0) {
    return [];
  }

  const lines: string[] = ['## Subtasks', ''];

  node.children.forEach((childId) => {
    const child = nodes[childId];
    if (!child || child.metadata.deleted) return;

    const status = child.metadata.status || 'pending';
    const statusSymbol = STATUS_SYMBOLS[status];
    lines.push(`- ${statusSymbol} ${child.content}`);
  });

  lines.push('');

  return lines;
}

export function exportNodeWithAncestors(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: Record<string, string[]>
): string {
  const node = nodes[nodeId];
  if (!node) {
    return '';
  }

  const ancestors = ancestorRegistry[nodeId] || [];
  const nodePath = [...ancestors, nodeId];

  const lines: string[] = ['# Task Context', ''];

  lines.push(...formatNodeHierarchy(nodePath, nodes));
  lines.push(...formatSubtasks(node, nodes));

  return lines.join('\n');
}
