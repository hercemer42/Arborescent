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

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({ executeInTerminal: mockExecuteInTerminal }));

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

vi.mock('@/utils/promptBuilder', () => ({ buildExecutePrompt: () => 'mock prompt' }));

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

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({ mockNotifyWorkflowEvent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: mockNotifyWorkflowEvent }));

describe('recurse step traversal without waiting siblings', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments: Record<string, string>;
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

  // Tree mirrors recurseHandoff.test.ts but with task-a as the ONLY task —
  // the node was never decomposed, so no sibling ever waits at step-1:
  // root
  // └── workflow (isWorkflow)
  //     ├── step-1 (decomposition: true, autonomous) — empty, nothing waiting
  //     ├── step-2 (autonomous)
  //     ├── step-3 (recurse: true, autonomous) — task-a runs here
  //     └── step-4 (autonomous) — where task-a must land after traversal
  beforeEach(() => {
    state = {
      nodes: {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['step-1', 'step-2', 'step-3', 'step-4'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: [], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-3': { id: 'step-3', content: 'Step 3', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous', recurse: true } },
        'step-4': { id: 'step-4', content: 'Step 4', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-3': ['root', 'workflow'],
        'step-4': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-3'],
      },
      workflowExecutionStates: {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
      },
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
      terminalNodeAssignments: { 'terminal-1': 'task-a' },
      contextDeclarations: [],
    };

    setState = (partial) => { state = { ...state, ...partial }; };

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

  function completeTaskAViaStopHook(): void {
    vi.useFakeTimers();
    actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
    vi.advanceTimersByTime(4000);
    vi.useRealTimers();
  }

  describe('no siblings at all — node was never decomposed', () => {
    it('advances the node past the automated recurse step to the next step instead of halting', () => {
      completeTaskAViaStopHook();

      expect(state.nodes['step-4'].children).toContain('task-a');
      expect(state.nodes['step-3'].children).not.toContain('task-a');
    });

    it('keeps the workflow running after traversing the recurse step — no manual restart needed', () => {
      completeTaskAViaStopHook();

      expect(state.workflowExecutionStates['task-a']).toBeDefined();
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('does not show the halted-at-recurse-step handoff toast when no sibling exists', () => {
      completeTaskAViaStopHook();

      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringContaining('halted at recurse step'),
        expect.anything(),
      );
    });
  });

  describe('siblings present but none waiting', () => {
    it('advances past the recurse step when the only sibling already has an execution state', () => {
      state.nodes['step-1'].children = ['task-b'];
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
      state.workflowExecutionStates['task-b'] = { state: 'running', terminalTabId: 'terminal-2' };

      completeTaskAViaStopHook();

      expect(state.nodes['step-4'].children).toContain('task-a');
      expect(state.nodes['step-3'].children).not.toContain('task-a');
      // the busy sibling is untouched
      expect(state.nodes['step-1'].children).toEqual(['task-b']);
    });

    it('advances past the recurse step when the only parked node belongs to a different decomposition group', () => {
      state.nodes['step-3'].children = ['task-b', 'task-a'];
      state.nodes['task-a'].metadata.groupId = 'group-a';
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true, groupId: 'group-b' } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-3'];

      completeTaskAViaStopHook();

      expect(state.nodes['step-4'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeDefined();
    });
  });

  describe('regression guard — sibling hand-off must keep working', () => {
    it('still halts at the recurse step and hands the terminal to the waiting decomposed sibling', () => {
      state.nodes['step-1'].children = ['task-b'];
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];

      completeTaskAViaStopHook();

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.nodes['step-2'].children).toContain('task-b');
    });

    it('still parks the last sibling at the recurse step when its siblings are already parked there', () => {
      state.nodes['step-3'].children = ['task-b', 'task-a'];
      state.nodes['task-a'].metadata.groupId = 'group-1';
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true, groupId: 'group-1' } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-3'];

      completeTaskAViaStopHook();

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.nodes['step-4'].children).not.toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('does not halt an ungrouped node when another ungrouped node is parked at the recurse step', () => {
      state.nodes['step-3'].children = ['task-b', 'task-a'];
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-3'];

      completeTaskAViaStopHook();

      expect(state.nodes['step-4'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeDefined();
    });
  });

  describe('boundary — recurse step placement and workflow shape', () => {
    it('completes the workflow when the recurse step is the final step and no siblings are waiting', () => {
      state.nodes['workflow'].children = ['step-1', 'step-2', 'step-3'];
      delete state.nodes['step-4'];
      delete state.ancestorRegistry['step-4'];

      completeTaskAViaStopHook();

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Workflow complete'),
        'success',
      );
    });

    it('advances normally when recurse is set but the workflow has no decomposition step', () => {
      // Removing the decomposition flag exercises the decompositionStepId === null
      // branch of the halt gate, which never halts regardless of siblings.
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { isBlueprint: true, stepType: 'autonomous' },
      };

      completeTaskAViaStopHook();

      expect(state.nodes['step-4'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeDefined();
    });
  });

  describe('manual and checkpoint gating — only automated steps auto-traverse', () => {
    it('does not auto-traverse the recurse step while the node awaits validation at a checkpoint', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('does not auto-traverse the recurse step for a node a manual gate already stopped', () => {
      delete state.workflowExecutionStates['task-a'];

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('internal bookkeeping', () => {
    it.todo('clears the recurse chain counter on fall-through so a later genuine recurse chain starts from zero');
    it.todo('a duplicate Stop event arriving during the advance does not double-advance the node past two steps');
  });
});
