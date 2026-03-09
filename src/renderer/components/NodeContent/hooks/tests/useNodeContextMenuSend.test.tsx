import { describe, it, expect, vi } from 'vitest';
import { buildSendSubmenu } from '../useSendSubmenu';
import { TreeNode } from '../../../../../shared/types';
import { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

/**
 * Tests for the "Send" menu item integration.
 * Uses buildSendSubmenu directly rather than the full useNodeContextMenu hook
 * to avoid heavy mocking.
 */

describe('Send submenu integration', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  describe('Send menu item presence', () => {
    it('should produce a Send submenu for a regular node', () => {
      const node = createNode('test-node');
      const result = buildSendSubmenu({
        node,
        nodes: { 'test-node': node },
        ancestorRegistry: { 'test-node': [] },
        contextDeclarations: [],
        collaboratingNodeId: null,
        onSendInTerminal: vi.fn(),
        onSendInBrowser: vi.fn(),
        onSetActiveContext: vi.fn(),
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
    });

    it('should include context picker section with "Apply a context" heading', () => {
      const node = createNode('test-node');
      const result = buildSendSubmenu({
        node,
        nodes: { 'test-node': node },
        ancestorRegistry: { 'test-node': [] },
        contextDeclarations: [],
        collaboratingNodeId: null,
        onSendInTerminal: vi.fn(),
        onSendInBrowser: vi.fn(),
        onSetActiveContext: vi.fn(),
      });
      const heading = result.find(item => item.label === 'Apply a context');
      expect(heading).toBeDefined();
    });
  });

  describe('Send with context declarations', () => {
    it('should show user-declared contexts in the submenu', () => {
      const node = createNode('test-node');
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true, contextMode: 'collaborate' });
      const contextDeclarations: ContextDeclarationInfo[] = [
        { nodeId: 'ctx-1', content: 'My Context', icon: 'Star', mode: 'collaborate' },
      ];
      const result = buildSendSubmenu({
        node,
        nodes: { 'test-node': node, 'ctx-1': ctxNode },
        ancestorRegistry: { 'test-node': [] },
        contextDeclarations,
        collaboratingNodeId: null,
        onSendInTerminal: vi.fn(),
        onSendInBrowser: vi.fn(),
        onSetActiveContext: vi.fn(),
      });
      const ctxItem = result.find(item => item.label === 'My Context');
      expect(ctxItem).toBeDefined();
    });
  });

  describe('Cancel collaboration remains separate', () => {
    it('should not include cancel collaboration in the Send submenu', () => {
      const node = createNode('collab-node');
      const result = buildSendSubmenu({
        node,
        nodes: { 'collab-node': node },
        ancestorRegistry: { 'collab-node': [] },
        contextDeclarations: [],
        collaboratingNodeId: 'collab-node',
        onSendInTerminal: vi.fn(),
        onSendInBrowser: vi.fn(),
        onSetActiveContext: vi.fn(),
      });
      const cancelItem = result.find(item => item.label === 'Cancel collaboration');
      expect(cancelItem).toBeUndefined();
    });
  });
});
