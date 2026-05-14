import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    debug: vi.fn(),
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

const { mockResolveContextFlags } = vi.hoisted(() => ({
  mockResolveContextFlags: vi.fn().mockReturnValue({ collaborate: false, execute: true }),
}));
vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => 'context-1',
    resolveContextFlags: (...args: unknown[]) => mockResolveContextFlags(...args),
    getContextDeclarations: () => [],
  };
});

const flagsForMode = (mode: 'collaborate' | 'execute') =>
  mode === 'execute' ? { collaborate: false, execute: true } : { collaborate: true, execute: false };
const mockResolveContextMode = {
  mockReturnValue: (mode: 'collaborate' | 'execute') => mockResolveContextFlags.mockReturnValue(flagsForMode(mode)),
};

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

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({
  mockNotifyWorkflowEvent: vi.fn(),
}));
vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: mockNotifyWorkflowEvent,
}));


describe('workflow auto-accept for autonomous collaborate steps', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation' | 'stuck'; terminalTabId: string; needsReview?: boolean; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
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
      workflowSessionMap: { 'session-pre': 'terminal-1' },
      contextDeclarations: [],
      sessionRegistry: {},
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
      const stripped = content.replace(/^#+\s*(\[.\]\s*)?/, '').split('\n')[0];
      return {
        nodes: { 'new-root': { id: 'new-root', content: stripped, children: [], metadata: {} } },
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
      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('should advance after Stop arrives when feedback already accepted', () => {
      vi.useFakeTimers();

      // Feedback arrives first — accept but don't advance (no Stop yet)
      actions.handleAutonomousFeedback('task-a', '# Task A');
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
      actions.handleAutonomousFeedback('task-a', '# Task A');

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
      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(mockExecuteCommand).toHaveBeenCalled();
    });

    it('should pass decomposition flag from step metadata to parser', () => {
      state.nodes['step-1'].metadata.decomposition = true;

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(mockParseFeedbackContent).toHaveBeenCalledWith('# Task A', true);
    });

    it('should pass false for decomposition when step has no decomposition flag', () => {
      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(mockParseFeedbackContent).toHaveBeenCalledWith('# Task A', false);
    });

    it('should show toast notification on successful auto-accept', () => {
      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('auto-accept'),
        expect.any(String)
      );
    });

    it('should advance the node after auto-accept when stopReceived is true', () => {
      actions.handleAutonomousFeedback('task-a', '# Task A');

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

    it('should notify alert on parse failure', () => {
      actions.handleAutonomousFeedback('task-a', 'not valid markdown');

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Feedback parse error', expect.any(String));
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

  describe('manual collaboration ownership during autonomous accept', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      state.workflowExecutionStates['task-a'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: true,
      };
    });

    it('should leave a manual collaboration registered for a different node intact', () => {
      actions.registerManualCollaboration('step-2', '/manual-feedback.md');

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(actions.findCollaborationByFeedbackFilePath('/manual-feedback.md'))
        .toEqual({ nodeId: 'step-2', kind: 'manual' });
    });

    it.todo('should not call AcceptFeedbackCommand with a payload that overwrites collaboratingNodeId when the active session is on a different node');
    it.todo('should not close the feedback panel for a file that owns an unrelated manual collaboration');
    it.todo('should not delete the manual session\'s temp feedback file when an autonomous step on another node finishes');
    it.todo('cross-file: an autonomous auto-accept in store A leaves a manual session in store B untouched');
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
      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-b']).toBeDefined();
      expect(state.workflowExecutionStates['task-b'].collaborating).toBe(true);
    });

    it('should auto-accept both nodes independently', () => {
      actions.handleAutonomousFeedback('task-a', '# Task A');
      actions.handleAutonomousFeedback('task-b', '# Task B');

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

    it('should call collaborateInTerminal with collaborate flags', () => {
      mockResolveContextMode.mockReturnValue('collaborate');

      actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', { collaborate: true, execute: false }, undefined);
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

  describe('findCollaborationByFeedbackFilePath', () => {
    const registeredPath = '/Users/test/Library/Application Support/Arborescent/temp-files/feedback-response-task-a.md';

    beforeEach(async () => {
      mockAutonomousCollaborate.mockImplementation(() => Promise.resolve(registeredPath));
      actions.startWorkflow('task-a', 'terminal-1');
      await Promise.resolve();
      await Promise.resolve();
    });

    it('should match when incoming path is identical to registered path', () => {
      expect(actions.findCollaborationByFeedbackFilePath(registeredPath)).toEqual({ nodeId: 'task-a', kind: 'autonomous' });
    });

    it('should match when incoming path has the same basename (filename encodes nodeId)', () => {
      const differentPrefix = '/private' + registeredPath;
      expect(actions.findCollaborationByFeedbackFilePath(differentPrefix)).toEqual({ nodeId: 'task-a', kind: 'autonomous' });
    });

    it('should match on basename when paths diverge (Library vs /private/var symlink realpath)', () => {
      const realpathStyle = '/private/tmp/feedback-response-task-a.md';
      expect(actions.findCollaborationByFeedbackFilePath(realpathStyle)).toEqual({ nodeId: 'task-a', kind: 'autonomous' });
    });

    it('should return null when no autonomous collaboration is registered', async () => {
      actions.stopWorkflow('task-a');
      await Promise.resolve();
      expect(actions.findCollaborationByFeedbackFilePath(registeredPath)).toBeNull();
    });

    it('should return null when filename does not match any registered collaboration', () => {
      expect(
        actions.findCollaborationByFeedbackFilePath('/tmp/feedback-response-other-node.md'),
      ).toBeNull();
    });

    it('should still support endsWith path matching for backward compatibility', () => {
      const suffixed = 'some/nested/prefix' + registeredPath;
      expect(actions.findCollaborationByFeedbackFilePath(suffixed)).toEqual({ nodeId: 'task-a', kind: 'autonomous' });
    });
  });

  describe('decomposition multi-root play-forward (PR1)', () => {
    it.todo('starts the workflow for each decomposed sibling sequentially on the same terminal in parsed.rootNodeIds order');
    it.todo('passes the full parsed.rootNodeIds array to AcceptFeedbackCommand so every decomposed root enters the merged tree');
    it.todo('still uses the single rootNodeId when decomposition produces exactly one root');
    it.todo('flashes and toasts each currently-running sibling like single-node advancement');
    it.todo('checkRecurse picks the next waiting decomposed sibling before falling back to the chain-traversal anchor');
    it.todo('halts mid-sequence with the existing recurse-limit toast when MAX_RECURSE_ITERATIONS is reached');
    it.todo('a manual or checkpoint next-step pauses the sequence on that sibling exactly like a non-decomposed handoff');
    it.todo('a decomposition that returns exactly one root advances normally without leaving any sibling pending');
    it.todo('stops the workflow with the parse-failure toast and never invokes AcceptFeedbackCommand when parsing fails on a decomposition response');
  });
});
