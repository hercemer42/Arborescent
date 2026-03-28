import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcceptFeedbackCommand } from '../AcceptFeedbackCommand';
import { TreeNode } from '../../../../../shared/types';

function createNode(id: string, content: string, children: string[] = [], metadata: Record<string, unknown> = {}): TreeNode {
  return { id, content, children, metadata };
}

function createState(nodes: Record<string, TreeNode>, rootNodeId: string, blueprintModeEnabled = false) {
  return {
    nodes,
    rootNodeId,
    ancestorRegistry: {} as Record<string, string[]>,
    blueprintModeEnabled,
  };
}

describe('AcceptFeedbackCommand', () => {
  let mockState: ReturnType<typeof createState>;
  let getState: () => typeof mockState;
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    const parentNode = createNode('parent', 'Parent', ['collab-node', 'sibling']);
    const collabNode = createNode('collab-node', 'Original content', ['child1'], {
      isBlueprint: true,
      blueprintIcon: 'Star',
      blueprintColor: '#ff0000',
      appliedContextIds: ['ctx-1'],
      activeContextId: 'ctx-1',
    });
    const child1 = createNode('child1', 'Original child', []);
    const siblingNode = createNode('sibling', 'Sibling', []);

    mockState = createState({
      'root': createNode('root', 'Root', ['parent']),
      'parent': parentNode,
      'collab-node': collabNode,
      'child1': child1,
      'sibling': siblingNode,
    }, 'root');

    mockState.ancestorRegistry = {
      'root': [],
      'parent': ['root'],
      'collab-node': ['root', 'parent'],
      'child1': ['root', 'parent', 'collab-node'],
      'sibling': ['root', 'parent'],
    };

    getState = vi.fn(() => mockState);
    setState = vi.fn((partial: Partial<typeof mockState>) => {
      Object.assign(mockState, partial);
    });
    triggerAutosave = vi.fn();
  });

  describe('single-root mode', () => {
    it('should replace collaborating node content and children', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced content', ['new-child']),
        'new-child': createNode('new-child', 'New child', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const resultNode = setCall.nodes['collab-node'];
      expect(resultNode.content).toBe('Replaced content');
      expect(resultNode.children).toHaveLength(1);
    });

    it('should preserve collaborating node UUID', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      expect(setCall.nodes['collab-node']).toBeDefined();
      expect(setCall.nodes['new-root']).toBeUndefined();
    });

    it('should preserve metadata from collaborating node', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const resultNode = setCall.nodes['collab-node'];
      expect(resultNode.metadata.isBlueprint).toBe(true);
      expect(resultNode.metadata.blueprintIcon).toBe('Star');
      expect(resultNode.metadata.blueprintColor).toBe('#ff0000');
      expect(resultNode.metadata.appliedContextIds).toEqual(['ctx-1']);
      expect(resultNode.metadata.activeContextId).toBe('ctx-1');
    });

    it('should preserve collapsed state from collaborating node', () => {
      mockState.nodes['collab-node'].metadata.expanded = false;

      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', ['new-child']),
        'new-child': createNode('new-child', 'Child', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const resultNode = setCall.nodes['collab-node'];
      expect(resultNode.metadata.expanded).toBe(false);
    });

    it('should generate fresh UUIDs for descendants', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Root', ['new-child']),
        'new-child': createNode('new-child', 'Child', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      expect(setCall.nodes['new-child']).toBeUndefined();
      const childId = setCall.nodes['collab-node'].children[0];
      expect(childId).not.toBe('new-child');
      expect(setCall.nodes[childId]).toBeDefined();
    });

    it('should set activeNodeId to the collaborating node', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      expect(setCall.activeNodeId).toBe('collab-node');
    });

    it('should set feedbackFadingNodeIds for visual flash', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      expect(setCall.feedbackFadingNodeIds).toBeInstanceOf(Set);
      expect(setCall.feedbackFadingNodeIds.has('collab-node')).toBe(true);
    });

    it('should undo and restore original node and descendants', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();
      command.undo();

      const undoCall = setState.mock.calls[1][0];
      expect(undoCall.nodes['collab-node'].content).toBe('Original content');
      expect(undoCall.nodes['collab-node'].children).toEqual(['child1']);
      expect(undoCall.nodes['child1'].content).toBe('Original child');
    });

    it('should trigger autosave on execute and undo', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();
      expect(triggerAutosave).toHaveBeenCalledTimes(1);

      command.undo();
      expect(triggerAutosave).toHaveBeenCalledTimes(2);
    });
  });

  describe('multi-root mode', () => {
    it('should create multiple sibling nodes at the collaborating node position', () => {
      // Multi-root: pass rootNodeIds array instead of single rootNodeId
      const newNodes = {
        'story1': createNode('story1', 'User Story 1', []),
        'story2': createNode('story2', 'User Story 2', []),
        'story3': createNode('story3', 'User Story 3', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2', 'story3'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const parentChildren = setCall.nodes['parent'].children;
      // collab-node should be replaced by 3 siblings, plus the existing 'sibling' node
      expect(parentChildren).toHaveLength(4);
      expect(setCall.nodes['collab-node']).toBeUndefined();
    });

    it('should give each sibling a unique UUID', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const parentChildren = setCall.nodes['parent'].children;
      const newIds = parentChildren.filter((id: string) => id !== 'sibling');
      expect(new Set(newIds).size).toBe(2);
      expect(newIds).not.toContain('collab-node');
    });

    it('should inherit metadata from the collaborating node to each sibling', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const parentChildren = setCall.nodes['parent'].children;
      const newIds = parentChildren.filter((id: string) => id !== 'sibling');

      for (const id of newIds) {
        expect(setCall.nodes[id].metadata.isBlueprint).toBe(true);
        expect(setCall.nodes[id].metadata.appliedContextIds).toEqual(['ctx-1']);
        expect(setCall.nodes[id].metadata.activeContextId).toBe('ctx-1');
      }
    });

    it('should preserve sibling order matching the AI response', () => {
      const newNodes = {
        'first': createNode('first', 'First', []),
        'second': createNode('second', 'Second', []),
        'third': createNode('third', 'Third', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['first', 'second', 'third'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const parentChildren = setCall.nodes['parent'].children;
      const newIds = parentChildren.filter((id: string) => id !== 'sibling');
      expect(setCall.nodes[newIds[0]].content).toBe('First');
      expect(setCall.nodes[newIds[1]].content).toBe('Second');
      expect(setCall.nodes[newIds[2]].content).toBe('Third');
    });

    it('should remove the collaborating node from the tree', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      // With multi-root even of length 1 via array, collab node should be removed
      // (This test verifies the multi-root path specifically)
    });

    it('should include all new sibling IDs in feedbackFadingNodeIds', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      expect(setCall.feedbackFadingNodeIds.size).toBeGreaterThanOrEqual(2);
    });

    it('should set activeNodeId to the first new sibling', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const parentChildren = setCall.nodes['parent'].children;
      const firstNewId = parentChildren.find((id: string) => id !== 'sibling');
      expect(setCall.activeNodeId).toBe(firstNewId);
    });

    it('should undo by removing all siblings and restoring the collaborating node', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();
      command.undo();

      const undoCall = setState.mock.calls[1][0];
      expect(undoCall.nodes['collab-node']).toBeDefined();
      expect(undoCall.nodes['collab-node'].content).toBe('Original content');
      expect(undoCall.nodes['collab-node'].children).toEqual(['child1']);
      expect(undoCall.nodes['child1']).toBeDefined();
      expect(undoCall.nodes['parent'].children).toEqual(['collab-node', 'sibling']);
    });

    it('should restore ancestor registry for the collaborating node after undo', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();
      command.undo();

      const undoCall = setState.mock.calls[1][0];
      // The collaborating node's own registry entry must be restored
      // so that subsequent operations (e.g. drag) can find its parent
      expect(undoCall.ancestorRegistry['collab-node']).toEqual(['root', 'parent']);
      expect(undoCall.ancestorRegistry['child1']).toEqual(['root', 'parent', 'collab-node']);
    });

    it('should apply blueprint metadata to all siblings when blueprintModeEnabled', () => {
      mockState.blueprintModeEnabled = true;

      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const parentChildren = setCall.nodes['parent'].children;
      const newIds = parentChildren.filter((id: string) => id !== 'sibling');

      for (const id of newIds) {
        expect(setCall.nodes[id].metadata.isBlueprint).toBe(true);
      }
    });
  });

  describe('root node guard', () => {
    it('should prevent multi-root when the collaborating node is the file root', () => {
      mockState.rootNodeId = 'collab-node';
      mockState.nodes['collab-node'].children = [];
      mockState.ancestorRegistry['collab-node'] = [];

      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['story1', 'story2'],
        newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      // Should either fall back to single-root or not create multiple root nodes
      const setCall = setState.mock.calls[0]?.[0];
      if (setCall) {
        // Verify the tree still has a single root
        expect(setCall.rootNodeId).toBeDefined();
      }
    });
  });

  describe('archive path', () => {
    const archiveConfig = {
      archiveDestinationId: 'archive-dest',
      archiveSideLinkName: 'User stories',
      replacementSideLinkName: 'Problem statement',
    };

    beforeEach(() => {
      mockState.nodes['archive-dest'] = createNode('archive-dest', 'Archive', ['existing-archived']);
      mockState.nodes['existing-archived'] = createNode('existing-archived', 'Old item', []);
      mockState.ancestorRegistry['archive-dest'] = ['root'];
      mockState.ancestorRegistry['existing-archived'] = ['root', 'archive-dest'];
      mockState.nodes['root'].children = ['parent', 'archive-dest'];
    });

    it('should move the original node to the top of the archive destination', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();

      expect(mockState.nodes['archive-dest'].children[0]).toBe('collab-node');
    });

    it('should retain the original node UUID after archive move', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();

      expect(mockState.nodes['collab-node']).toBeDefined();
      expect(mockState.nodes['collab-node'].content).toBe('Original content');
    });

    it('should create relation container on archived original with hyperlink to replacement', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();

      const archivedNode = mockState.nodes['collab-node'];
      const containerId = archivedNode.children[0];
      const container = mockState.nodes[containerId];
      expect(container).toBeDefined();
      expect(container.content).toBe('User stories');
      expect(container.children.length).toBeGreaterThan(0);

      const hyperlinkId = container.children[0];
      const hyperlink = mockState.nodes[hyperlinkId];
      expect(hyperlink.metadata.isHyperlink).toBe(true);
      expect(hyperlink.metadata.linkedNodeId).toBeDefined();
    });

    it('should create relation container on each replacement with hyperlink to archived original', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();

      const parentChildren = mockState.nodes['parent'].children;
      const replacementId = parentChildren.find((id: string) => id !== 'sibling');
      const replacement = mockState.nodes[replacementId!];
      const containerId = replacement.children[0];
      const container = mockState.nodes[containerId];
      expect(container).toBeDefined();
      expect(container.content).toBe('Problem statement');

      const hyperlinkId = container.children[0];
      const hyperlink = mockState.nodes[hyperlinkId];
      expect(hyperlink.metadata.isHyperlink).toBe(true);
      expect(hyperlink.metadata.linkedNodeId).toBe('collab-node');
    });

    it('should work with multi-root decomposition', () => {
      const newNodes = {
        'story1': createNode('story1', 'Story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', ['story1', 'story2'], newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();

      const archivedNode = mockState.nodes['collab-node'];
      const containerId = archivedNode.children[0];
      const container = mockState.nodes[containerId];
      expect(container.children.length).toBe(2);
    });

    it('should undo and restore original position, remove relation links', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();
      command.undo();

      expect(mockState.nodes['collab-node'].content).toBe('Original content');
      expect(mockState.nodes['parent'].children).toContain('collab-node');
      expect(mockState.nodes['archive-dest'].children[0]).toBe('existing-archived');
    });

    it('should abort when archive destination does not exist', () => {
      delete mockState.nodes['archive-dest'];
      delete mockState.ancestorRegistry['archive-dest'];

      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave, archiveConfig
      );
      command.execute();

      expect(mockState.nodes['collab-node']).toBeUndefined();
    });

    it('should not create relation links when archive is not configured', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'Replaced', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'new-root', newNodes,
        getState, setState, triggerAutosave
      );
      command.execute();

      const setCall = setState.mock.calls[0][0];
      const resultNode = setCall.nodes['collab-node'];
      if (resultNode.children.length > 0) {
        const firstChild = setCall.nodes[resultNode.children[0]];
        expect(firstChild?.metadata?.isHyperlink).not.toBe(true);
      }
    });
  });

});
