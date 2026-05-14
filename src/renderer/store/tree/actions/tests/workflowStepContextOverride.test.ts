import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
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

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      setActiveTerminal: vi.fn(),
      createNewTerminal: vi.fn(),
      terminals: [{ id: 'terminal-1' }, { id: 'terminal-2' }],
    }),
  },
}));

describe('workflow step context override', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Tree (representative of a workflow already started on task-a, so task-a
    // is re-parented under step-1):
    //
    // root
    // └── workflow (isWorkflow)
    //     ├── step-1 (stepType: 'autonomous')
    //     │   └── task-a (the working node)
    //     ├── step-2 (stepType: 'autonomous')
    //     └── step-3 (stepType: 'manual')
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['workflow', 'ctx-step', 'ctx-step-1', 'ctx-step-2', 'ctx-node'],
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
          metadata: { isBlueprint: true, stepType: 'autonomous' },
        },
        'step-3': {
          id: 'step-3',
          content: 'Step 3',
          children: [],
          metadata: { isBlueprint: true, stepType: 'manual' },
        },
        'task-a': {
          id: 'task-a',
          content: 'Task A',
          children: [],
          metadata: {},
        },
        'ctx-step': {
          id: 'ctx-step',
          content: 'Step context body',
          children: [],
          metadata: { isContext: true },
        },
        'ctx-step-1': {
          id: 'ctx-step-1',
          content: 'Step 1 context body',
          children: [],
          metadata: { isContext: true },
        },
        'ctx-step-2': {
          id: 'ctx-step-2',
          content: 'Step 2 context body',
          children: [],
          metadata: { isContext: true },
        },
        'ctx-node': {
          id: 'ctx-node',
          content: 'Node context body',
          children: [],
          metadata: { isContext: true },
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
        'ctx-step': ['root'],
        'ctx-step-1': ['root'],
        'ctx-step-2': ['root'],
        'ctx-node': ['root'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-pre': 'terminal-1' },
      terminalNodeAssignments: {},
      contextDeclarations: [],
      sessionRegistry: {},
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

  describe('rule 1: step context overrides node context', () => {
    it('passes the step context as override when both step and working node have applied contexts', async () => {
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalled();
      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      // Expected new signature: (nodeId, terminalId, flags, overrideContextId)
      expect(callArgs[0]).toBe('task-a');
      expect(callArgs[1]).toBe('terminal-1');
      expect(callArgs[3]).toBe('ctx-step');
    });

    it('passes the inherited step context as override when step inherits from an ancestor in the workflow', async () => {
      // Workflow node holds the context that step-1 inherits.
      state.nodes['workflow'].metadata.appliedContextId = 'ctx-step';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

      await actions.startWorkflow('task-a', 'terminal-1');

      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      expect(callArgs[3]).toBe('ctx-step');
    });

    it('applies the override uniformly when advancing into another autonomous step', async () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step-1';
      state.nodes['step-2'].metadata.appliedContextId = 'ctx-step-2';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      await vi.advanceTimersByTimeAsync(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.ancestorRegistry['task-a']).toContain('step-2');
      expect(mockAutonomousCollaborate).toHaveBeenCalled();
      const lastCall = mockAutonomousCollaborate.mock.calls.at(-1);
      expect(lastCall?.[3]).toBe('ctx-step-2');
      vi.useRealTimers();
    });

    it('applies the override uniformly when advancing into a checkpoint step', async () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step-1';
      state.nodes['step-2'].metadata.stepType = 'checkpoint';
      state.nodes['step-2'].metadata.appliedContextId = 'ctx-step-2';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      await vi.advanceTimersByTimeAsync(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(mockAutonomousCollaborate).toHaveBeenCalled();
      const lastCall = mockAutonomousCollaborate.mock.calls.at(-1);
      expect(lastCall?.[3]).toBe('ctx-step-2');
      vi.useRealTimers();
    });

    it('passes the step context as override when only the step has a context and the working node has none', async () => {
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step';

      await actions.startWorkflow('task-a', 'terminal-1');

      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      expect(callArgs[3]).toBe('ctx-step');
    });

    it('passes the shared context as a single override when step and working node reference the same context id', async () => {
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-step';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalledTimes(1);
      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      expect(callArgs[3]).toBe('ctx-step');
    });
  });

  describe('rule 2: no override when step has no context', () => {
    it('passes undefined override when no step ancestor has an applied context, even if the working node does', async () => {
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

      await actions.startWorkflow('task-a', 'terminal-1');

      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      expect(callArgs[3]).toBeUndefined();
    });

    it('passes undefined override when neither step nor working node has any context', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');

      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      expect(callArgs[3]).toBeUndefined();
    });
  });

  describe('rule 3: override does not mutate the working node', () => {
    it('leaves the working node\'s stored appliedContextId untouched after the workflow sends', async () => {
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.nodes['task-a'].metadata.appliedContextId).toBe('ctx-node');
    });

    it('leaves the working node\'s stored appliedContextId untouched after stopping the workflow', async () => {
      state.nodes['step-1'].metadata.appliedContextId = 'ctx-step';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');

      expect(state.nodes['task-a'].metadata.appliedContextId).toBe('ctx-node');
    });
  });

  describe('synthetic step contexts', () => {
    it('passes a synthetic execute context id from the step as the override', async () => {
      state.nodes['step-1'].metadata.appliedContextId = '__basic_execute__';
      state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

      await actions.startWorkflow('task-a', 'terminal-1');

      const callArgs = mockAutonomousCollaborate.mock.calls[0];
      expect(callArgs[3]).toBe('__basic_execute__');
    });
  });
});
