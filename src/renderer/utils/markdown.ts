import { TreeNode, NodeStatus, STATUS_SYMBOLS } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { createTreeNode } from './nodeHelpers';

export type NodesMap = Record<string, TreeNode>;

const ASCII_STATUS_SYMBOLS: Record<NodeStatus, string> = {
  pending: '[ ]',
  completed: '[x]',
  abandoned: '[-]',
};

function createHeadingPrefix(depth: number): string {
  const headingLevel = Math.min(depth + 1, 6);
  return '#'.repeat(headingLevel);
}

export function exportNodeAsMarkdown(node: TreeNode, nodes: NodesMap, depth: number = 0): string {
  if (node.metadata.deleted) {
    return '';
  }

  let markdown = '';

  // Get ASCII status symbol
  const status = node.metadata.status || 'pending';
  const statusSymbol = ASCII_STATUS_SYMBOLS[status];

  const headingPrefix = createHeadingPrefix(depth);

  if (node.content && node.content.trim()) {
    const contentLines = node.content.split('\n');
    contentLines.forEach((line, index) => {
      if (index === 0) {
        markdown += `${headingPrefix} ${statusSymbol} ${line}\n`;
      } else {
        markdown += `${line}\n`;
      }
    });
  }

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

export function exportContextAsMarkdown(
  node: TreeNode,
  nodes: NodesMap,
  depth: number = 0,
  contextNodeId?: string
): string {
  if (node.metadata.deleted) {
    return '';
  }

  if (node.metadata.isHyperlink === true) {
    const linkedNodeId = node.metadata.linkedNodeId as string | undefined;
    if (linkedNodeId && nodes[linkedNodeId] && linkedNodeId !== contextNodeId) {
      return exportNodeAsMarkdown(nodes[linkedNodeId], nodes, depth);
    }
    return '';
  }

  let markdown = '';

  const status = node.metadata.status || 'pending';
  const statusSymbol = ASCII_STATUS_SYMBOLS[status];

  const headingPrefix = createHeadingPrefix(depth);

  if (node.content && node.content.trim()) {
    const contentLines = node.content.split('\n');
    contentLines.forEach((line, index) => {
      if (index === 0) {
        markdown += `${headingPrefix} ${statusSymbol} ${line}\n`;
      } else {
        markdown += `${line}\n`;
      }
    });
  }

  if (node.children && node.children.length > 0) {
    node.children.forEach((childId: string) => {
      const childNode = nodes[childId];
      if (childNode) {
        markdown += exportContextAsMarkdown(childNode, nodes, depth + 1, contextNodeId);
      }
    });
  }

  return markdown;
}

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

interface ParsedLine {
  depth: number;
  status: NodeStatus;
  content: string;
}

function parseLine(line: string): ParsedLine | null {
  const trimmedLine = line.trim();

  const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
  if (!headingMatch) {
    return null;
  }

  const headingLevel = headingMatch[1].length;
  const depth = headingLevel - 1; // # = depth 0, ## = depth 1, etc.
  const remainder = headingMatch[2];

  let status: NodeStatus = 'pending';
  let content = '';

  let foundStatus = false;
  for (const [key, symbol] of Object.entries(STATUS_SYMBOLS)) {
    if (remainder.startsWith(symbol)) {
      status = key as NodeStatus;
      content = remainder.substring(symbol.length).trim();
      foundStatus = true;
      break;
    }
  }

  if (!foundStatus) {
    const checkboxMatch = remainder.match(/^\[([xX -])\]\s*(.*)/);
    if (checkboxMatch) {
      const checkMark = checkboxMatch[1];
      if (checkMark === ' ') {
        status = 'pending';
      } else if (checkMark === '-') {
        status = 'abandoned';
      } else {
        status = 'completed';
      }
      content = checkboxMatch[2].trim();
      foundStatus = true;
    }
  }

  if (!foundStatus) {
    content = remainder.trim();
  }

  if (content === '') {
    return null;
  }

  return { depth, status, content };
}

export interface ParsedMarkdownResult {
  rootNodes: TreeNode[];
  allNodes: Record<string, TreeNode>;
}

export function parseMarkdown(markdown: string): ParsedMarkdownResult {
  let content = markdown.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-z]*\n?/i, '');
    content = content.replace(/\n?```\s*$/, '');
  }

  const lines = content.split('\n');
  const rootNodes: TreeNode[] = [];
  const allNodes: Record<string, TreeNode> = {};
  const stack: { node: TreeNode; depth: number }[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);

    if (!parsed) {
      continue;
    }

    const { depth, status, content } = parsed;

    const newNode = createTreeNode(uuidv4(), {
      content,
      metadata: {
        status,
        expanded: true,
        deleted: false,
        plugins: {},
      },
    });

    allNodes[newNode.id] = newNode;

    if (depth === 0) {
      rootNodes.push(newNode);
      stack.length = 0;
      stack.push({ node: newNode, depth: 0 });
    } else {
      let parent: TreeNode | null = null;

      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }

      if (stack.length > 0) {
        parent = stack[stack.length - 1].node;
      }

      if (parent) {
        parent.children.push(newNode.id);
      } else {
        rootNodes.push(newNode);
      }

      stack.push({ node: newNode, depth });
    }
  }

  return { rootNodes, allNodes };
}
