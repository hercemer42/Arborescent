import { describe, it, expect } from 'vitest';
import {
  exportSelectionAsMarkdown,
  type SelectionResult,
} from '../clipboardHelpers';
import { createTreeNode } from '../../../../utils/nodeConstruction';
import type { TreeNode } from '../../../../../shared/types';

function singleSelection(nodeId: string): SelectionResult {
  return { type: 'single', nodeId };
}

function multiSelection(nodeIds: string[]): SelectionResult {
  return { type: 'multi', nodeIds };
}

function leaf(id: string, content: string): TreeNode {
  return createTreeNode(id, { content });
}

function parent(id: string, content: string, childIds: string[]): TreeNode {
  return createTreeNode(id, { content, children: childIds });
}

describe('exportSelectionAsMarkdown — single leaf as plain content', () => {
  it('returns content verbatim with no markdown chrome when leaf has title and body', () => {
    const node = leaf('a', 'Title\n\nBody');
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).toBe('Title\n\nBody');
  });

  it('does not prepend the # [ ] heading when copying a single leaf', () => {
    const node = leaf('a', 'Just a title');
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).not.toMatch(/^#\s*\[\s\]/);
  });

  it('does not append a trailing newline for a single leaf', () => {
    const node = leaf('a', 'Title\n\nBody');
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).not.toMatch(/\n$/);
  });

  it('returns just the title when leaf has only a title (no body)', () => {
    const node = leaf('a', 'Just a title');
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).toBe('Just a title');
  });

  it('preserves user-typed markdown inside the body verbatim', () => {
    const userTypedBody = 'Title\n\n# Their own heading\n- bullet one\n- bullet two';
    const node = leaf('a', userTypedBody);
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).toBe(userTypedBody);
  });

  it('does not strip a body that begins with a markdown-tree-shaped heading', () => {
    const trickyBody = 'Real title\n\n# [ ] not actually a node';
    const node = leaf('a', trickyBody);
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).toBe(trickyBody);
  });

  it('returns content verbatim when title contains internal whitespace', () => {
    const node = leaf('a', '  Padded title  \n\nBody');
    const nodes = { a: node };

    const result = exportSelectionAsMarkdown(singleSelection('a'), nodes);

    expect(result).toBe('  Padded title  \n\nBody');
  });

  it.todo('decides what to write to the clipboard for a leaf with empty content');

  it.todo('decides what to write when leaf content is only a body (e.g. starts with newlines)');
});

describe('exportSelectionAsMarkdown — single node WITH children keeps markdown-tree output', () => {
  it('produces the existing markdown-tree output for a single node that has children', () => {
    const child = leaf('child', 'Child');
    const root = parent('root', 'Root', ['child']);
    const nodes = { root, child };

    const result = exportSelectionAsMarkdown(singleSelection('root'), nodes);

    expect(result).toMatch(/^#\s+\[\s\]\s+Root/);
    expect(result).toContain('Child');
  });

  it('keeps the heading prefix and status symbol for a parent selection', () => {
    const child = leaf('child', 'Child');
    const root = parent('root', 'Root', ['child']);
    const nodes = { root, child };

    const result = exportSelectionAsMarkdown(singleSelection('root'), nodes);

    expect(result).toMatch(/#\s+\[\s\]\s+Root/);
    expect(result).toMatch(/##\s+\[\s\]\s+Child/);
  });
});

describe('exportSelectionAsMarkdown — multi-selection keeps markdown-tree output', () => {
  it('serializes multi-select as today, regardless of whether each is a leaf', () => {
    const a = leaf('a', 'A');
    const b = leaf('b', 'B');
    const nodes = { a, b };

    const result = exportSelectionAsMarkdown(multiSelection(['a', 'b']), nodes);

    expect(result).toMatch(/#\s+\[\s\]\s+A/);
    expect(result).toMatch(/#\s+\[\s\]\s+B/);
  });

  it('does not collapse a two-leaf multi-select into plain content', () => {
    const a = leaf('a', 'A');
    const b = leaf('b', 'B');
    const nodes = { a, b };

    const result = exportSelectionAsMarkdown(multiSelection(['a', 'b']), nodes);

    expect(result).not.toBe('A\n\nB');
    expect(result).not.toBe('AB');
  });
});

describe('exportSelectionAsMarkdown — degenerate selections', () => {
  it('returns null for selection.type === "none"', () => {
    const nodes = { a: leaf('a', 'A') };

    const result = exportSelectionAsMarkdown({ type: 'none' }, nodes);

    expect(result).toBeNull();
  });

  it('returns null when a single selection points at a missing node', () => {
    const nodes: Record<string, TreeNode> = {};

    const result = exportSelectionAsMarkdown(singleSelection('ghost'), nodes);

    expect(result).toBeNull();
  });
});
