import { TreeNode, NodeStatus, STATUS_SYMBOLS } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export type NodesMap = Record<string, TreeNode>;

// ASCII checkbox symbols for export (more reliable across tools and encodings)
const ASCII_STATUS_SYMBOLS: Record<NodeStatus, string> = {
  pending: '[ ]',
  completed: '[x]',
  failed: '[-]',
};

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Creates a markdown heading prefix for the given depth level
 * # for depth 0, ## for depth 1, etc. (capped at 6 levels)
 */
function createHeadingPrefix(depth: number): string {
  const headingLevel = Math.min(depth + 1, 6);
  return '#'.repeat(headingLevel);
}

/**
 * Exports a node and its descendants as markdown with heading levels for hierarchy.
 * Uses # for root, ## for children, ### for grandchildren, etc.
 * Skips deleted nodes.
 *
 * @param node - The node to export
 * @param nodes - Map of all nodes
 * @param depth - Current depth level (0 = root, maps to # heading)
 * @returns Markdown formatted string with heading hierarchy and ASCII checkbox symbols
 */
export function exportNodeAsMarkdown(node: TreeNode, nodes: NodesMap, depth: number = 0): string {
  // Skip deleted nodes
  if (node.metadata.deleted) {
    return '';
  }

  let markdown = '';

  // Get ASCII status symbol
  const status = node.metadata.status || 'pending';
  const statusSymbol = ASCII_STATUS_SYMBOLS[status];

  const headingPrefix = createHeadingPrefix(depth);

  // Format current node content
  if (node.content && node.content.trim()) {
    const contentLines = node.content.split('\n');
    contentLines.forEach((line, index) => {
      if (index === 0) {
        // First line as heading with status symbol
        markdown += `${headingPrefix} ${statusSymbol} ${line}\n`;
      } else {
        // Subsequent lines as plain text (preserve multi-line content)
        markdown += `${line}\n`;
      }
    });
  }

  // Export children recursively
  if (node.children && node.children.length > 0) {
    node.children.forEach((childId: string) => {
      const childNode = nodes[childId];
      if (childNode) {
        markdown += exportNodeAsMarkdown(childNode, nodes, depth + 1);
      }
    });
  }

  return markdown;
}

/**
 * Exports multiple nodes as markdown, each starting at depth 0.
 * Used for multi-selection cut/copy where selected nodes become siblings.
 *
 * @param nodeIds - Array of node IDs to export (should be root-level selections, not descendants)
 * @param nodes - Map of all nodes
 * @returns Markdown string with all nodes as top-level siblings
 */
export function exportMultipleNodesAsMarkdown(nodeIds: string[], nodes: NodesMap): string {
  return nodeIds
    .map((nodeId) => {
      const node = nodes[nodeId];
      if (!node) return '';
      return exportNodeAsMarkdown(node, nodes, 0);
    })
    .filter((md) => md.length > 0)
    .join('');
}

// ============================================================================
// Parse Functions
// ============================================================================

interface ParsedLine {
  depth: number;
  status: NodeStatus;
  content: string;
}

/**
 * Parse a markdown line to extract depth (from heading level), status, and content
 * Format: # ☐ Content (depth 0), ## ☐ Content (depth 1), etc.
 */
function parseLine(line: string): ParsedLine | null {
  const trimmedLine = line.trim();

  // Check if line starts with markdown heading
  const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
  if (!headingMatch) {
    // Not a heading line, skip
    return null;
  }

  const headingLevel = headingMatch[1].length;
  const depth = headingLevel - 1; // # = depth 0, ## = depth 1, etc.
  const remainder = headingMatch[2];

  // Check if remainder starts with a status symbol
  let status: NodeStatus = 'pending';
  let content = '';

  // Find which status symbol matches (Unicode symbols)
  let foundStatus = false;
  for (const [key, symbol] of Object.entries(STATUS_SYMBOLS)) {
    if (remainder.startsWith(symbol)) {
      status = key as NodeStatus;
      // Remove status symbol and leading space
      content = remainder.substring(symbol.length).trim();
      foundStatus = true;
      break;
    }
  }

  // Also check for ASCII checkbox syntax: [ ], [x], [X], [-]
  if (!foundStatus) {
    const checkboxMatch = remainder.match(/^\[([xX -])\]\s*(.*)/);
    if (checkboxMatch) {
      const checkMark = checkboxMatch[1];
      if (checkMark === ' ') {
        status = 'pending';
      } else if (checkMark === '-') {
        status = 'failed';
      } else {
        status = 'completed';
      }
      content = checkboxMatch[2].trim();
      foundStatus = true;
    }
  }

  // If no status symbol found, use the whole remainder as content
  if (!foundStatus) {
    content = remainder.trim();
  }

  // Skip empty content
  if (content === '') {
    return null;
  }

  return { depth, status, content };
}

export interface ParsedMarkdownResult {
  rootNodes: TreeNode[];
  allNodes: Record<string, TreeNode>;
}

/**
 * Parse markdown content back into tree nodes
 * Returns root nodes array and a map of all nodes (including children)
 */
export function parseMarkdown(markdown: string): ParsedMarkdownResult {
  // Strip code block markers if present (```markdown or ``` at start/end)
  let content = markdown.trim();
  if (content.startsWith('```')) {
    // Remove opening code fence (and optional language specifier)
    content = content.replace(/^```[a-z]*\n?/i, '');
    // Remove closing code fence
    content = content.replace(/\n?```\s*$/, '');
  }

  const lines = content.split('\n');
  const rootNodes: TreeNode[] = [];
  const allNodes: Record<string, TreeNode> = {};
  const stack: { node: TreeNode; depth: number }[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);

    if (!parsed) {
      // This might be a continuation line for multi-line content
      // For now, we'll skip it - the user can handle multi-line manually
      continue;
    }

    const { depth, status, content } = parsed;

    // Create new node
    const newNode: TreeNode = {
      id: uuidv4(),
      content,
      children: [],
      metadata: {
        status,
        expanded: true,
        deleted: false,
        plugins: {},
      },
    };

    // Add to allNodes map
    allNodes[newNode.id] = newNode;

    // Find parent based on depth
    if (depth === 0) {
      // Root level node
      rootNodes.push(newNode);
      stack.length = 0;
      stack.push({ node: newNode, depth: 0 });
    } else {
      // Find the parent - it should be the last node with depth = currentDepth - 1
      let parent: TreeNode | null = null;

      // Pop stack until we find the correct parent
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }

      if (stack.length > 0) {
        parent = stack[stack.length - 1].node;
      }

      if (parent) {
        parent.children.push(newNode.id);
      } else {
        // No parent found, treat as root
        rootNodes.push(newNode);
      }

      stack.push({ node: newNode, depth });
    }
  }

  return { rootNodes, allNodes };
}
