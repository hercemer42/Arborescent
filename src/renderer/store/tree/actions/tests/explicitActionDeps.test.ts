import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeActions, type NodeActions } from '../nodeActions';
import { createNavigationActions, type NavigationActions } from '../navigationActions';
import { createNodeMovementActions, type NodeMovementActions } from '../nodeMovementActions';
import { createNodeDeletionActions, type NodeDeletionActions } from '../nodeDeletionActions';
import { notifyDeletionDisruption } from '../workflowDisruption';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';

// Contract for Story 1: factories receive their cross-slice dependencies as
// constructor params instead of reaching through get().actions. Test state
// deliberately has NO `actions` key — every call must route through the
// injected executeCommand, never a reach-through.

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  collaboratingNodeId: string | null;
  blueprintModeEnabled: boolean;
};
type Setter = (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;

function makeState(): TestState {
  return {
    nodes: {
      'root': { id: 'root', content: 'Root', children: ['node-1', 'node-2'], metadata: {} },
      'node-1': { id: 'node-1', content: 'Task 1', children: ['node-3'], metadata: { status: 'pending' } },
      'node-2': { id: 'node-2', content: 'Task 2', children: [], metadata: { status: 'pending' } },
      'node-3': { id: 'node-3', content: 'Task 3', children: [], metadata: { status: 'pending' } },
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      'root': [],
      'node-1': ['root'],
      'node-2': ['root'],
      'node-3': ['root', 'node-1'],
    },
    activeNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    collaboratingNodeId: null,
    blueprintModeEnabled: false,
  };
}

describe('explicit action dependencies (no actions reach-through)', () => {
  let state: TestState;
  let setState: Setter;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = makeState();
    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };
    mockTriggerAutosave = vi.fn();
    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      command.execute();
    });
  });

  describe('createNodeActions with injected executeCommand', () => {
    let mockRefreshSummary: ReturnType<typeof vi.fn>;
    let actions: NodeActions;

    beforeEach(() => {
      mockRefreshSummary = vi.fn();
      actions = createNodeActions(() => state, setState, mockTriggerAutosave, {
        executeCommand: mockExecuteCommand,
        refreshSummaryVisibleNodeIds: mockRefreshSummary,
      });
    });

    it('routes updateContent through the injected executeCommand', () => {
      actions.updateContent('node-1', 'Updated Task');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['node-1'].content).toBe('Updated Task');
    });

    it('routes toggleStatus through the injected executeCommand', () => {
      actions.toggleStatus('node-2');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['node-2'].metadata.status).toBe('completed');
    });

    it('routes repeated toggleStatus calls through the injected executeCommand each time', () => {
      actions.toggleStatus('node-2');
      actions.toggleStatus('node-2');
      actions.toggleStatus('node-2');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(3);
      expect(state.nodes['node-2'].metadata.status).toBe('pending');
    });

    it('routes createNode through the injected executeCommand', () => {
      actions.createNode('node-2');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['root'].children).toHaveLength(3);
    });

    it('routes splitNode through the injected executeCommand', () => {
      actions.splitNode('node-1', 'Task 1', 4);

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['node-1'].content).toBe('Task');
    });

    it('invokes the injected refreshSummaryVisibleNodeIds when markAllAsComplete executes', () => {
      actions.markAllAsComplete('node-1');

      expect(state.nodes['node-1'].metadata.status).toBe('completed');
      expect(state.nodes['node-3'].metadata.status).toBe('completed');
      expect(mockRefreshSummary).toHaveBeenCalled();
    });

    it('does not invoke executeCommand for a missing node', () => {
      actions.updateContent('non-existent', 'whatever');
      actions.toggleStatus('non-existent');
      actions.markAllAsComplete('non-existent');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it('does not throw when store state has no actions slice', () => {
      expect(() => actions.toggleStatus('node-2')).not.toThrow();
    });
  });

  describe('createNavigationActions with injected executeCommand', () => {
    let actions: NavigationActions;

    beforeEach(() => {
      actions = createNavigationActions(() => state, setState, mockExecuteCommand);
    });

    it('routes toggleNode through the injected executeCommand', () => {
      actions.toggleNode('node-1');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['node-1'].metadata.expanded).toBe(false);
    });

    it('does not invoke executeCommand for a leaf node', () => {
      actions.toggleNode('node-2');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it('does not invoke executeCommand for a missing node', () => {
      actions.toggleNode('non-existent');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });

  describe('createNodeMovementActions with injected dependencies', () => {
    let mockHandleNodeMovedManually: ReturnType<typeof vi.fn>;
    let actions: NodeMovementActions;

    beforeEach(() => {
      mockHandleNodeMovedManually = vi.fn();
      actions = createNodeMovementActions(() => state, setState, mockTriggerAutosave, undefined, undefined, {
        executeCommand: mockExecuteCommand,
        handleNodeMovedManually: mockHandleNodeMovedManually,
      });
    });

    it('routes moveNodeUp through the injected executeCommand', () => {
      actions.moveNodeUp('node-2');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('routes indentNode through the injected executeCommand', () => {
      actions.indentNode('node-2');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['node-1'].children).toContain('node-2');
    });

    it('invokes the injected handleNodeMovedManually when a move reparents the node', () => {
      actions.indentNode('node-2');

      expect(mockHandleNodeMovedManually).toHaveBeenCalledWith('node-2');
    });

    it('does not invoke handleNodeMovedManually when the move stays within the same parent', () => {
      actions.moveNodeUp('node-2');

      expect(mockHandleNodeMovedManually).not.toHaveBeenCalled();
    });

    it('does not invoke executeCommand when the move is a no-op at a boundary', () => {
      actions.moveNodeUp('node-1');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });

  describe('createNodeDeletionActions with injected executeCommand', () => {
    let actions: NodeDeletionActions;

    beforeEach(() => {
      actions = createNodeDeletionActions(() => state, setState, mockTriggerAutosave, mockExecuteCommand);
    });

    it('routes deleteNodes through the injected executeCommand', () => {
      actions.deleteNodes(['node-2']);

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(state.nodes['node-2']).toBeUndefined();
    });

    it('does not invoke executeCommand for an empty nodeIds array', () => {
      actions.deleteNodes([]);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it('clears content of the last root-level child without invoking executeCommand', () => {
      state.nodes = {
        'root': { id: 'root', content: 'Root', children: ['last-child'], metadata: {} },
        'last-child': { id: 'last-child', content: 'Last child', children: [], metadata: {} },
      };
      state.ancestorRegistry = { 'root': [], 'last-child': ['root'] };

      const result = actions.deleteNode('last-child');

      expect(result).toBe(true);
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(state.nodes['last-child'].content).toBe('');
    });

    it('still blocks deletion of the collaborating node', () => {
      state.collaboratingNodeId = 'node-2';

      const result = actions.deleteNode('node-2');

      expect(result).toBe(false);
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(state.nodes['node-2']).toBeDefined();
    });
  });

  // sendActions feedback acceptance through the injected executeCommand is
  // covered by sendActions.test.ts; the late-bound restoreCollaborationState
  // by persistenceActions.test.ts.

  describe('notifyDeletionDisruption with injected handlers', () => {
    it('dispatches deletions to the injected disruption handlers', () => {
      const handleNodeDeleted = vi.fn();
      const handleStepDeleted = vi.fn();
      const handleAllStepsRemoved = vi.fn();

      state.nodes['node-1'].metadata.isWorkflow = true;
      state.nodes['node-1'].children = [];

      notifyDeletionDisruption(
        () => state,
        ['node-3'],
        [{ stepId: 'node-3', workflowId: 'node-1' }],
        { handleNodeDeleted, handleStepDeleted, handleAllStepsRemoved }
      );

      expect(handleNodeDeleted).toHaveBeenCalledWith('node-3');
      expect(handleStepDeleted).toHaveBeenCalledWith('node-3');
      expect(handleAllStepsRemoved).toHaveBeenCalledWith('node-1');
    });

    it('is a no-op when no disruption handlers are injected', () => {
      expect(() =>
        notifyDeletionDisruption(() => state, ['node-3'], [], undefined)
      ).not.toThrow();
    });
  });
});
