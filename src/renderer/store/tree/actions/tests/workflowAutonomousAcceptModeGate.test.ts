import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../../services/logger', () => ({
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
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

const { mockParseFeedbackContent } = vi.hoisted(() => ({ mockParseFeedbackContent: vi.fn() }));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

interface AcceptFeedbackCall {
  acceptMode: 'autonomous' | 'checkpoint-accept' | 'manual-send-accept';
}

const { mockAcceptFeedbackCalls, mockAcceptFeedbackCtor } = vi.hoisted(() => ({
  mockAcceptFeedbackCalls: [] as AcceptFeedbackCall[],
  mockAcceptFeedbackCtor: vi.fn(),
}));
vi.mock('../../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: mockAcceptFeedbackCtor,
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

describe('handleAutonomousFeedback — gate 3 acceptMode alignment via unified context', () => {
  interface ExecEntry {
    state: 'running' | 'awaiting-validation';
    terminalTabId: string;
    collaborating?: boolean;
  }

  interface TestState {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, ExecEntry>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
  }

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAcceptFeedbackCalls.length = 0;
    vi.clearAllMocks();

    mockAcceptFeedbackCtor.mockImplementation(
      (
        _boundNodeId: string,
        _rootIdOrIds: string | string[],
        _parsedNodes: Record<string, unknown>,
        _getState: unknown,
        _set: unknown,
        _triggerAutosave: unknown,
        _archiveConfig: unknown,
        _unused: unknown,
        options: { acceptMode: AcceptFeedbackCall['acceptMode'] },
      ) => {
        mockAcceptFeedbackCalls.push({ acceptMode: options.acceptMode });
        return { execute: vi.fn(), undo: vi.fn(), description: 'Accept feedback' };
      },
    );

    mockParseFeedbackContent.mockImplementation((content: string) => {
      if (!content || !content.trim().startsWith('#')) return null;
      const rootId = `parsed-${content.replace(/\W+/g, '_').slice(0, 16)}`;
      return {
        nodes: { [rootId]: { id: rootId, content, children: [], metadata: {} } },
        rootNodeId: rootId,
        rootNodeIds: [rootId],
        nodeCount: 1,
      };
    });

    mockExecuteCommand = vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute());

    state = {
      nodes: {},
      rootNodeId: 'root',
      ancestorRegistry: {},
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
    };
    setState = (partial) => { state = { ...state, ...partial }; };

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/x.md'),
      mockExecuteCommand,
    );
  });

  describe('happy path — gates 1, 2, 3 agree', () => {
    it('acceptMode is "autonomous" when stepType=autonomous is set on the parent step and exec state is present', () => {
      state.nodes = {
        root: { id: 'root', content: 'Root', children: ['step'], metadata: {} },
        step: { id: 'step', content: 'Step', children: ['bound'], metadata: { stepType: 'autonomous' } },
        bound: { id: 'bound', content: 'Bound', children: [], metadata: {} },
      };
      state.ancestorRegistry = { root: [], step: ['root'], bound: ['root', 'step'] };
      state.workflowExecutionStates = { bound: { state: 'running', terminalTabId: 'terminal-1', collaborating: true } };

      actions.handleAutonomousFeedback('bound', '# refined');

      expect(mockAcceptFeedbackCalls).toHaveLength(1);
      expect(mockAcceptFeedbackCalls[0].acceptMode).toBe('autonomous');
    });

    it('acceptMode is "autonomous" when stepType=autonomous is set directly on the bound node (self-is-step) and the node is tree-attached', () => {
      state.nodes = {
        root: { id: 'root', content: 'Root', children: ['bound'], metadata: {} },
        bound: { id: 'bound', content: 'Bound', children: [], metadata: { stepType: 'autonomous' } },
      };
      state.ancestorRegistry = { root: [], bound: ['root'] };
      state.workflowExecutionStates = { bound: { state: 'running', terminalTabId: 'terminal-1', collaborating: true } };

      actions.handleAutonomousFeedback('bound', '# refined');

      expect(mockAcceptFeedbackCalls).toHaveLength(1);
      expect(mockAcceptFeedbackCalls[0].acceptMode).toBe('autonomous');
    });
  });

  describe('autonomous step never falls through to manual-send-accept', () => {
    it('does NOT silently surface as manual-send-accept when the autonomous step is well-formed', async () => {
      state.nodes = {
        root: { id: 'root', content: 'Root', children: ['step'], metadata: {} },
        step: { id: 'step', content: 'Step', children: ['bound'], metadata: { stepType: 'autonomous' } },
        bound: { id: 'bound', content: 'Bound', children: [], metadata: {} },
      };
      state.ancestorRegistry = { root: [], step: ['root'], bound: ['root', 'step'] };
      state.workflowExecutionStates = { bound: { state: 'running', terminalTabId: 'terminal-1', collaborating: true } };

      actions.handleAutonomousFeedback('bound', '# refined');

      expect(mockAcceptFeedbackCalls[0]?.acceptMode).not.toBe('manual-send-accept');
    });

    it('logs a structured warning when handleAutonomousFeedback is forced into the fallback (no autonomous context resolves)', async () => {
      const { logger } = await import('../../../../services/logger');
      const warnMock = vi.mocked(logger.warn);
      warnMock.mockClear();

      // Force the fallback: a node with exec state but no stepType anywhere on
      // the ancestor chain. In production applyStepOutput's gate 1+2 fail-fast
      // would reject this before reaching handleAutonomousFeedback; the test
      // exercises handleAutonomousFeedback directly to verify the defensive log.
      state.nodes = {
        root: { id: 'root', content: 'Root', children: ['bound'], metadata: {} },
        bound: { id: 'bound', content: 'Bound', children: [], metadata: {} },
      };
      state.ancestorRegistry = { root: [], bound: ['root'] };
      state.workflowExecutionStates = { bound: { state: 'running', terminalTabId: 'terminal-1', collaborating: true } };

      actions.handleAutonomousFeedback('bound', '# refined');

      expect(warnMock).toHaveBeenCalled();
      const calls = warnMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((m) => m.includes('gate-miss') && m.includes('gate=3'))).toBe(true);
    });
  });
});

// Unified getAutonomousStepContext predicate tests live in
// src/shared/utils/tests/autonomousStepContext.test.ts.
