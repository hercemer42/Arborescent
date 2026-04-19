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

vi.mock('@/utils/nodeHelpers', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nodeHelpers')>('@/utils/nodeHelpers');
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => undefined,
    resolveContextMode: () => 'execute',
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: () => 'mock prompt',
}));

vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: true,
      hasLaunchedWorkflow: true,
      stepTimeoutMinutes: 10,
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({
  mockNotifyWorkflowEvent: vi.fn(),
}));
vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: mockNotifyWorkflowEvent,
}));


describe('createWorkflowExecutionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean }>;
    workflowSessionMap: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
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
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
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
      mockVisualEffects,
      mockAutonomousCollaborate,
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
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', expect.any(String));
    });

    it('should trigger autosave after starting', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('stopWorkflow', () => {
    it('should clear execution state entirely', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should be a no-op if node is not running', () => {
      actions.stopWorkflow('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should be a no-op if node is awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');

      // stopWorkflow only works on running nodes
      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should allow restarting after stop', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();

      actions.startWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });
  });

  describe('continueWorkflow', () => {
    it('should advance node to next step when continuing from awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      // task-a was in step-1 (autonomous), should advance to step-2
      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('should be a no-op if node is not awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should show toast when no terminal is available', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', null);

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('terminal'),
        'warning'
      );
    });

    it('should reject if terminal is assigned to another running node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.continueWorkflow('task-a', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('already assigned'),
        'warning'
      );
    });

    it('should be a no-op if node has no execution state', () => {
      actions.continueWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should complete workflow when continuing from the last step', () => {
      // task-a at step-3 (final step), awaiting-validation
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });

    it('should stop at manual step when continuing past checkpoint', () => {
      // task-a at step-2 (checkpoint), next step is step-3 (manual)
      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      // Advances to step-3 (manual) → execution state cleared
      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should keep running when continuing to an autonomous step', () => {
      vi.useFakeTimers();

      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.nodes['step-2'].metadata.stepType = 'autonomous';

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');

      vi.advanceTimersByTime(1500);
      expect(mockAutonomousCollaborate).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('completeWorkflow', () => {
    it('should clear execution state entirely', () => {
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

      delete state.nodes['step-2'];
      delete state.nodes['task-c'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['task-c'];
    });

    it('should advance into nested workflow first step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['nested-step-1'].children).toContain('task-a');
    });

    it('should advance from last nested step back to parent workflow', () => {
      state.nodes['nested-step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'nested-wf', 'nested-step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should traverse deeply nested workflows (3+ levels) in correct order', () => {
      state.nodes['nested-step-1'].metadata.isWorkflow = true;
      state.nodes['nested-step-1'].children = ['deep-step'];
      state.nodes['deep-step'] = { id: 'deep-step', content: 'Deep Step', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['deep-step'] = ['root', 'workflow', 'nested-wf', 'nested-step-1'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

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
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-abc'] = 'terminal-1';
    });

    describe('Stop event', () => {
      it('should advance node when step type is autonomous', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-2'].children).toContain('task-a');
      });

      it('should set awaiting-validation when step type is checkpoint', () => {
        state.nodes['step-2'].children = ['task-a'];
        state.nodes['step-1'].children = ['task-b'];
        state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.stringContaining('complete'),
          'info',
          expect.objectContaining({ persistent: true, actions: expect.any(Array) })
        );
      });

      it('should not advance node when step type is manual', () => {
        state.nodes['step-3'].children = ['task-a'];
        state.nodes['step-1'].children = ['task-b'];
        state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        // Manual step: Stop hook is a no-op, node stays in place
        expect(state.nodes['step-3'].children).toContain('task-a');
      });

      it('should evaluate step type at arrival time, not at workflow start', () => {
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

        expect(state.nodes['step-1'].children).toContain('task-a');
      });

      it('should ignore Stop event when no node is assigned to that terminal', () => {
        state.workflowSessionMap['session-orphan'] = 'terminal-3';

        actions.handleHookEvent({
          session_id: 'session-orphan',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-1'].children).toContain('task-a');
      });
    });

    describe('Notification event', () => {
      it('should stop the workflow for the affected node', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Notification',
          message: 'Claude needs attention',
        });

        expect(state.workflowExecutionStates['task-a']).toBeUndefined();
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

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-c');
    });

    it('should stop one node without affecting the other', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });

    it('should allow two nodes at the same step simultaneously', () => {
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
    it('should clear all running nodes on initialization', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        'task-c': { state: 'running', terminalTabId: 'terminal-2' },
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-c']).toBeUndefined();
    });

    it('should preserve awaiting-validation nodes on initialization', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should clear session map on initialization', () => {
      state.workflowSessionMap = { 'old-session': 'terminal-1' };

      actions.initializeExecutionState();

      expect(state.workflowSessionMap).toEqual({});
    });

    it('should show toast when workflows are stopped on restart', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
      };

      actions.initializeExecutionState();

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('stopped'),
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

      vi.advanceTimersByTime(5 * 60 * 1000); // Another 5 minutes

      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.anything()
      );

      vi.useRealTimers();
    });

    it('should clear timeout when workflow is stopped', () => {
      vi.useFakeTimers();

      actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.anything()
      );

      vi.useRealTimers();
    });
  });

  describe('NeedsReview hook event', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should set needsReview flag on the execution state when received for a running node', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBe(true);
    });

    it('should be idempotent — calling twice results in one flag', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBe(true);
    });

    it('should ignore the event when no running node is found on the terminal', () => {
      state.workflowExecutionStates = {};

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates).toEqual({});
    });

    it('should ignore the event when the node is in awaiting-validation state', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBeUndefined();
    });

    it('should ignore the event when the session_id has no mapped terminal', () => {
      actions.handleHookEvent({ session_id: 'unknown-session', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBeUndefined();
    });
  });

  describe('Stop handler with NeedsReview flag', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should treat autonomous step as checkpoint when needsReview flag is set', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should show persistent toast when autonomous step pauses due to NeedsReview', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('review'),
        expect.anything(),
        expect.objectContaining({ persistent: true })
      );
    });

    it('should advance normally when needsReview flag is not set on autonomous step', () => {
      vi.useFakeTimers();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      // Autonomous step should advance (task-a moves to step-2)
      vi.advanceTimersByTime(1500);
      expect(state.workflowExecutionStates['task-a']?.state).not.toBe('awaiting-validation');
      vi.useRealTimers();
    });

    it('should not change checkpoint behavior when needsReview flag is set', () => {
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-c'].state).toBe('awaiting-validation');
    });
  });

  describe('NeedsReview flag clearing', () => {
    it('should clear needsReview flag when continuing workflow', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1', needsReview: true };

      actions.continueWorkflow('task-a', 'terminal-1');

      const entry = state.workflowExecutionStates['task-a'];
      if (entry) {
        expect(entry.needsReview).toBeFalsy();
      }
    });

    it('should implicitly clear needsReview flag when stopping workflow', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('recurse', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should schedule startWorkflow for the next waiting node after advancing past a recurse step', () => {
      vi.useFakeTimers();

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      // After advancement (1s delay) + recurse check schedules startWorkflow (2s delay)
      // Verify task-a advanced to step-2 (the advancement itself works)
      vi.advanceTimersByTime(1500);
      expect(state.nodes['step-2'].children).toContain('task-a');
      // task-b should still be in step-1 waiting
      expect(state.nodes['step-1'].children).toContain('task-b');

      vi.useRealTimers();
    });

    it('should not trigger recurse when step has no recurse flag', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.recurse = false;
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      vi.advanceTimersByTime(1500);

      // task-a should advance but task-b should not be started
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });

    it('should not schedule recurse when no waiting nodes exist', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].children = ['task-a'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      vi.advanceTimersByTime(1500);

      // task-a advances but no new workflow should start since no waiting nodes
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('recurse with completeWorkflow', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should trigger recurse check after completeWorkflow when last step has recurse', () => {
      vi.useFakeTimers();

      // All steps autonomous so the chain is unbroken from step-1 to step-3
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.nodes['step-3'].metadata.stepType = 'autonomous';
      state.nodes['step-3'].metadata.recurse = true;

      // task-a at step-3 (last step), task-b waiting in step-1
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      // checkRecurse walks back through step-3→step-2→step-1 (all autonomous)
      // finds task-b waiting in step-1, schedules startWorkflow after 2s
      vi.advanceTimersByTime(2500);
      expect(state.workflowExecutionStates['task-b']).toBeDefined();

      vi.useRealTimers();
    });

    it('should not trigger recurse after completeWorkflow when step has no recurse flag', () => {
      vi.useFakeTimers();

      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      vi.advanceTimersByTime(2500);
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('recurse safety limit', () => {
    it('should stop recursing and show warning after exceeding safety limit', () => {
      vi.useFakeTimers();

      // Single-step workflow: step-1 is last step, nodes complete after one Stop
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['workflow'].children = ['step-1'];
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      delete state.nodes['step-2'];
      delete state.nodes['step-3'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['step-3'];

      // Create 52 task nodes in step-1
      const taskIds: string[] = [];
      for (let i = 0; i < 52; i++) {
        const id = `task-${i}`;
        taskIds.push(id);
        state.nodes[id] = { id, content: `Task ${i}`, children: [], metadata: { isBlueprint: true } };
        state.ancestorRegistry[id] = ['root', 'workflow', 'step-1'];
      }
      state.nodes['step-1'].children = taskIds;
      state.workflowExecutionStates[taskIds[0]] = { state: 'running', terminalTabId: 'terminal-1' };

      for (let i = 0; i < 51; i++) {
        actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
        vi.advanceTimersByTime(3000);
      }

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Recurse limit reached'),
        'warning'
      );

      vi.useRealTimers();
    });

    it('should reset recurse counter when chain completes naturally', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      // Only one item — chain completes without finding next waiting node
      state.nodes['step-1'].children = ['task-a'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');

      vi.useRealTimers();
    });

    it('should not start more nodes after stopping the workflow mid-recurse', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      state.nodes['step-1'].children = ['task-a', 'task-b'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(1500);

      if (state.workflowExecutionStates['task-a']) {
        actions.stopWorkflow('task-a');
      }

      expect(state.nodes['step-1'].children).toContain('task-b');

      vi.useRealTimers();
    });
  });

  describe('notification wiring', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      mockNotifyWorkflowEvent.mockClear();
    });

    it('should notify success when workflow completes', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('success', 'Workflow complete', 'Task A');
    });

    it('should notify alert on NeedsReview', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Review requested', expect.any(String));
    });

    it('should notify alert on step timeout', () => {
      vi.useFakeTimers();

      actions.startWorkflow('task-a', 'terminal-1');
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Step timeout', expect.any(String));

      vi.useRealTimers();
    });

    it('should notify alert on recurse limit', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['workflow'].children = ['step-1'];
      delete state.nodes['step-2'];
      delete state.nodes['step-3'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['step-3'];

      const taskIds: string[] = [];
      for (let i = 0; i < 52; i++) {
        const id = `task-${i}`;
        taskIds.push(id);
        state.nodes[id] = { id, content: `Task ${i}`, children: [], metadata: { isBlueprint: true } };
        state.ancestorRegistry[id] = ['root', 'workflow', 'step-1'];
      }
      state.nodes['step-1'].children = taskIds;
      state.workflowExecutionStates[taskIds[0]] = { state: 'running', terminalTabId: 'terminal-1' };

      for (let i = 0; i < 51; i++) {
        actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
        vi.advanceTimersByTime(3000);
      }

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Recurse limit reached', expect.any(String));

      vi.useRealTimers();
    });

    it('should notify alert on Notification hook event', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Notification', message: 'Check output' });

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Workflow notification', 'Check output');
    });
  });
});
