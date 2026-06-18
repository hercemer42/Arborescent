import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

// Mock surface mirrors workflowStepContextOverride.test.ts — it isolates the
// workflow-execution actions from logging, toasts, terminal I/O, the prompt
// builder, preferences and notifications, while leaving the real context
// resolution helpers (getInheritedContextId / getAppliedContextIdWithInheritance)
// intact so "no context" is resolved for real from the fixture metadata.
vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
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
      markTerminalProcessing: vi.fn(),
    }),
  },
}));

describe('autonomous run landing on a context-less manual step', () => {
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
    // root
    // └── workflow (isWorkflow)
    //     └── step-1 ── task-a (working node) — stepType set per test
    // ctx-node is an available context attached only when a test opts in.
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['workflow', 'ctx-node'],
          metadata: { isBlueprint: true },
        },
        'workflow': {
          id: 'workflow',
          content: 'Workflow',
          children: ['step-1'],
          metadata: { isBlueprint: true, isWorkflow: true },
        },
        'step-1': {
          id: 'step-1',
          content: 'Step 1',
          // No stepType key — the common "default manual" step shape (SetStepTypeCommand
          // writes the key only on an explicit choice). The guard must treat it as manual.
          children: ['task-a'],
          metadata: { isBlueprint: true },
        },
        'task-a': {
          id: 'task-a',
          content: 'Task A',
          children: [],
          metadata: {},
        },
        'ctx-node': {
          id: 'ctx-node',
          content: 'Context body',
          children: [],
          metadata: { isContext: true },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
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

  it('suppresses the send when the run lands on a default-manual step with no context', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');

    expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
  });

  it('also suppresses when the step is explicitly typed manual', async () => {
    state.nodes['step-1'].metadata.stepType = 'manual';

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
  });

  it('leaves the node waiting rather than running after suppressing the send', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');

    // A manual step is driven by the user — the node parks here instead of staying
    // "running" with nothing dispatched.
    expect(state.workflowExecutionStates['task-a']).toBeUndefined();
  });

  it('still dispatches when the manual step itself has a context', async () => {
    state.nodes['step-1'].metadata.appliedContextId = 'ctx-node';

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(mockAutonomousCollaborate).toHaveBeenCalled();
  });

  it('still dispatches when the context is applied on the node rather than the step', async () => {
    // Covers the getAppliedContextIdWithInheritance branch of effectiveContextId
    // (the node's own applied context), distinct from the step-override branch above.
    state.nodes['task-a'].metadata.appliedContextId = 'ctx-node';

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(mockAutonomousCollaborate).toHaveBeenCalled();
  });

  it('still dispatches when the run lands on a context-less autonomous step', async () => {
    // Scope guard: only manual steps are suppressed. A context-less autonomous step
    // keeps its existing behavior and is left untouched by this change.
    state.nodes['step-1'].metadata.stepType = 'autonomous';

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(mockAutonomousCollaborate).toHaveBeenCalled();
  });

  it('still dispatches when the run lands on a context-less checkpoint step', async () => {
    // Scope guard: a checkpoint is a human-validation gate and is intentionally left
    // unchanged — it must keep dispatching even without a context, never be suppressed.
    state.nodes['step-1'].metadata.stepType = 'checkpoint';

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(mockAutonomousCollaborate).toHaveBeenCalled();
  });
});
