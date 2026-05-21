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

describe('recurse hand-off', () => {
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

  // Tree (mutual-exclusion: decompose and recurse on different steps):
  // root
  // └── workflow (isWorkflow)
  //     ├── step-1 (decomposition: true, autonomous) — initial parent of task-a and task-b
  //     ├── step-2 (autonomous) — decompose+1, the destination Case B should land task-b on
  //     ├── step-3 (recurse: true, autonomous) — the recurse-marked step
  //     └── step-4 (autonomous) — recurse+1, NOT the destination
  // Tests that need task-a already at the recurse step running call placeTaskAOnRecurseStepRunning()
  // to relocate it from step-1 to step-3 before the act phase.
  beforeEach(() => {
    state = {
      nodes: {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['step-1', 'step-2', 'step-3', 'step-4'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a', 'task-b'], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-3': { id: 'step-3', content: 'Step 3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous', recurse: true } },
        'step-4': { id: 'step-4', content: 'Step 4', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
        'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-3': ['root', 'workflow'],
        'step-4': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
        'task-b': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
      terminalNodeAssignments: {},
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

  // Helper: arrange task-a as if it had already advanced to step-3 (the recurse step) and is running there.
  // Task-b stays where it started — a child of step-1 (the decomposition step), no execution state.
  function placeTaskAOnRecurseStepRunning(): void {
    state.nodes['step-1'].children = ['task-b'];
    state.nodes['step-3'].children = ['task-a'];
    state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
    state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
    state.terminalNodeAssignments['terminal-1'] = 'task-a';
  }

  describe('Case B — recurse hand-off destination', () => {
    it('moves the next decomposed sibling to decompose+1 (step-2), not to the recurse step or its successor', () => {
      vi.useFakeTimers();
      placeTaskAOnRecurseStepRunning();

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(4000);

      expect(state.nodes['step-2'].children).toContain('task-b');
      expect(state.nodes['step-1'].children).not.toContain('task-b');
      expect(state.nodes['step-3'].children).not.toContain('task-b');
      expect(state.nodes['step-4'].children).not.toContain('task-b');

      vi.useRealTimers();
    });

    it('does not re-select the just-completed sibling as the hand-off target even though its execution state was cleared moments earlier', () => {
      vi.useFakeTimers();
      placeTaskAOnRecurseStepRunning();

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(4000);

      // task-a must not have been moved to step-2 (the awakened sibling's destination)
      // and must not have been moved to step-4 (recurse+1)
      expect(state.nodes['step-2'].children).not.toContain('task-a');
      expect(state.nodes['step-4'].children).not.toContain('task-a');

      vi.useRealTimers();
    });

    it('halts the just-completed sibling at the recurse step — no advance to recurse+1, no restart', () => {
      vi.useFakeTimers();
      placeTaskAOnRecurseStepRunning();

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(4000);

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('Candidate filter — parentage of the decomposition step', () => {
    it('only considers candidates still parented to the decomposition step', () => {
      vi.useFakeTimers();
      placeTaskAOnRecurseStepRunning();
      // User has manually moved task-b out of step-1 (e.g., into step-2). It is no longer a candidate.
      state.nodes['step-1'].children = [];
      state.nodes['step-2'].children = ['task-b'];
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(4000);

      // No hand-off should have occurred — task-b stays where the user put it, no execution state created
      expect(state.nodes['step-2'].children).toEqual(['task-b']);
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });

  });
});
