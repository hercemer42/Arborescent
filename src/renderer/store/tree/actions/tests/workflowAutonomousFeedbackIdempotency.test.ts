import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => 'context-1',
    resolveContextFlags: () => ({ collaborate: true, execute: false }),
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({ buildExecutePrompt: () => 'mock prompt' }));

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

const { mockParseFeedbackContent } = vi.hoisted(() => ({ mockParseFeedbackContent: vi.fn() }));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

// Each AcceptFeedbackCommand constructor records the content payload it was
// built with, and its execute pushes a marker child onto the bound node so the
// test can observe the descendant-tree shape after each submit.
const { mockAcceptFeedbackCalls, mockAcceptFeedbackCtor } = vi.hoisted(() => ({
  mockAcceptFeedbackCalls: [] as Array<{ boundNodeId: string; rootIds: string[]; parsedNodes: Record<string, unknown> }>,
  mockAcceptFeedbackCtor: vi.fn(),
}));
vi.mock('../../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: mockAcceptFeedbackCtor,
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

describe('handleAutonomousFeedback — idempotency within a single step execution', () => {
  type ExecEntry = {
    state: 'running' | 'awaiting-validation' | 'stuck';
    terminalTabId: string;
    collaborating?: boolean;
    stopReceived?: boolean;
  };

  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, ExecEntry>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockVisualEffects: { flashNode: ReturnType<typeof vi.fn>; scrollToNode: ReturnType<typeof vi.fn>; startDeleteAnimation: ReturnType<typeof vi.fn>; clearDeleteAnimation: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2', 'step-3'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-3': { id: 'step-3', content: 'Step 3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-3': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
    };

    setState = (partial) => { state = { ...state, ...partial }; };

    mockAcceptFeedbackCalls.length = 0;
    vi.clearAllMocks();

    // Wire the AcceptFeedbackCommand constructor mock in beforeEach so the
    // closure picks up the freshly-reassigned `state` each test, and so
    // clearAllMocks can't strip the implementation.
    mockAcceptFeedbackCtor.mockImplementation(
      (boundNodeId: string, rootIdOrIds: string | string[], parsedNodes: Record<string, unknown>) => {
        const rootIds = Array.isArray(rootIdOrIds) ? rootIdOrIds : [rootIdOrIds];
        mockAcceptFeedbackCalls.push({ boundNodeId, rootIds, parsedNodes });
        return {
          execute: () => {
            // Replace the bound node's children with the freshly parsed root
            // ids — matches the spec's "replace, not append" intent.
            const node = state.nodes[boundNodeId];
            if (!node) return;
            state.nodes = {
              ...state.nodes,
              [boundNodeId]: { ...node, children: [...rootIds] },
            };
          },
          undo: vi.fn(),
          description: 'Accept feedback',
        };
      },
    );

    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/x.md');
    mockExecuteCommand = vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute());
    mockVisualEffects = { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() };

    // Each parse produces a unique root id derived from the content so the
    // test can correlate which submission's payload reached AcceptFeedbackCommand.
    mockParseFeedbackContent.mockImplementation((content: string) => {
      if (!content || !content.trim().startsWith('#')) return null;
      const slug = content.replace(/\W+/g, '_').slice(0, 24);
      const rootId = `parsed-${slug}`;
      return {
        nodes: { [rootId]: { id: rootId, content, children: [], metadata: {} } },
        rootNodeId: rootId,
        rootNodeIds: [rootId],
        nodeCount: 1,
      };
    });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockVisualEffects,
      mockAutonomousCollaborate,
      mockExecuteCommand,
    );
  });

  describe('identical-content submits — storage layer is a no-op', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };
    });

    it('does not re-parse on a back-to-back submit with byte-identical content', () => {
      actions.handleAutonomousFeedback('task-a', '# refined\n## a');
      actions.handleAutonomousFeedback('task-a', '# refined\n## a');

      expect(mockParseFeedbackContent).toHaveBeenCalledTimes(1);
    });

    it('does not re-execute AcceptFeedbackCommand on a back-to-back submit with byte-identical content', () => {
      actions.handleAutonomousFeedback('task-a', '# refined\n## a');
      actions.handleAutonomousFeedback('task-a', '# refined\n## a');

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(mockAcceptFeedbackCalls).toHaveLength(1);
    });
  });

  describe('three progressively-refined submits on the same autonomous step', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };
    });

    it('produces a final descendant tree under the bound node matching only the last submission', () => {
      actions.handleAutonomousFeedback('task-a', '# draft v1');
      actions.handleAutonomousFeedback('task-a', '# draft v2');
      actions.handleAutonomousFeedback('task-a', '# final');

      const lastCall = mockAcceptFeedbackCalls.at(-1);
      expect(state.nodes['task-a'].children).toEqual(lastCall?.rootIds);
      expect(state.nodes['task-a'].children).toHaveLength(1);
      expect(state.nodes['task-a'].children[0]).toMatch(/final/);
    });

    it('does not stack workflow advances — task-a stays under step-1 because no completion signal has arrived', () => {
      actions.handleAutonomousFeedback('task-a', '# draft v1');
      actions.handleAutonomousFeedback('task-a', '# draft v2');
      actions.handleAutonomousFeedback('task-a', '# final');

      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).not.toContain('task-a');
      expect(state.nodes['step-3'].children).not.toContain('task-a');
    });

    it('keeps the bound parent UUID invariant across submits — every AcceptFeedbackCommand call targets the same node id', () => {
      actions.handleAutonomousFeedback('task-a', '# draft v1');
      actions.handleAutonomousFeedback('task-a', '# draft v2');
      actions.handleAutonomousFeedback('task-a', '# final');

      const targets = new Set(mockAcceptFeedbackCalls.map((c) => c.boundNodeId));
      expect(targets).toEqual(new Set(['task-a']));
    });
  });

  describe('advance fires once per step, on the user-facing completion signal — not per submit', () => {
    it('does not advance the node when submits arrive without a Stop hook (no completion signal)', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: false,
      };

      actions.handleAutonomousFeedback('task-a', '# a');
      actions.handleAutonomousFeedback('task-a', '# b');
      actions.handleAutonomousFeedback('task-a', '# c');

      expect(state.nodes['step-1'].children).toContain('task-a');
    });

    it('advances the node exactly once after the completion signal, regardless of how many submits preceded it', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: false,
      };

      // Multiple refinements while waiting for Stop
      actions.handleAutonomousFeedback('task-a', '# draft v1');
      actions.handleAutonomousFeedback('task-a', '# draft v2');
      actions.handleAutonomousFeedback('task-a', '# final');

      // Stop hook arrives — this is the completion signal
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      // The node lands on step-2 (single advance), never on step-3 (which would
      // require a second advance triggered by a stacked submit).
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-3'].children).not.toContain('task-a');
    });
  });

  describe('final submission preserves advance and recurse semantics', () => {
    it('after the final submit followed by a Stop hook, AcceptFeedbackCommand fires once with the final content and the node advances', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: false,
      };

      actions.handleAutonomousFeedback('task-a', '# only submission');
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(mockAcceptFeedbackCalls).toHaveLength(1);
      expect(mockAcceptFeedbackCalls[0].boundNodeId).toBe('task-a');
      expect(state.nodes['step-2'].children).toContain('task-a');
    });
  });

  describe('disruption paths reset the content cache so re-armed nodes accept identical content', () => {
    it('a deleted-then-re-armed node accepts the same content again (cache cleared on handleNodeDeleted)', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };

      actions.handleAutonomousFeedback('task-a', '# same');
      expect(mockAcceptFeedbackCalls).toHaveLength(1);

      actions.handleNodeDeleted('task-a');
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };

      actions.handleAutonomousFeedback('task-a', '# same');
      expect(mockAcceptFeedbackCalls).toHaveLength(2);
    });
  });

  it.todo('late submit arriving after the step has advanced does not re-parse or create descendants on the now-current step');
  it.todo('whitespace-only refinement of identical-after-trim content is treated as a duplicate, not a distinct submit');
});
