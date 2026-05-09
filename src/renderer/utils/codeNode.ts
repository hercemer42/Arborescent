import { TreeNode } from '@shared/types';
import { AncestorRegistry } from './ancestry';
import { getAppliedContextIdWithInheritance } from './nodeHelpers';

const TRIPLE_FENCE = '```';
const LANG_HINT_PATTERN = /^[a-zA-Z0-9_-]*$/;

function extractFromTripleFence(trimmed: string): string | null {
  if (!trimmed.startsWith(TRIPLE_FENCE) || !trimmed.endsWith(TRIPLE_FENCE)) return null;
  if (trimmed.length < TRIPLE_FENCE.length * 2) return null;

  let inner = trimmed.slice(TRIPLE_FENCE.length, -TRIPLE_FENCE.length);

  const firstNewline = inner.indexOf('\n');
  if (firstNewline !== -1) {
    const firstLine = inner.slice(0, firstNewline);
    if (LANG_HINT_PATTERN.test(firstLine)) {
      inner = inner.slice(firstNewline + 1);
    }
    if (inner.endsWith('\n')) {
      inner = inner.slice(0, -1);
    }
  }

  return inner.trim() ? inner : null;
}

function extractFromSingleBacktickWrapper(trimmed: string): string | null {
  if (!trimmed.startsWith('`') || !trimmed.endsWith('`')) return null;
  if (trimmed.length < 2) return null;

  const inner = trimmed.slice(1, -1);
  if (inner.includes('`')) return null;
  return inner.trim() ? inner : null;
}

export function extractWrappedCommand(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return extractFromTripleFence(trimmed) ?? extractFromSingleBacktickWrapper(trimmed);
}

function isSingleWrappedSpan(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith(TRIPLE_FENCE) && trimmed.endsWith(TRIPLE_FENCE)
      && trimmed.length >= TRIPLE_FENCE.length * 2) {
    const inner = trimmed.slice(TRIPLE_FENCE.length, -TRIPLE_FENCE.length);
    return !inner.includes(TRIPLE_FENCE);
  }

  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    const inner = trimmed.slice(1, -1);
    return !inner.includes('`');
  }

  return false;
}

export function isCodeCommandNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
): boolean {
  const node = nodes[nodeId];
  if (!node) return false;
  if (node.children.length > 0) return false;
  if (getAppliedContextIdWithInheritance(nodeId, nodes, ancestorRegistry)) return false;
  return extractWrappedCommand(node.content) !== null;
}

export type TerminalSendRoute =
  | { kind: 'skip' }
  | { kind: 'execute'; command: string }
  | { kind: 'send-markdown' };

export function classifyTerminalSend(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  options: { isMultiSelect: boolean },
): TerminalSendRoute {
  const node = nodes[nodeId];
  if (!node) return { kind: 'send-markdown' };

  const content = node.content ?? '';
  if (!content.trim()) return { kind: 'skip' };

  if (options.isMultiSelect) return { kind: 'send-markdown' };

  if (node.children.length > 0) return { kind: 'send-markdown' };
  if (getAppliedContextIdWithInheritance(nodeId, nodes, ancestorRegistry)) {
    return { kind: 'send-markdown' };
  }

  const command = extractWrappedCommand(content);
  if (command) return { kind: 'execute', command };

  if (isSingleWrappedSpan(content)) return { kind: 'skip' };

  return { kind: 'send-markdown' };
}
