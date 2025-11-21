import { TreeNode, NodeStatus, STATUS_SYMBOLS } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface ParsedLine {
  depth: number;
  status: NodeStatus;
  content: string;
}

/**
 * Parse a markdown line to extract depth, status, and content
 */
function parseLine(line: string): ParsedLine | null {
  // Count leading spaces (2 spaces = 1 depth level)
  const leadingSpaces = line.match(/^ */)?.[0].length || 0;
  const depth = Math.floor(leadingSpaces / 2);

  // Remove leading spaces
  const trimmedLine = line.trimStart();

  // Check if line starts with a status symbol
  let status: NodeStatus = 'pending';
  let content = '';

  // Find which status symbol matches
  for (const [key, symbol] of Object.entries(STATUS_SYMBOLS)) {
    if (trimmedLine.startsWith(symbol)) {
      status = key as NodeStatus;
      // Remove status symbol and leading space
      content = trimmedLine.substring(symbol.length).trim();
      break;
    }
  }

  // If no status symbol found and line has content, treat as continuation
  if (content === '' && trimmedLine.length > 0) {
    return null;
  }

  // Skip empty lines
  if (content === '') {
    return null;
  }

  return { depth, status, content };
}

/**
 * Parse markdown content back into tree nodes
 * Returns array of root nodes
 */
export function parseMarkdown(markdown: string): TreeNode[] {
  const lines = markdown.split('\n');
  const nodes: TreeNode[] = [];
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

    // Find parent based on depth
    if (depth === 0) {
      // Root level node
      nodes.push(newNode);
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
        nodes.push(newNode);
      }

      stack.push({ node: newNode, depth });
    }
  }

  return nodes;
}

/**
 * Create a flat map of nodes from a tree structure
 */
export function flattenNodes(nodes: TreeNode[]): Record<string, TreeNode> {
  const map: Record<string, TreeNode> = {};

  function traverse(node: TreeNode) {
    map[node.id] = node;
    if (node.children) {
      for (const childId of node.children) {
        const childNode = map[childId];
        if (childNode) {
          traverse(childNode);
        }
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return map;
}
