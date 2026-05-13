import type { TreeNode } from '../../shared/types';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_PATTERN = /[\x00-\x1F\x7F]/g;

function stripControlChars(line: string): string {
  return line.replace(CONTROL_CHARS_PATTERN, '');
}

export function extractTaskTitle(node: TreeNode): string {
  const content = node.content ?? '';
  for (const line of content.split('\n')) {
    const cleaned = stripControlChars(line).trim();
    if (cleaned) return cleaned;
  }
  return '';
}
