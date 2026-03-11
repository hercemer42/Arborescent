import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));

describe('workflow execution edge cases', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'idle' | 'running' | 'paused'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['workflow'],
          metadata: { isBlueprint: true },
        },
        'workflow': {
          id: 'workflow',
          content: 'Workflow',
          children: ['step-1', 'step-2', 'step-3'],
          metadata: { isBlueprint: true, isWorkflow: true },
        },
        'step-1': {
          id: 'step-1',
          content: 'Step 1',
          children: ['task-a'],
          metadata: { isBlueprint: true, stepType: 'autonomous' },
        },
        'step-2': {
          id: 'step-2',
          content: 'Step 2',
          children: [],
          metadata: { isBlueprint: true, stepType: 'checkpoint' },
        },
        'step-3': {
          id: 'step-3',
          content: 'Step 3',
          children: [],
          metadata: { isBlueprint: true },
        },
        'task-a': {
          id: 'task-a',
          content: 'Task A',
          children: [],
          metadata: { isBlueprint: true },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-3': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
      },
      workflowSessionMap: {
        'session-abc': 'terminal-1',
      },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    mockAddToast.mockClear();
    mockTriggerAutosave = vi.fn();
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };
    actions = createWorkflowExecutionActions(() => state, setState, mockTriggerAutosave, mockVisualEffects);
  });

  describe('terminal closed mid-workflow', () => {
    it('should pause all running nodes assigned to the closed terminal', () => {
      actions.handleTerminalClosed('terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
    });

    it('should show toast identifying the paused node', () => {
      actions.handleTerminalClosed('terminal-1');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'warning'
      );
    });

    it('should not affect running nodes on other terminals', () => {
      state.workflowExecutionStates['task-b'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.handleTerminalClosed('terminal-1');

      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });

    it('should handle closing a terminal with no assigned nodes', () => {
      actions.handleTerminalClosed('terminal-999');

      // No crash, no state changes
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should not change state when closing a terminal assigned to a paused node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      actions.handleTerminalClosed('terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      expect(state.workflowExecutionStates['task-a'].terminalTabId).toBe('terminal-1');
    });

    it('should pause multiple nodes if multiple are assigned to the same terminal', () => {
      // This shouldn't happen (one node per tab), but test defensive behavior
      state.workflowExecutionStates['task-b'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleTerminalClosed('terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      expect(state.workflowExecutionStates['task-b'].state).toBe('paused');
    });
  });

  describe('running node deleted', () => {
    it('should clear execution state for the deleted node', () => {
      actions.handleNodeDeleted('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should release the terminal assignment', () => {
      actions.handleNodeDeleted('task-a');

      // terminal-1 should now be available for another node
      const terminalInUse = Object.values(state.workflowExecutionStates)
        .some(s => s.terminalTabId === 'terminal-1');
      expect(terminalInUse).toBe(false);
    });

    it('should be a no-op for non-running nodes', () => {
      actions.handleNodeDeleted('step-2');

      // No crash, task-a still running
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });
  });

  describe('step deleted while node is at that step', () => {
    it('should pause the node when its current step is deleted', () => {
      actions.handleStepDeleted('step-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
    });

    it('should show toast indicating step was removed', () => {
      actions.handleStepDeleted('step-1');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Step removed'),
        'warning'
      );
    });

    it('should not affect nodes in other steps', () => {
      state.nodes['step-2'].children = ['task-b'];
      state.workflowExecutionStates['task-b'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.handleStepDeleted('step-1');

      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });
  });

  describe('all steps removed from workflow', () => {
    it('should complete workflows for all affected running nodes', () => {
      actions.handleAllStepsRemoved('workflow');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show completion toast for each affected node', () => {
      actions.handleAllStepsRemoved('workflow');

      expect(mockAddToast).toHaveBeenCalled();
    });
  });

  describe('tree edits while running', () => {
    it('should not pause when steps are reordered during execution', () => {
      // Reorder: step-2, step-1, step-3
      state.nodes['workflow'].children = ['step-2', 'step-1', 'step-3'];

      // Node should still be running
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should advance to correct next step after reorder when Stop fires', () => {
      // Reorder: step-2, step-1, step-3
      state.nodes['workflow'].children = ['step-2', 'step-1', 'step-3'];

      actions.handleHookEvent({ session_id: 'session-abc', hook_event_name: 'Stop' });

      // After reorder, step-1 is now at index 1, so next step is step-3
      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should advance to the new step when a step is added between current and next', () => {
      // Add new-step between step-1 and step-2
      state.nodes['new-step'] = { id: 'new-step', content: 'New Step', children: [], metadata: { isBlueprint: true } };
      state.nodes['workflow'].children = ['step-1', 'new-step', 'step-2', 'step-3'];
      state.ancestorRegistry['new-step'] = ['root', 'workflow'];

      actions.handleHookEvent({ session_id: 'session-abc', hook_event_name: 'Stop' });

      // Should advance to new-step (the current next step)
      expect(state.nodes['new-step'].children).toContain('task-a');
    });
  });

  describe('running node moved manually', () => {
    it('should pause when a running node is moved to a different step by the user', () => {
      actions.handleNodeMovedManually('task-a');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
    });

    it('should allow resuming from the new position', () => {
      // Move task-a to step-3 manually
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];

      actions.handleNodeMovedManually('task-a');
      actions.resumeWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      // Node should still be at step-3
      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should not pause if the moved node is not running', () => {
      delete state.workflowExecutionStates['task-a'];

      actions.handleNodeMovedManually('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('one node per terminal tab enforcement', () => {
    it('should reject starting a second node on an occupied terminal', () => {
      state.nodes['step-2'].children = ['task-b'];
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];

      actions.startWorkflow('task-b', 'terminal-1');

      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    });

    it('should allow starting on a terminal after its previous node completes', () => {
      actions.completeWorkflow('task-a');

      state.nodes['step-2'].children = ['task-b'];
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];

      actions.startWorkflow('task-b', 'terminal-1');

      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });

    it('should allow starting on a terminal after its previous node is paused', () => {
      actions.pauseWorkflow('task-a');

      state.nodes['step-2'].children = ['task-b'];
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];

      // Paused nodes should release the terminal
      actions.startWorkflow('task-b', 'terminal-1');

      // Whether this is allowed depends on whether pause releases the terminal
      // Spec says: "Release assignment on pause, completion, or terminal close"
      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });
  });

  describe('hook configuration awareness', () => {
    it('should show setup guide on first Start Workflow if no hook ever received', () => {
      state.workflowSessionMap = {}; // No sessions ever registered
      state.workflowExecutionStates = {}; // Clear running state so task-a is eligible

      actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('hooks'),
        expect.anything()
      );
    });

    it('should not show setup guide if hooks have been received previously', () => {
      state.workflowExecutionStates = {}; // Clear running state so task-a is eligible
      actions.registerSession('session-abc', 'terminal-1');
      mockAddToast.mockClear();

      actions.startWorkflow('task-a', 'terminal-1');

      // Should not show hook setup guide toast
      const hookSetupCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('hooks')
      );
      expect(hookSetupCalls).toHaveLength(0);
    });
  });

  describe('execution state is transient (not persisted)', () => {
    it('should not store execution state in node metadata', () => {
      actions.startWorkflow('task-a', 'terminal-1');

      expect(state.nodes['task-a'].metadata.executionState).toBeUndefined();
      expect(state.nodes['task-a'].metadata.workflowRunning).toBeUndefined();
    });

    it('should store execution state only in workflowExecutionStates record', () => {
      actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toBeDefined();
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });
  });
});
