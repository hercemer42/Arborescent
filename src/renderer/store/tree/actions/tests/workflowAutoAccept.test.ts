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

const { mockResolveContextMode } = vi.hoisted(() => ({
  mockResolveContextMode: vi.fn().mockReturnValue('execute'),
}));
vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => 'context-1',
    resolveContextMode: (...args: unknown[]) => mockResolveContextMode(...args),
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

const { mockParseFeedbackContent } = vi.hoisted(() => ({
  mockParseFeedbackContent: vi.fn(),
}));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

const { mockAcceptFeedbackExecute } = vi.hoisted(() => ({
  mockAcceptFeedbackExecute: vi.fn(),
}));
vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: mockAcceptFeedbackExecute,
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));


describe('workflow auto-accept for autonomous collaborate steps', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
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
          children: ['step-1', 'step-2'],
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
        'task-a': {
          id: 'task-a',
          content: 'Task A',
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
        'task-a': ['root', 'workflow', 'step-1'],
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
    mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) =>
      Promise.resolve(`/tmp/feedback-response-${nodeId}.md`)
    );
    mockExecuteCommand = vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute());
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    mockParseFeedbackContent.mockImplementation((content: string) => {
      if (!content || !content.startsWith('#')) return null;
      return {
        nodes: { 'new-root': { id: 'new-root', content, children: [], metadata: {} } },
        rootNodeId: 'new-root',
        rootNodeIds: ['new-root'],
        nodeCount: 1,
      };
    });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockVisualEffects,
      mockAutonomousCollaborate,
      mockExecuteCommand
    );
  });

  describe('Stop hook deferral for collaborate mode', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should set stopReceived instead of advancing when collaborating flag is true', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-a'].stopReceived).toBe(true);
      // Node should NOT have advanced to step-2
      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).not.toContain('task-a');
    });

    it('should advance normally when collaborating flag is not set', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
      };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('should let needsReview take precedence over collaborating flag', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        needsReview: true,
      };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(state.nodes['step-1'].children).toContain('task-a');
    });

    it('should set awaiting-validation as normal for checkpoint steps with collaborate context', () => {
      state.nodes['step-1'].metadata.stepType = 'checkpoint';
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });
  });

  describe('timing: both orderings', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };
    });

    it('should advance after feedback arrives when Stop already received', () => {
      // Stop arrives first
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state.workflowExecutionStates['task-a'].stopReceived).toBe(true);
      expect(state.nodes['step-1'].children).toContain('task-a');

      // Feedback arrives second — should trigger accept + advance
      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('should advance after Stop arrives when feedback already accepted', () => {
      vi.useFakeTimers();

      // Feedback arrives first — accept but don't advance (no Stop yet)
      actions.handleAutonomousFeedback('task-a', '# Updated content');
      expect(state.workflowExecutionStates['task-a']?.collaborating).toBeFalsy();

      // Stop arrives second — should trigger normal advance
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-a');

      vi.useRealTimers();
    });

    it('should not advance if workflow was stopped by user before both signals arrive', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      actions.stopWorkflow('task-a');

      // Feedback arrives after stop — should be no-op
      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.nodes['step-1'].children).toContain('task-a');
    });
  });

  describe('auto-accept flow', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: true,
      };
    });

    it('should execute AcceptFeedbackCommand via executeCommand', () => {
      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(mockExecuteCommand).toHaveBeenCalled();
    });

    it('should pass decomposition flag from step metadata to parser', () => {
      state.nodes['step-1'].metadata.decomposition = true;

      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(mockParseFeedbackContent).toHaveBeenCalledWith('# Updated content', true);
    });

    it('should pass false for decomposition when step has no decomposition flag', () => {
      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(mockParseFeedbackContent).toHaveBeenCalledWith('# Updated content', false);
    });

    it('should show toast notification on successful auto-accept', () => {
      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('auto-accept'),
        expect.any(String)
      );
    });

    it('should advance the node after auto-accept when stopReceived is true', () => {
      actions.handleAutonomousFeedback('task-a', '# Updated content');

      expect(state.nodes['step-2'].children).toContain('task-a');
    });
  });

  describe('parse failure handling', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: true,
      };
    });

    it('should pause workflow with error toast on malformed content', () => {
      actions.handleAutonomousFeedback('task-a', 'not valid markdown content at all{}[]');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('could not be parsed'),
        'error'
      );
    });

    it('should not advance the node on parse failure', () => {
      actions.handleAutonomousFeedback('task-a', '');

      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).not.toContain('task-a');
    });

    it('should be a no-op when the node no longer exists', () => {
      delete state.nodes['task-a'];

      expect(() => {
        actions.handleAutonomousFeedback('task-a', '# Content');
      }).not.toThrow();
    });

    it('should be a no-op when the node has no execution state', () => {
      state.workflowExecutionStates = {};

      expect(() => {
        actions.handleAutonomousFeedback('task-a', '# Content');
      }).not.toThrow();

      expect(state.nodes['step-1'].children).toContain('task-a');
    });
  });

  describe('concurrent autonomous collaborations', () => {
    beforeEach(() => {
      state.nodes['step-1'].children = ['task-a', 'task-b'];
      state.nodes['task-b'] = {
        id: 'task-b',
        content: 'Task B',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];

      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: true,
      };
      state.workflowExecutionStates['task-b'] = {
        state: 'running',
        terminalTabId: 'terminal-2',
        collaborating: true,
        stopReceived: true,
      };
    });

    it('should auto-accept one node without affecting the other', () => {
      actions.handleAutonomousFeedback('task-a', '# Updated A');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-b']).toBeDefined();
      expect(state.workflowExecutionStates['task-b'].collaborating).toBe(true);
    });

    it('should auto-accept both nodes independently', () => {
      actions.handleAutonomousFeedback('task-a', '# Updated A');
      actions.handleAutonomousFeedback('task-b', '# Updated B');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-b');
    });
  });

  describe('manual and checkpoint collaboration unchanged', () => {
    it('should not auto-accept for checkpoint steps — Stop hook sets awaiting-validation', () => {
      state.nodes['step-1'].metadata.stepType = 'checkpoint';
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should not auto-accept for manual steps — Stop hook is a no-op', () => {
      state.nodes['step-1'].metadata.stepType = undefined;
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-1'].children).toContain('task-a');
    });

    it('should not interfere with collaboratingNodeId when autonomous collaboration is running', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };

      actions.handleAutonomousFeedback('task-a', '# Content');
    });
  });

  describe('collaborate flag on sendContentToTerminal', () => {
    it('should set collaborating flag when routing to collaborate mode', () => {
      mockResolveContextMode.mockReturnValue('collaborate');

      actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a'].collaborating).toBe(true);
    });

    it('should not set collaborating flag for execute mode', () => {
      mockResolveContextMode.mockReturnValue('execute');

      actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a'].collaborating).toBeUndefined();
    });

    it('should call collaborateInTerminal when mode is collaborate', () => {
      mockResolveContextMode.mockReturnValue('collaborate');

      actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1');
    });
  });

  describe('cleanup on workflow disruption', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };
    });

    it('should clean up autonomous collaboration state when workflow is stopped', () => {
      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should clean up autonomous collaboration state when terminal is closed', () => {
      actions.handleTerminalClosed('terminal-1');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should clean up autonomous collaboration state when node is deleted', () => {
      actions.handleNodeDeleted('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should clean up autonomous collaboration state when node is moved manually', () => {
      actions.handleNodeMovedManually('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should clean up all autonomous collaboration state on app restart', () => {
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should not trigger auto-accept after workflow is stopped', () => {
      actions.stopWorkflow('task-a');

      // Feedback arrives after stop
      actions.handleAutonomousFeedback('task-a', '# Late content');

      // Node should not have moved
      expect(state.nodes['step-1'].children).toContain('task-a');
    });
  });
});
