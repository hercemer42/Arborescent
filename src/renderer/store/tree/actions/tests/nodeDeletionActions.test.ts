import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeDeletionActions } from '../nodeDeletionActions';
import type { TreeNode, PendingProposalEntry, PendingProposalMap } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';
import type { ReviewMap } from '../../reviews';
import { feedbackTreeStore } from '../../../feedback/feedbackTreeStore';

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    clearForNode: vi.fn(),
  },
}));

const mockAddToast = vi.fn();
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

describe('nodeDeletionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId?: string | null;
    cursorPosition?: number;
    reviews?: ReviewMap;
    pendingProposals?: PendingProposalMap;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createNodeDeletionActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(feedbackTreeStore.clearForNode).mockClear();
    mockAddToast.mockClear();

    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      // Execute the command immediately in tests
      command.execute();
    });

    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['node-1', 'node-2'],
          metadata: {},
        },
        'node-1': {
          id: 'node-1',
          content: 'Task 1',
          children: ['node-3'],
          metadata: { status: 'pending' },
        },
        'node-2': {
          id: 'node-2',
          content: 'Task 2',
          children: [],
          metadata: { status: 'pending' },
        },
        'node-3': {
          id: 'node-3',
          content: 'Task 3',
          children: [],
          metadata: { status: 'pending' },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root', 'node-1'],
      },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createNodeDeletionActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      undefined,
      mockExecuteCommand
    );
  });

  describe('deleteNode', () => {
    it('should delete node without children and return true', () => {
      const result = actions.deleteNode('node-2');

      expect(result).toBe(true);
      expect(state.nodes['node-2']).toBeUndefined();
      expect(state.nodes['root'].children).toEqual(['node-1']);
    });

    it('should return false when node has children and not confirmed', () => {
      const result = actions.deleteNode('node-1');

      expect(result).toBe(false);
      expect(state.nodes['node-1']).toBeDefined();
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-2']);
    });

    it('should delete node with children when confirmed', () => {
      const result = actions.deleteNode('node-1', true);

      expect(result).toBe(true);
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['node-3']).toBeUndefined(); // Child should also be deleted
      expect(state.nodes['root'].children).toEqual(['node-2']);
    });

    it('should clear content when deleting last root-level child', () => {
      // Set up a scenario with only one child under root
      state.nodes = {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['last-child'],
          metadata: {},
        },
        'last-child': {
          id: 'last-child',
          content: 'Last child',
          children: [],
          metadata: {},
        },
      };
      state.ancestorRegistry = {
        'root': [],
        'last-child': ['root'],
      };

      // Delete the last child - should just clear its content
      const result = actions.deleteNode('last-child');

      expect(result).toBe(true);
      expect(state.nodes['last-child']).toBeDefined();
      expect(state.nodes['last-child'].content).toBe('');
      expect(state.nodes['root'].children).toEqual(['last-child']);
    });

    it('should return true when node does not exist', () => {
      const result = actions.deleteNode('non-existent');

      expect(result).toBe(true);
    });

    it('should select previous node after deletion', () => {
      actions.deleteNode('node-2');

      // Should select node-3 (deepest previous node in tree)
      // This is correct as findPreviousNode returns the deepest last descendant
      expect(state.activeNodeId).toBe('node-3');
    });

    it('should recursively delete all descendants', () => {
      // node-1 has node-3 as a child
      const result = actions.deleteNode('node-1', true);

      expect(result).toBe(true);
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['node-3']).toBeUndefined();
      expect(state.nodes['root'].children).toEqual(['node-2']);
    });

    it('should discard a review living inside the deleted subtree', () => {
      // node-3 (a descendant of node-1) is under review with a pending proposition. node-2 (a
      // surviving sibling outside the deleted subtree) is ALSO under review and must be left
      // untouched — discarding one review region affects no other pending proposition.
      const makeProposal = (id: string, reviewedNodeId: string): PendingProposalEntry => ({
        id,
        capturedAt: '2026-06-07T00:00:00.000Z',
        reviewedNodeId,
        rootNodeId: 'proposal-root',
        nodes: {
          'proposal-root': {
            id: 'proposal-root',
            content: 'Proposed change',
            children: [],
            metadata: {},
          },
        },
      });
      state.reviews = {
        'node-3': { source: 'terminal', terminalId: null },
        'node-2': { source: 'terminal', terminalId: null },
      };
      state.pendingProposals = {
        'node-3': makeProposal('proposal-1', 'node-3'),
        'node-2': makeProposal('proposal-2', 'node-2'),
      };

      // Deleting the parent (node-1) must take its in-review descendant down with it.
      const result = actions.deleteNode('node-1', true);

      expect(result).toBe(true);
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['node-3']).toBeUndefined();
      expect(state.reviews).not.toHaveProperty('node-3');
      expect(state.pendingProposals).not.toHaveProperty('node-3');
      expect(feedbackTreeStore.clearForNode).toHaveBeenCalledWith('node-3');

      // The unrelated sibling review is unaffected.
      expect(state.reviews).toHaveProperty('node-2');
      expect(state.pendingProposals).toHaveProperty('node-2');
      expect(feedbackTreeStore.clearForNode).not.toHaveBeenCalledWith('node-2');
    });

    it('should refuse to delete a node that is itself in review and warn the user', () => {
      // The target node (not a descendant) is directly under review.
      state.reviews = {
        'node-2': { source: 'terminal', terminalId: null },
      };

      const result = actions.deleteNode('node-2');

      expect(result).toBe(false);
      // The node survives - no DeleteNodeCommand ran.
      expect(state.nodes['node-2']).toBeDefined();
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-2']);
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot delete node in collaboration - Please finish or cancel the collaboration first',
        'error'
      );
    });
  });
});
