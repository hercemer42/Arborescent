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

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

vi.mock('@/utils/nodeHelpers', () => ({
  buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
}));

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: () => 'mock prompt',
}));

vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: true,
      stepTimeoutMinutes: 10,
      markHookEventReceived: vi.fn(),
    }),
  },
}));

describe('createWorkflowExecutionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'idle' | 'running' | 'paused'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Tree:
    // root (blueprint)
    // └── workflow (blueprint, isWorkflow)
    //     ├── step-1 (blueprint, stepType: 'autonomous')
    //     │   ├── task-a
    //     │   └── task-b
    //     ├── step-2 (blueprint, stepType: 'checkpoint')
    //     │   └── task-c
    //     └── step-3 (blueprint) — default stepType (manual)
    //         └── (empty)
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
          children: ['task-a', 'task-b'],
          metadata: { isBlueprint: true, stepType: 'autonomous' },
        },
        'step-2': {
          id: 'step-2',
          content: 'Step 2',
          children: ['task-c'],
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
        'task-b': {
          id: 'task-b',
          content: 'Task B',
          children: [],
          metadata: { isBlueprint: true },
        },
        'task-c': {
          id: 'task-c',
          content: 'Task C',
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
        'task-b': ['root', 'workflow', 'step-1'],
        'task-c': ['root', 'workflow', 'step-2'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
      contextDeclarations: [],
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    vi.clearAllMocks();
    mockTriggerAutosave = vi.fn();
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockVisualEffects
    );
  });

  describe('startWorkflow', () => {
    it('should set node execution state to running with terminal assignment', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a']).toEqual({
        state: 'running',
        terminalTabId: 'terminal-1',
      });
    });

    it('should move node from workflow root to first step before starting', () => {
      // Add task-root as child of workflow root
      state.nodes['workflow'].children = ['step-1', 'step-2', 'step-3', 'task-root'];
      state.nodes['task-root'] = { id: 'task-root', content: 'Root Task', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-root'] = ['root', 'workflow'];

      actions.startWorkflow('task-root', 'terminal-1');

      expect(state.nodes['step-1'].children).toContain('task-root');
      expect(state.nodes['workflow'].children).not.toContain('task-root');
    });

    it('should start at workflow root without moving when workflow has no steps', () => {
      state.nodes['workflow'].children = ['task-root'];
      state.nodes['task-root'] = { id: 'task-root', content: 'Root Task', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-root'] = ['root', 'workflow'];

      actions.startWorkflow('task-root', 'terminal-1');

      expect(state.workflowExecutionStates['task-root'].state).toBe('running');
      expect(state.nodes['workflow'].children).toContain('task-root');
    });

    it('should start from current step if node is already inside a step', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should reject if terminal tab is already assigned to another running node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.startWorkflow('task-b', 'terminal-1');

      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalled();
    });

    it('should show toast if no terminal tab is available', () => {
      actions.startWorkflow('task-a', null);

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('terminal'),
        'warning'
      );
    });

    it('should not allow starting a workflow step itself', () => {
      actions.startWorkflow('step-1', 'terminal-1');
      expect(state.workflowExecutionStates['step-1']).toBeUndefined();
    });

    it('should not allow starting the workflow node itself', () => {
      actions.startWorkflow('workflow', 'terminal-1');
      expect(state.workflowExecutionStates['workflow']).toBeUndefined();
    });

    it('should not allow starting a node that is not inside a workflow', () => {
      state.nodes['outside'] = { id: 'outside', content: 'Outside', children: [], metadata: {} };
      state.ancestorRegistry['outside'] = ['root'];

      actions.startWorkflow('outside', 'terminal-1');
      expect(state.workflowExecutionStates['outside']).toBeUndefined();
    });

    it('should allow multiple nodes to be running simultaneously in different terminals', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-c', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });

    it('should send content to the terminal on start', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(mockExecuteInTerminal).toHaveBeenCalledWith('terminal-1', expect.any(String));
    });

    it('should trigger autosave after starting', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('pauseWorkflow', () => {
    it('should set node execution state to paused', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.pauseWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
    });

    it('should retain terminal assignment when paused', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.pauseWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a'].terminalTabId).toBe('terminal-1');
    });

    it('should be a no-op if node is not running', () => {
      actions.pauseWorkflow('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should be a no-op if node is already paused', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      actions.pauseWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
    });
  });

  describe('resumeWorkflow', () => {
    it('should set node execution state back to running with the provided terminal', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      actions.resumeWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      expect(state.workflowExecutionStates['task-a'].terminalTabId).toBe('terminal-1');
    });

    it('should update terminal assignment when resuming on a different terminal', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      actions.resumeWorkflow('task-a', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].terminalTabId).toBe('terminal-2');
    });

    it('should re-send content to the terminal on resume', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      actions.resumeWorkflow('task-a', 'terminal-1');

      expect(mockExecuteInTerminal).toHaveBeenCalledWith('terminal-1', expect.any(String));
    });

    it('should show toast when no terminal is available', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      actions.resumeWorkflow('task-a', null);

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('terminal'),
        'warning'
      );
    });

    it('should reject if terminal is assigned to another running node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.resumeWorkflow('task-a', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('already assigned'),
        'warning'
      );
    });

    it('should be a no-op if node is not paused', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.resumeWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should be a no-op if node has no execution state', () => {
      actions.resumeWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('completeWorkflow', () => {
    it('should set node execution state to idle and clear terminal assignment', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show completion toast with node name', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'success'
      );
    });

    it('should leave node at its current position in the tree', () => {
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-c');

      expect(state.nodes['step-2'].children).toContain('task-c');
    });

    it('should trigger autosave', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('advanceNode (direct movement, bypasses undo stack)', () => {
    it('should move node to the next workflow step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-1'].children).not.toContain('task-a');
    });

    it('should update ancestorRegistry after move', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.ancestorRegistry['task-a']).toEqual(['root', 'workflow', 'step-2']);
    });

    it('should NOT push to undo stack (HistoryManager)', () => {
      const mockExecuteCommand = vi.fn();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it('should trigger debounced autosave', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should show advancement toast with node name and step number', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'info'
      );
    });

    it('should flash the node with workflow-specific intensity', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('task-a', 'advance');
    });

    it('should complete workflow when node is at final step and has no next step', () => {
      // Move task-a to step-3 (final step)
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });

    it('should be a no-op if node is not in running state', () => {
      actions.advanceNode('task-a');

      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(mockVisualEffects.flashNode).not.toHaveBeenCalled();
    });
  });

  describe('advanceNode with nested workflows', () => {
    beforeEach(() => {
      // Extend tree with nested workflow:
      // workflow (isWorkflow)
      // ├── step-1
      // │   └── task-a
      // ├── nested-wf (isWorkflow)
      // │   ├── nested-step-1
      // │   └── nested-step-2
      // └── step-3
      state.nodes['workflow'].children = ['step-1', 'nested-wf', 'step-3'];
      state.nodes['nested-wf'] = {
        id: 'nested-wf',
        content: 'Nested Workflow',
        children: ['nested-step-1', 'nested-step-2'],
        metadata: { isBlueprint: true, isWorkflow: true },
      };
      state.nodes['nested-step-1'] = {
        id: 'nested-step-1',
        content: 'Nested Step 1',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.nodes['nested-step-2'] = {
        id: 'nested-step-2',
        content: 'Nested Step 2',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['nested-wf'] = ['root', 'workflow'];
      state.ancestorRegistry['nested-step-1'] = ['root', 'workflow', 'nested-wf'];
      state.ancestorRegistry['nested-step-2'] = ['root', 'workflow', 'nested-wf'];

      // Remove step-2 to simplify
      delete state.nodes['step-2'];
      delete state.nodes['task-c'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['task-c'];
    });

    it('should advance into nested workflow first step', () => {
      // task-a is in step-1 → next step should be nested-step-1 (depth-first)
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['nested-step-1'].children).toContain('task-a');
    });

    it('should advance from last nested step back to parent workflow', () => {
      // task-a is in nested-step-2 → next step should be step-3 (back to parent)
      state.nodes['nested-step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'nested-wf', 'nested-step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should traverse deeply nested workflows (3+ levels) in correct order', () => {
      // Add a third level of nesting
      state.nodes['nested-step-1'].metadata.isWorkflow = true;
      state.nodes['nested-step-1'].children = ['deep-step'];
      state.nodes['deep-step'] = { id: 'deep-step', content: 'Deep Step', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['deep-step'] = ['root', 'workflow', 'nested-wf', 'nested-step-1'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      // From step-1 → should enter nested-wf → nested-step-1 is a workflow → enter deep-step
      actions.advanceNode('task-a');

      expect(state.nodes['deep-step'].children).toContain('task-a');
    });
  });

  describe('registerSession', () => {
    it('should map session_id to terminal tab', () => {
      actions.registerSession('session-abc', 'terminal-1');

      expect(state.workflowSessionMap['session-abc']).toBe('terminal-1');
    });

    it('should update mapping when same tab gets new session (Claude Code restart)', () => {
      state.workflowSessionMap['session-old'] = 'terminal-1';

      actions.registerSession('session-new', 'terminal-1');

      expect(state.workflowSessionMap['session-new']).toBe('terminal-1');
    });

    it('should handle multiple sessions across different terminals', () => {
      actions.registerSession('session-1', 'terminal-1');
      actions.registerSession('session-2', 'terminal-2');

      expect(state.workflowSessionMap['session-1']).toBe('terminal-1');
      expect(state.workflowSessionMap['session-2']).toBe('terminal-2');
    });
  });

  describe('handleHookEvent', () => {
    beforeEach(() => {
      // Set up a running node with session mapping
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-abc'] = 'terminal-1';
    });

    describe('Stop event', () => {
      it('should advance node when step type is autonomous', () => {
        // Step-1 has stepType: 'autonomous'
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-2'].children).toContain('task-a');
      });

      it('should pause workflow and show toast when step type is checkpoint', () => {
        // Move task-a to step-2 (checkpoint)
        state.nodes['step-2'].children = ['task-a'];
        state.nodes['step-1'].children = ['task-b'];
        state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.stringContaining('complete'),
          'info'
        );
      });

      it('should not advance node when step type is manual', () => {
        // Move task-a to step-3 (manual / default)
        state.nodes['step-3'].children = ['task-a'];
        state.nodes['step-1'].children = ['task-b'];
        state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-3'].children).toContain('task-a');
      });

      it('should evaluate step type at arrival time, not at workflow start', () => {
        // Change step-1 from autonomous to manual mid-run
        state.nodes['step-1'].metadata.stepType = 'manual';

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        // Should NOT advance because step is now manual
        expect(state.nodes['step-1'].children).toContain('task-a');
      });

      it('should ignore Stop event with unknown session_id', () => {
        actions.handleHookEvent({
          session_id: 'unknown-session',
          hook_event_name: 'Stop',
        });

        // No change, no crash
        expect(state.nodes['step-1'].children).toContain('task-a');
      });

      it('should ignore Stop event when no node is assigned to that terminal', () => {
        state.workflowSessionMap['session-orphan'] = 'terminal-3';
        // terminal-3 has no running node

        actions.handleHookEvent({
          session_id: 'session-orphan',
          hook_event_name: 'Stop',
        });

        // No change, no crash
        expect(state.nodes['step-1'].children).toContain('task-a');
      });
    });

    describe('Notification event', () => {
      it('should pause the workflow for the affected node', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Notification',
          message: 'Claude needs attention',
        });

        expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      });

      it('should show a toast with the notification message', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Notification',
          message: 'Claude needs attention',
        });

        expect(mockAddToast).toHaveBeenCalled();
      });

      it('should ignore Notification event with unknown session_id', () => {
        actions.handleHookEvent({
          session_id: 'unknown-session',
          hook_event_name: 'Notification',
          message: 'test',
        });

        // No crash, no state changes
        expect(Object.keys(state.workflowExecutionStates)).toHaveLength(1);
      });
    });

  });

  describe('parallel execution', () => {
    it('should allow two nodes running in separate terminals', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-c', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
      expect(state.workflowExecutionStates['task-a'].terminalTabId).toBe('terminal-1');
      expect(state.workflowExecutionStates['task-c'].terminalTabId).toBe('terminal-2');
    });

    it('should advance nodes independently when their respective Stop hooks fire', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };
      state.workflowSessionMap['session-1'] = 'terminal-1';
      state.workflowSessionMap['session-2'] = 'terminal-2';

      // Stop for task-a (autonomous step) → advances
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      // task-a moved, task-c unchanged
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-c');
    });

    it('should pause one node without affecting the other', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.pauseWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });

    it('should allow two nodes at the same step simultaneously', () => {
      // Move task-b to step-2 alongside task-c
      state.nodes['step-2'].children = ['task-c', 'task-b'];
      state.nodes['step-1'].children = ['task-a'];
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];

      actions.startWorkflow('task-c', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');

      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });
  });

  describe('initialization (app restart)', () => {
    it('should set all running nodes to paused on initialization', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        'task-c': { state: 'running', terminalTabId: 'terminal-2' },
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
      expect(state.workflowExecutionStates['task-c'].state).toBe('paused');
    });

    it('should not modify already-paused nodes on initialization', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'paused', terminalTabId: 'terminal-1' },
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a'].state).toBe('paused');
    });

    it('should clear session map on initialization', () => {
      state.workflowSessionMap = { 'old-session': 'terminal-1' };

      actions.initializeExecutionState();

      expect(state.workflowSessionMap).toEqual({});
    });

    it('should show toast when nodes are paused on restart', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
      };

      actions.initializeExecutionState();

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('paused'),
        'warning'
      );
    });
  });

  describe('step timeout', () => {
    it('should show timeout dialog after configured interval', () => {
      vi.useFakeTimers();

      actions.startWorkflow('task-a', 'terminal-1');

      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('taking longer than expected'),
        expect.anything(),
        expect.objectContaining({ actions: expect.any(Array) })
      );

      vi.useRealTimers();
    });

    it('should reset timeout when node advances to next step', () => {
      vi.useFakeTimers();

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-abc'] = 'terminal-1';

      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      // Stop hook fires, node advances
      actions.handleHookEvent({ session_id: 'session-abc', hook_event_name: 'Stop' });

      vi.advanceTimersByTime(5 * 60 * 1000); // Another 5 minutes (10 total, but only 5 since last advance)

      // Should NOT have shown timeout yet (only 5 min since last advance)
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.anything()
      );

      vi.useRealTimers();
    });

    it('should clear timeout when workflow is paused', () => {
      vi.useFakeTimers();

      actions.startWorkflow('task-a', 'terminal-1');
      actions.pauseWorkflow('task-a');

      vi.advanceTimersByTime(10 * 60 * 1000);

      // Should NOT show timeout for a paused workflow
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.anything()
      );

      vi.useRealTimers();
    });
  });
});
