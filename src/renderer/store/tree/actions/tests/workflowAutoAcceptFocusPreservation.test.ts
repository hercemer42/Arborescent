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

const { mockParseFeedbackContent } = vi.hoisted(() => ({ mockParseFeedbackContent: vi.fn() }));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

// AcceptFeedbackCommand is intentionally NOT mocked. It runs for real against
// the minimal state below, and its real side effect is to set activeNodeId to
// the preserved collaborating node id (because the single-root strategy keeps
// the original id). The fix must intervene AFTER this side effect to either
// leave the user's prior focus alone or let it follow, depending on whether
// the user was focused on the running node.

describe('handleAutonomousFeedback — focus preservation', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
    activeNodeId: string | null;
    collaboratingNodeId: string | null;
    collaborationSource: 'browser' | 'terminal' | null;
    feedbackFadingNodeIds: Set<string>;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteCommand = vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute());

    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow', 'unrelated'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
        unrelated: { id: 'unrelated', content: 'User is typing here', children: [], metadata: {} },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
        unrelated: ['root'],
      },
      workflowExecutionStates: {
        'task-a': { state: 'running', terminalTabId: 'terminal-1', collaborating: true, stopReceived: true },
      },
      workflowSessionMap: { 'session-1': 'terminal-1' },
      contextDeclarations: [],
      activeNodeId: null,
      collaboratingNodeId: 'task-a',
      collaborationSource: 'terminal',
      feedbackFadingNodeIds: new Set(),
      sessionRegistry: {},
    };

    setState = (partial) => { state = { ...state, ...partial }; };

    mockParseFeedbackContent.mockImplementation(() => ({
      nodes: { 'new-root': { id: 'new-root', content: 'Task A', children: [], metadata: {} } },
      rootNodeId: 'new-root',
      rootNodeIds: ['new-root'],
      nodeCount: 1,
    }));

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback.md'),
      mockExecuteCommand,
    );
  });

  describe('user is focused elsewhere (outside the workflow subtree)', () => {
    it('preserves activeNodeId when the user was typing on an unrelated node', () => {
      state.activeNodeId = 'unrelated';

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.activeNodeId).toBe('unrelated');
    });

    it('leaves activeNodeId as null when there was no active node before the auto-accept', () => {
      state.activeNodeId = null;

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.activeNodeId).toBeNull();
    });
  });

  describe('user is watching the running node', () => {
    it('leaves activeNodeId on the running node (user was already there)', () => {
      state.activeNodeId = 'task-a';

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.activeNodeId).toBe('task-a');
    });
  });

  describe('isolation between workflows', () => {
    it('does not follow focus into the advanced node when the user is focused in a different workflow', () => {
      state.nodes['other-workflow'] = { id: 'other-workflow', content: 'Other WF', children: ['other-task'], metadata: { isBlueprint: true, isWorkflow: true } };
      state.nodes['other-task'] = { id: 'other-task', content: 'Other task', children: [], metadata: {} };
      state.ancestorRegistry['other-workflow'] = ['root'];
      state.ancestorRegistry['other-task'] = ['root', 'other-workflow'];
      state.nodes.root.children = [...state.nodes.root.children, 'other-workflow'];

      state.activeNodeId = 'other-task';

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.activeNodeId).toBe('other-task');
    });
  });

  describe('does not regress parse-failure path', () => {
    it('does not touch activeNodeId when the feedback fails to parse', () => {
      mockParseFeedbackContent.mockImplementation(() => null);
      state.activeNodeId = 'unrelated';

      actions.handleAutonomousFeedback('task-a', 'malformed');

      expect(state.activeNodeId).toBe('unrelated');
    });

    it('does not touch activeNodeId when the content-root sanity check rejects the accept', () => {
      mockParseFeedbackContent.mockImplementation(() => ({
        nodes: { 'ctx-root': { id: 'ctx-root', content: 'Completely different', children: [], metadata: {} } },
        rootNodeId: 'ctx-root',
        rootNodeIds: ['ctx-root'],
        nodeCount: 1,
      }));
      state.activeNodeId = 'unrelated';

      actions.handleAutonomousFeedback('task-a', '# Completely different');

      expect(state.activeNodeId).toBe('unrelated');
    });
  });

  // Title-only: scroll side effects are DOM-driven (useNodeCursor calls
  // .focus() which triggers native scrollIntoView). They go away naturally
  // when activeNodeId no longer changes during auto-advance, so the tests
  // above cover the scroll regression too — no separate DOM test needed.
  it('flashes the advanced node but does not cause viewport scroll when user is focused elsewhere');
});
