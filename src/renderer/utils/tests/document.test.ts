import { describe, it, expect } from 'vitest';
import { createArboFile, extractBlueprintNodes } from '../document';
import type { TreeNode } from '@shared/types';

describe('document utils', () => {
  describe('extractBlueprintNodes', () => {
    it('should extract only blueprint nodes from tree', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'Root',
          children: ['child1', 'child2'],
          metadata: { isBlueprint: true },
        },
        child1: {
          id: 'child1',
          content: 'Child 1',
          children: ['grandchild1'],
          metadata: { isBlueprint: true },
        },
        child2: {
          id: 'child2',
          content: 'Child 2 (not blueprint)',
          children: [],
          metadata: {},
        },
        grandchild1: {
          id: 'grandchild1',
          content: 'Grandchild 1',
          children: [],
          metadata: { isBlueprint: true },
        },
      };

      const result = extractBlueprintNodes(nodes, 'root');

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['root']).toBeDefined();
      expect(result['child1']).toBeDefined();
      expect(result['grandchild1']).toBeDefined();
      expect(result['child2']).toBeUndefined();
    });

    it('should preserve content from extracted nodes', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'This content should be preserved',
          children: [],
          metadata: { isBlueprint: true },
        },
      };

      const result = extractBlueprintNodes(nodes, 'root');

      expect(result['root'].content).toBe('This content should be preserved');
    });

    it('should filter out non-blueprint children from children array', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'Root',
          children: ['child1', 'child2'],
          metadata: { isBlueprint: true },
        },
        child1: {
          id: 'child1',
          content: 'Blueprint child',
          children: [],
          metadata: { isBlueprint: true },
        },
        child2: {
          id: 'child2',
          content: 'Non-blueprint child',
          children: [],
          metadata: {},
        },
      };

      const result = extractBlueprintNodes(nodes, 'root');

      expect(result['root'].children).toEqual(['child1']);
      expect(result['root'].children).not.toContain('child2');
    });

    it('should return empty object when root is not a blueprint', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'Root',
          children: [],
          metadata: {},
        },
      };

      const result = extractBlueprintNodes(nodes, 'root');

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('createArboFile', () => {
    it('should create file without isBlueprint by default', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'Root',
          children: [],
          metadata: {},
        },
      };

      const file = createArboFile(nodes, 'root');

      expect(file.isBlueprint).toBeUndefined();
    });

    it('should create file with isBlueprint when flag is true', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'Root',
          children: [],
          metadata: {},
        },
      };

      const file = createArboFile(nodes, 'root', undefined, true);

      expect(file.isBlueprint).toBe(true);
    });

    it('should not include isBlueprint when flag is false', () => {
      const nodes: Record<string, TreeNode> = {
        root: {
          id: 'root',
          content: 'Root',
          children: [],
          metadata: {},
        },
      };

      const file = createArboFile(nodes, 'root', undefined, false);

      expect(file.isBlueprint).toBeUndefined();
    });
  });
});
