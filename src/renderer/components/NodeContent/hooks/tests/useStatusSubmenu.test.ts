import { describe, it, expect, vi } from 'vitest';
import { buildStatusSubmenu } from '../useStatusSubmenu';
import { TreeNode } from '../../../../../shared/types';

describe('buildStatusSubmenu', () => {
  const createNode = (overrides: Partial<TreeNode> = {}): TreeNode => ({
    id: 'test-node',
    content: 'Test content',
    children: ['child1'],
    metadata: {},
    ...overrides,
  });

  const defaultHandlers = {
    onMarkAllAsComplete: vi.fn(),
    onMarkAllAsIncomplete: vi.fn(),
  };

  describe('visibility conditions', () => {
    it('should return null for blueprint nodes', () => {
      const node = createNode({
        metadata: { isBlueprint: true },
      });

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      expect(result).toBeNull();
    });

    it('should return null for hyperlink nodes', () => {
      const node = createNode({
        metadata: { isHyperlink: true },
      });

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      expect(result).toBeNull();
    });

    it('should return null for external link nodes', () => {
      const node = createNode({
        metadata: { isExternalLink: true },
      });

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      expect(result).toBeNull();
    });

    it('should return null for nodes without children', () => {
      const node = createNode({
        children: [],
      });

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      expect(result).toBeNull();
    });

    it('should return submenu for regular nodes with children', () => {
      const node = createNode();

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      expect(result).not.toBeNull();
      expect(result?.label).toBe('Status');
    });
  });

  describe('submenu structure', () => {
    it('should have two menu items', () => {
      const node = createNode();

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      expect(result?.submenu).toHaveLength(2);
    });

    it('should have "Mark all as complete" option', () => {
      const node = createNode();

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      const completeItem = result?.submenu?.find(
        (item) => item.label === 'Mark all as complete'
      );
      expect(completeItem).toBeDefined();
    });

    it('should have "Mark all as incomplete" option', () => {
      const node = createNode();

      const result = buildStatusSubmenu({
        node,
        ...defaultHandlers,
      });

      const incompleteItem = result?.submenu?.find(
        (item) => item.label === 'Mark all as incomplete'
      );
      expect(incompleteItem).toBeDefined();
    });
  });

  describe('callbacks', () => {
    it('should call onMarkAllAsComplete when complete option is clicked', () => {
      const node = createNode();
      const onMarkAllAsComplete = vi.fn();

      const result = buildStatusSubmenu({
        node,
        onMarkAllAsComplete,
        onMarkAllAsIncomplete: vi.fn(),
      });

      const completeItem = result?.submenu?.find(
        (item) => item.label === 'Mark all as complete'
      );
      completeItem?.onClick?.();

      expect(onMarkAllAsComplete).toHaveBeenCalled();
    });

    it('should call onMarkAllAsIncomplete when incomplete option is clicked', () => {
      const node = createNode();
      const onMarkAllAsIncomplete = vi.fn();

      const result = buildStatusSubmenu({
        node,
        onMarkAllAsComplete: vi.fn(),
        onMarkAllAsIncomplete,
      });

      const incompleteItem = result?.submenu?.find(
        (item) => item.label === 'Mark all as incomplete'
      );
      incompleteItem?.onClick?.();

      expect(onMarkAllAsIncomplete).toHaveBeenCalled();
    });
  });
});
