import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import type { StepHistoryMap } from '../../stepHistory/stepHistory';

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/utils/nodeHelpers', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nodeHelpers')>('@/utils/nodeHelpers');
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock', nodeContent: 'mock' }),
    getAppliedContextIdWithInheritance: () => undefined,
    resolveContextMode: () => 'execute',
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({ buildExecutePrompt: () => 'mock' }));

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

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
  contextDeclarations: never[];
  stepHistory: StepHistoryMap;
};

describe('workflowExecutionActions — step history capture and invalidation', () => {
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: {} },
        workflow: { id: 'workflow', content: 'WF', children: ['step-1', 'step-2'], metadata: { isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { stepType: 'checkpoint' } },
        'task-a': { id: 'task-a', content: 'Task A original', children: [], metadata: {} },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
      sessionRegistry: {},
      terminalNodeAssignments: {},
      contextDeclarations: [],
      stepHistory: {},
    };
    setState = (partial) => { state = { ...state, ...partial }; };
    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
    const visualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };
    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      mockTriggerAutosave,
      visualEffects,
      mockAutonomousCollaborate,
    );
  });

  describe('startWorkflow', () => {
    it('writes the input node’s state as the first history entry on the starting step', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      const entries = state.stepHistory['step-1'] ?? [];
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].nodes[entries[0].rootNodeId].content).toBe('Task A original');
    });

    it('does not write any history entry on downstream steps that the node has not yet reached', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      expect(state.stepHistory['step-2'] ?? []).toHaveLength(0);
    });

    it('labels the first entry with the executed node’s title, not the owning step’s title', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      const entries = state.stepHistory['step-1'] ?? [];
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].parentLabel).toBe('Task A original');
      expect(entries[0].parentLabel).not.toBe('Step 1');
    });
  });

  describe('advanceNode (autonomous mutation)', () => {
    it.todo(
      'captures a pre-mutation snapshot of the working node before applying autonomous changes',
    );
    it.todo(
      'attributes the change to the source step when a mutation is followed by a move (mutate-then-move)',
    );
    it.todo(
      'never records the automated move itself as a history entry on the destination step',
    );
    it.todo(
      'calls HistoryManager.invalidateEntriesTouching with the UUIDs it just mutated',
    );
  });

  describe('decomposition path', () => {
    it.todo(
      'records the pre-decomposition state of the parent node on the decomposition step’s history',
    );
    it.todo(
      'seeds an initial-state history entry on the decomposition step for each generated sibling',
    );
    it.todo(
      'invalidates user undo entries that touched the parent or any of the generated siblings',
    );
  });

  describe('checkpoint accept routing', () => {
    it.todo(
      'when the working node is currently owned by a checkpoint step, accept writes a pre-accept snapshot AND registers the command on the user undo stack',
    );
    it.todo(
      'a subsequent autonomous mutation that touches the same UUID silently removes the checkpoint accept from the user undo stack',
    );
    it.todo(
      'after the subsequent autonomous mutation, the checkpoint step still holds the pre-accept snapshot (history is unaffected by stack invalidation)',
    );
  });

  describe('manual-send accept routing', () => {
    it.todo(
      'when the working node is not owned by any workflow step, accept registers on the user undo stack only and writes no step history anywhere',
    );
  });

  describe('Cmd+Z behavior after workflow run', () => {
    it.todo(
      'reverts the user’s last manual edit when that edit did not touch a node subsequently mutated by the workflow',
    );
    it.todo(
      'silently skips a manual edit whose touched node was later mutated by the workflow (the edit has been removed from the stack)',
    );
  });
});
