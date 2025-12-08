import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlueprintCommand } from '../BlueprintCommand';
import { TreeNode } from '../../../../../shared/types';
import { AncestorRegistry } from '../../../../services/ancestry';

describe('BlueprintCommand', () => {
  let nodes: Record<string, TreeNode>;
  let ancestorRegistry: AncestorRegistry;
  let getNodes: () => Record<string, TreeNode>;
  let getRootNodeId: () => string;
  let getAncestorRegistry: () => AncestorRegistry;
  let setNodes: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;
  let refreshContextDeclarations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['node1', 'node2'],
        metadata: { isBlueprint: true },
      },
      node1: {
        id: 'node1',
        content: 'Node 1',
        children: ['child1'],
        metadata: { isBlueprint: true },
      },
      node2: {
        id: 'node2',
        content: 'Node 2',
        children: [],
        metadata: {},
      },
      child1: {
        id: 'child1',
        content: 'Child 1',
        children: [],
        metadata: { isBlueprint: true },
      },
    };

    ancestorRegistry = {
      root: [],
      node1: ['root'],
      node2: ['root'],
      child1: ['root', 'node1'],
    };

    getNodes = () => nodes;
    getRootNodeId = () => 'root';
    getAncestorRegistry = () => ancestorRegistry;
    setNodes = vi.fn((updatedNodes) => {
      nodes = updatedNodes;
    });
    triggerAutosave = vi.fn();
    refreshContextDeclarations = vi.fn();
  });

  describe('remove action', () => {
    it('should clear appliedContextId when removing from blueprint', () => {
      // Set up a node with appliedContextId
      nodes.node1.metadata.appliedContextId = 'some-context-id';

      const cmd = new BlueprintCommand(
        'node1',
        'remove',
        false,
        getNodes,
        getRootNodeId,
        getAncestorRegistry,
        setNodes,
        triggerAutosave,
        refreshContextDeclarations
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.node1.metadata.isBlueprint).toBe(false);
      expect(updatedNodes.node1.metadata.appliedContextId).toBeUndefined();
    });

    it('should clear appliedContextId from descendants when cascade removing', () => {
      // Set up nodes with appliedContextId
      nodes.node1.metadata.appliedContextId = 'context-1';
      nodes.child1.metadata.appliedContextId = 'context-2';

      const cmd = new BlueprintCommand(
        'node1',
        'remove',
        true, // cascade
        getNodes,
        getRootNodeId,
        getAncestorRegistry,
        setNodes,
        triggerAutosave,
        refreshContextDeclarations
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.node1.metadata.appliedContextId).toBeUndefined();
      expect(updatedNodes.child1.metadata.appliedContextId).toBeUndefined();
    });

    it('should clear appliedContextId from other nodes when context declaration is removed', () => {
      // Set up a context declaration
      nodes.node1.metadata.isContextDeclaration = true;
      nodes.node1.metadata.blueprintIcon = 'Star';

      // Another node has this context applied
      nodes.node2.metadata.isBlueprint = true;
      nodes.node2.metadata.appliedContextId = 'node1';

      const cmd = new BlueprintCommand(
        'node1',
        'remove',
        false,
        getNodes,
        getRootNodeId,
        getAncestorRegistry,
        setNodes,
        triggerAutosave,
        refreshContextDeclarations
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      // The context declaration is removed
      expect(updatedNodes.node1.metadata.isContextDeclaration).toBe(false);
      // The appliedContextId on node2 should be cleared since it referenced the removed context
      expect(updatedNodes.node2.metadata.appliedContextId).toBeUndefined();
    });

    it('should restore appliedContextId on undo', () => {
      nodes.node1.metadata.appliedContextId = 'some-context-id';

      const cmd = new BlueprintCommand(
        'node1',
        'remove',
        false,
        getNodes,
        getRootNodeId,
        getAncestorRegistry,
        setNodes,
        triggerAutosave,
        refreshContextDeclarations
      );

      cmd.execute();
      expect(nodes.node1.metadata.appliedContextId).toBeUndefined();

      setNodes.mockClear();
      cmd.undo();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.node1.metadata.isBlueprint).toBe(true);
      expect(updatedNodes.node1.metadata.appliedContextId).toBe('some-context-id');
    });

    it('should clear blueprint metadata but preserve appliedContextId on other blueprint nodes', () => {
      // node1 and node2 both have appliedContextId, but we only remove node1 from blueprint
      nodes.node1.metadata.appliedContextId = 'context-1';
      nodes.node2.metadata.isBlueprint = true;
      nodes.node2.metadata.appliedContextId = 'context-2';

      const cmd = new BlueprintCommand(
        'node1',
        'remove',
        false,
        getNodes,
        getRootNodeId,
        getAncestorRegistry,
        setNodes,
        triggerAutosave,
        refreshContextDeclarations
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      // node1's appliedContextId should be cleared
      expect(updatedNodes.node1.metadata.appliedContextId).toBeUndefined();
      // node2's appliedContextId should be preserved (different context)
      expect(updatedNodes.node2.metadata.appliedContextId).toBe('context-2');
    });
  });

  describe('add action', () => {
    it('should not affect appliedContextId when adding to blueprint', () => {
      // Start with a non-blueprint node that has no appliedContextId
      nodes.node2.metadata = {};

      const cmd = new BlueprintCommand(
        'node2',
        'add',
        false,
        getNodes,
        getRootNodeId,
        getAncestorRegistry,
        setNodes,
        triggerAutosave,
        refreshContextDeclarations
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.node2.metadata.isBlueprint).toBe(true);
      expect(updatedNodes.node2.metadata.appliedContextId).toBeUndefined();
    });
  });
});
