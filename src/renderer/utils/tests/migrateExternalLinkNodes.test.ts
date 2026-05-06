import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../../shared/types';
import { migrateExternalLinkNodes } from '../migrateExternalLinkNodes';

function makeNode(overrides: Partial<TreeNode> & { id: string }): TreeNode {
  return {
    id: overrides.id,
    content: overrides.content ?? '',
    children: overrides.children ?? [],
    metadata: overrides.metadata ?? {},
  };
}

describe('migrateExternalLinkNodes', () => {
  it('strips isExternalLink and externalUrl while preserving content', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: 'https://example.com',
        metadata: {
          status: 'pending',
          isExternalLink: true,
          externalUrl: 'https://example.com',
        },
      }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.a.content).toBe('https://example.com');
    expect(result.a.metadata.isExternalLink).toBeUndefined();
    expect(result.a.metadata.externalUrl).toBeUndefined();
    expect(result.a.metadata.status).toBe('pending');
  });

  it('falls back to externalUrl when content is empty', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: '',
        metadata: { isExternalLink: true, externalUrl: 'https://fallback.example' },
      }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.a.content).toBe('https://fallback.example');
  });

  it('falls back to externalUrl when content is whitespace only', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: '   ',
        metadata: { isExternalLink: true, externalUrl: 'https://fallback.example' },
      }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.a.content).toBe('https://fallback.example');
  });

  it('leaves nodes without isExternalLink untouched', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: 'plain text',
        metadata: { status: 'pending' },
      }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.a).toEqual(input.a);
  });

  it('leaves internal hyperlink nodes (isHyperlink + linkedNodeId) untouched', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: 'pointer',
        metadata: { isHyperlink: true, linkedNodeId: 'target-1' },
      }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.a).toEqual(input.a);
    expect(result.a.metadata.isHyperlink).toBe(true);
    expect(result.a.metadata.linkedNodeId).toBe('target-1');
  });

  it('preserves all other metadata fields on a migrated node', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: 'https://example.com',
        metadata: {
          status: 'completed',
          expanded: false,
          isBlueprint: true,
          isExternalLink: true,
          externalUrl: 'https://example.com',
        },
      }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.a.metadata.status).toBe('completed');
    expect(result.a.metadata.expanded).toBe(false);
    expect(result.a.metadata.isBlueprint).toBe(true);
    expect(result.a.metadata.isExternalLink).toBeUndefined();
    expect(result.a.metadata.externalUrl).toBeUndefined();
  });

  it('is idempotent — running twice produces the same result', () => {
    const input = {
      a: makeNode({
        id: 'a',
        content: 'https://example.com',
        metadata: { isExternalLink: true, externalUrl: 'https://example.com' },
      }),
      b: makeNode({ id: 'b', content: 'plain', metadata: {} }),
    };

    const once = migrateExternalLinkNodes(input);
    const twice = migrateExternalLinkNodes(once);

    expect(twice).toEqual(once);
  });

  it('returns the original map reference when no migration is needed', () => {
    const input = {
      a: makeNode({ id: 'a', content: 'plain', metadata: {} }),
      b: makeNode({ id: 'b', content: 'pointer', metadata: { isHyperlink: true, linkedNodeId: 't' } }),
    };

    const result = migrateExternalLinkNodes(input);

    expect(result).toBe(input);
  });

  it('migrates only the affected nodes and copies-on-write the rest', () => {
    const untouched = makeNode({ id: 'b', content: 'plain', metadata: {} });
    const input = {
      a: makeNode({
        id: 'a',
        content: 'https://example.com',
        metadata: { isExternalLink: true, externalUrl: 'https://example.com' },
      }),
      b: untouched,
    };

    const result = migrateExternalLinkNodes(input);

    expect(result.b).toBe(untouched);
    expect(result.a).not.toBe(input.a);
  });
});
