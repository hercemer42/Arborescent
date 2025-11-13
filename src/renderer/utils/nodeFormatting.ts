import { TreeNode, STATUS_SYMBOLS } from '../../shared/types';

export interface NodesMap {
  [key: string]: TreeNode;
}

/**
 * Formats a node and its descendants as markdown with status symbols and indentation.
 * Skips deleted nodes.
 *
 * @param node - The node to format
 * @param nodes - Map of all nodes
 * @param depth - Current depth level (0 = root)
 * @returns Markdown formatted string with status symbols and hierarchy
 */
export function formatNodeAsMarkdown(node: TreeNode, nodes: NodesMap, depth: number = 0): string {
  // Skip deleted nodes
  if (node.metadata.deleted) {
    return '';
  }

  const indent = '  '.repeat(depth);
  let markdown = '';

  // Get status symbol
  const status = node.metadata.status || 'pending';
  const statusSymbol = STATUS_SYMBOLS[status];

  // Format current node content
  if (node.content && node.content.trim()) {
    const contentLines = node.content.split('\n');
    contentLines.forEach((line, index) => {
      if (index === 0) {
        // First line with status symbol
        markdown += `${indent}${statusSymbol} ${line}\n`;
      } else {
        // Subsequent lines indented (preserve multi-line content)
        markdown += `${indent}  ${line}\n`;
      }
    });
  }

  // Format children recursively
  if (node.children && node.children.length > 0) {
    node.children.forEach((childId: string) => {
      const childNode = nodes[childId];
      if (childNode) {
        markdown += formatNodeAsMarkdown(childNode, nodes, depth + 1);
      }
    });
  }

  return markdown;
}
