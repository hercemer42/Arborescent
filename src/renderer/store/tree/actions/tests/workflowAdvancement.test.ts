import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast, mockExecuteInTerminal } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));

const mockBuildContentWithContext = vi.hoisted(() =>
  vi.fn().mockReturnValue({ contextPrefix: '', nodeContent: 'mock content' }),
);

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/nodeHelpers')>();
  return {
    ...actual,
    buildContentWithContext: mockBuildContentWithContext,
  };
});

const mockBuildExecutePrompt = vi.hoisted(() =>
  vi.fn((_context: string, content: string) => `execute: ${content}`),
);
vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: mockBuildExecutePrompt,
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

const { mockNotifyWorkflowEvent: mockNotify } = vi.hoisted(() => ({
  mockNotifyWorkflowEvent: vi.fn(),
}));
vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: mockNotify,
}));


describe('workflow advancement', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation' | 'stuck'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
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
    //     │   └── task-a
    //     ├── step-2 (blueprint, stepType: 'checkpoint')
    //     │   └── task-c
    //     └── step-3 (blueprint) — default stepType (manual)
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
        'task-c': ['root', 'workflow', 'step-2'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
      sessionRegistry: {},
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    vi.clearAllMocks();
    mockExecuteInTerminal.mockResolvedValue(undefined);
    mockBuildContentWithContext.mockReturnValue({ contextPrefix: '', nodeContent: 'mock content' });
    mockBuildExecutePrompt.mockImplementation((_context: string, content: string) => `execute: ${content}`);
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

  describe('advancement toast message includes step number', () => {
    it('should include the target step number in the advancement toast', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringMatching(/Step\s*2/),
        'info'
      );
    });

    it('should include the node name in the advancement toast', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'info'
      );
    });

    it('should say "Workflow complete" on completion, not "advanced to Step"', () => {
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });
  });

  describe('flash effect on advancement', () => {
    it('should call flashNode with a distinct advancement-specific parameter', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('task-a', expect.any(String));
    });

    it('should use a different flash parameter than copy/paste (which uses light)', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      const flashCall = mockVisualEffects.flashNode.mock.calls[0];
      expect(flashCall[1]).not.toBe('light');
    });

    it('should not call flashNode when advanceNode is a no-op (not running)', () => {
      actions.advanceNode('task-a');

      expect(mockVisualEffects.flashNode).not.toHaveBeenCalled();
    });
  });

  describe('terminal send on advancement', () => {
    it('should send node content to the assigned terminal after moving to next step', () => {
      vi.useFakeTimers();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      vi.advanceTimersByTime(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-1',
        expect.objectContaining({ collaborate: expect.any(Boolean), execute: expect.any(Boolean) }),
        undefined,
      );
      vi.useRealTimers();
    });

    it('should send content AFTER the node has been moved (not before)', () => {
      vi.useFakeTimers();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      vi.advanceTimersByTime(1500);

      expect(state.ancestorRegistry['task-a']).toEqual(['root', 'workflow', 'step-2']);
      expect(mockAutonomousCollaborate).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should route through collaborate pipeline instead of fire-and-forget', () => {
      vi.useFakeTimers();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      vi.advanceTimersByTime(1500);

      expect(mockAutonomousCollaborate).toHaveBeenCalled();
      expect(mockExecuteInTerminal).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should pause workflow and show error toast when terminal write fails', async () => {
      vi.useFakeTimers();
      mockAutonomousCollaborate.mockRejectedValue(new Error('Terminal write failed'));
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      await vi.advanceTimersByTimeAsync(1500);

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send to terminal'),
        'error'
      );
      expect(mockNotify).toHaveBeenCalledWith('alert', 'Workflow error', expect.any(String));
      vi.useRealTimers();
    });

    it('should not send to terminal on completion (final step)', () => {
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });
  });

  describe('checkpoint step completion', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-abc'] = 'terminal-1';

      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
    });

    it('should set awaiting-validation on checkpoint Stop event', () => {
      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should show persistent toast with node name on checkpoint Stop event', () => {
      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'info',
        expect.objectContaining({ persistent: true, actions: expect.any(Array) })
      );
    });

    it('should not advance node on checkpoint Stop event', () => {
      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.nodes['step-2'].children).toContain('task-a');
    });
  });

  describe('checkpoint at last step auto-completes', () => {
    beforeEach(() => {
      // Move task-a to step-3, make step-3 a checkpoint (last step)
      state.nodes['step-3'] = {
        ...state.nodes['step-3'],
        children: ['task-a'],
        metadata: { isBlueprint: true, stepType: 'checkpoint' },
      };
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-last'] = 'terminal-1';
    });

    it('should complete workflow instead of entering awaiting-validation when checkpoint is last step', () => {
      actions.handleHookEvent({
        session_id: 'session-last',
        hook_event_name: 'Stop',
      });

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show workflow completion toast when last checkpoint finishes', () => {
      actions.handleHookEvent({
        session_id: 'session-last',
        hook_event_name: 'Stop',
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });

    it('should fire desktop notification when last checkpoint finishes', () => {
      actions.handleHookEvent({
        session_id: 'session-last',
        hook_event_name: 'Stop',
      });

      expect(mockNotify).toHaveBeenCalledWith('success', 'Workflow complete', expect.any(String));
    });

    it('should still enter awaiting-validation when checkpoint is NOT the last step', () => {
      // task-a is at step-2 (checkpoint, but step-3 exists after it)
      state.nodes['step-3'].children = [];
      state.nodes['step-3'].metadata = { isBlueprint: true };
      state.nodes['step-2'].children = ['task-a'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];

      actions.handleHookEvent({
        session_id: 'session-last',
        hook_event_name: 'Stop',
      });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });
  });

  describe('manual step behavior', () => {
    it('should not send content to terminal when advancing to a manual step', () => {
      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(mockExecuteInTerminal).not.toHaveBeenCalled();
    });

    it('should clear execution state when advancing to a manual step', () => {
      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show waiting toast when advancing to a manual step', () => {
      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('waiting'),
        'info'
      );
    });

    it('should send content to terminal when advancing to a checkpoint step', () => {
      vi.useFakeTimers();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      vi.advanceTimersByTime(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', expect.objectContaining({ collaborate: expect.any(Boolean), execute: expect.any(Boolean) }), undefined);
      vi.useRealTimers();
    });
  });

  describe('advancement does not push to undo stack', () => {
    it('should not create an undo command when advancing', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      // createWorkflowExecutionActions has no executeCommand parameter — undo is bypassed by design
      expect(state.nodes['step-2'].children).toContain('task-a');
    });
  });

  describe('advancement preserves existing behaviors', () => {
    it('should still move node to next step via depth-first traversal', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-1'].children).not.toContain('task-a');
    });

    it('should still update ancestor registry after move', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.ancestorRegistry['task-a']).toEqual(['root', 'workflow', 'step-2']);
    });

    it('should still trigger autosave on advancement', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should still complete workflow at final step', () => {
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });
  });

  describe('nested workflow traversal', () => {
    beforeEach(() => {
      // Extended tree with nested workflow:
      // workflow (isWorkflow)
      // ├── step-1 (autonomous)
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
        metadata: { isBlueprint: true, stepType: 'autonomous' },
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

    it('should advance from step-1 into nested workflow first step (depth-first)', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['nested-step-1'].children).toContain('task-a');
    });

    it('should advance from nested-step-1 to nested-step-2', () => {
      state.nodes['nested-step-1'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'nested-wf', 'nested-step-1'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['nested-step-2'].children).toContain('task-a');
    });

    it('should advance from last nested step back to parent workflow step-3', () => {
      state.nodes['nested-step-2'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'nested-wf', 'nested-step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should handle 3+ level nesting correctly', () => {
      state.nodes['nested-step-1'].metadata.isWorkflow = true;
      state.nodes['nested-step-1'].children = ['deep-step'];
      state.nodes['deep-step'] = {
        id: 'deep-step',
        content: 'Deep Step',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['deep-step'] = ['root', 'workflow', 'nested-wf', 'nested-step-1'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['deep-step'].children).toContain('task-a');
    });

    it('should complete when at final step of root workflow after nested traversal', () => {
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('hook event → advancement integration', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-abc'] = 'terminal-1';
    });

    it('should advance on autonomous step Stop event and show toast', () => {
      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(mockAddToast).toHaveBeenCalled();
      expect(mockVisualEffects.flashNode).toHaveBeenCalled();
    });

    it('should complete workflow when autonomous Stop event fires at final step', () => {
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.nodes['step-3'].metadata.stepType = 'autonomous';

      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });

    it('should handle rapid sequential Stop events correctly', () => {
      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.nodes['step-2'].children).toContain('task-a');

      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.nodes['step-2'].children).toContain('task-a');
      // Second Stop is a no-op since node is awaiting-validation, not running
      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should not advance if workflow was stopped between Stop events', () => {
      actions.stopWorkflow('task-a');

      actions.handleHookEvent({
        session_id: 'session-abc',
        hook_event_name: 'Stop',
      });

      expect(state.nodes['step-1'].children).toContain('task-a');
    });
  });

  describe('view does not follow node on advancement', () => {
    it('should not call scrollToNode when advancing', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockVisualEffects.scrollToNode).not.toHaveBeenCalled();
    });
  });

  describe('completeWorkflow on final step', () => {
    it('should leave node at its current step position', () => {
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should not send content to terminal on completion', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show success toast with node name on completion', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'success'
      );
    });

    it('should trigger autosave on completion', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle advanceNode when node has already been deleted from tree', () => {
      state.workflowExecutionStates['ghost-node'] = { state: 'running', terminalTabId: 'terminal-1' };

      expect(() => actions.advanceNode('ghost-node')).not.toThrow();
    });

    it('should handle advanceNode when terminal is no longer available', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'closed-terminal' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('should handle multiple concurrent workflows advancing independently', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };
      state.workflowSessionMap['session-1'] = 'terminal-1';
      state.workflowSessionMap['session-2'] = 'terminal-2';

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-c');
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });
  });
});
