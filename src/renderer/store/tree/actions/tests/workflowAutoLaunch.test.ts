import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockTerminalWrite } = vi.hoisted(() => ({
  mockTerminalWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('window', {
  electron: {
    terminalWrite: mockTerminalWrite,
    terminalGetCwd: vi.fn().mockResolvedValue(null),
    startKeepAwake: vi.fn(),
    stopKeepAwake: vi.fn(),
    stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
  },
});

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: '', nodeContent: 'prompt text' }),
    getAppliedContextIdWithInheritance: () => null,
    resolveContextMode: () => 'execute',
    getContextDeclarations: () => [],
  };
});

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

vi.mock('@/services/feedback/feedbackService', () => ({ parseFeedbackContent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));

const { mockTerminals } = vi.hoisted(() => ({
  mockTerminals: [] as Array<{ id: string }>,
}));

vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      setActiveTerminal: vi.fn(),
      createNewTerminal: vi.fn(),
      updateTerminal: vi.fn(),
      terminals: mockTerminals,
    }),
  },
}));

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, {
    state: 'running' | 'awaiting-validation';
    terminalTabId: string;
    needsReview?: boolean;
    collaborating?: boolean;
    stopReceived?: boolean;
    clearing?: boolean;
  }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  terminalNodeAssignments: Record<string, string>;
};

function buildState(stepMetadata: Record<string, unknown> = { stepType: 'autonomous' }): TestState {
  return {
    nodes: {
      root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
      workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, ...stepMetadata } },
      'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
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
    contextDeclarations: [],
    terminalNodeAssignments: {},
  };
}

describe('Auto-launch — Claude is started in fresh terminals before the prompt is sent', () => {
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockTerminalWrite.mockClear();
    mockTerminalWrite.mockResolvedValue(undefined);
    mockTerminals.length = 0;

    state = buildState();
    setState = (partial) => { state = { ...state, ...partial }; };

    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
    mockExecuteCommand = vi.fn((cmd: { execute: () => void }) => cmd.execute());
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
      mockExecuteCommand,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushMicrotasks(): Promise<void> {
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  }

  describe('Fresh terminal — no prior workflowSessionMap entry', () => {
    it('writes "claude\\r" to the target terminal before any prompt is sent', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();

      const claudeWrites = mockTerminalWrite.mock.calls.filter(
        ([, payload]) => payload === 'claude\r',
      );
      expect(claudeWrites).toHaveLength(1);
      expect(claudeWrites[0][0]).toBe('terminal-fresh');
    });

    it('writes "claude\\r" before invoking the autonomous-collaborate prompt', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });

    it('sends the workflow prompt only after SessionStart arrives — never typed at the shell beforehand', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();

      // No prompt yet
      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();

      // SessionStart fires for the new terminal
      actions.registerSession('session-new', 'terminal-fresh');
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-fresh',
        expect.any(Object),
        undefined,
        expect.any(String),
      );
    });

    it('captures the new sessionId onto the running node after SessionStart', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();
      actions.registerSession('session-new', 'terminal-fresh');
      await flushMicrotasks();

      expect(state.nodes['task-a'].metadata.sessionId).toBe('session-new');
    });
  });

  describe('Terminal already has a session — manual-Claude-then-Start', () => {
    beforeEach(() => {
      // Simulate user already ran `claude` and SessionStart arrived first.
      state.workflowSessionMap = { 'session-pre': 'terminal-1' };
    });

    it('does NOT write "claude\\r" when a session is already mapped to the target terminal', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      const claudeWrites = mockTerminalWrite.mock.calls.filter(
        ([, payload]) => payload === 'claude\r',
      );
      expect(claudeWrites).toHaveLength(0);
    });

    it('does NOT double-spawn — only one Claude session ever runs in the terminal', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      // No new SessionStart needed — the existing session is reused.
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-1',
        expect.any(Object),
        undefined,
        expect.any(String),
      );
    });

    it.todo('captures the existing sessionId onto the running node so Resume session works afterwards (deferred to PR3 alongside capture-on-Send)');
  });

  describe('clearSession === true — fresh terminal (auto-launch path)', () => {
    beforeEach(() => {
      state = buildState({ stepType: 'autonomous', clearSession: true });
      // No workflowSessionMap entry — fresh terminal.
      actions = createWorkflowExecutionActions(
        () => state,
        setState,
        mockTriggerAutosave,
        mockVisualEffects,
        mockAutonomousCollaborate,
        mockExecuteCommand,
      );
    });

    it('skips /clear when auto-launch fires — the new session is already clean', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();

      const clearWrites = mockTerminalWrite.mock.calls.filter(
        ([, payload]) => typeof payload === 'string' && payload.includes('/clear'),
      );
      expect(clearWrites).toHaveLength(0);
    });

    it('sequences as launch → SessionStart → prompt with no /clear in between', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();

      // Step 1: claude\r is written
      const writes = mockTerminalWrite.mock.calls.map((call) => call[1]);
      expect(writes).toContain('claude\r');

      // Step 2: SessionStart arrives → triggers prompt; no /clear in between
      actions.registerSession('session-new', 'terminal-fresh');
      await flushMicrotasks();

      const allWrites = mockTerminalWrite.mock.calls.map((call) => call[1]);
      const clearAppearances = allWrites.filter((p) => typeof p === 'string' && p.includes('/clear'));
      expect(clearAppearances).toHaveLength(0);
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-fresh',
        expect.any(Object),
        undefined,
        expect.any(String),
      );
    });
  });

  describe('clearSession === true — reattach to alive session (existing behaviour preserved)', () => {
    beforeEach(() => {
      state = buildState({ stepType: 'autonomous', clearSession: true });
      // Existing session on the terminal — reattach path.
      state.workflowSessionMap = { 'session-existing': 'terminal-1' };
      actions = createWorkflowExecutionActions(
        () => state,
        setState,
        mockTriggerAutosave,
        mockVisualEffects,
        mockAutonomousCollaborate,
        mockExecuteCommand,
      );
    });

    it('writes /clear before the prompt — auto-launch is skipped because session is alive', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      const clearWrite = mockTerminalWrite.mock.calls.find(
        ([, payload]) => typeof payload === 'string' && payload.includes('/clear'),
      );
      expect(clearWrite).toBeDefined();
      expect(clearWrite?.[0]).toBe('terminal-1');

      // No claude\r should fire — the session is alive
      const claudeWrites = mockTerminalWrite.mock.calls.filter(
        ([, payload]) => payload === 'claude\r',
      );
      expect(claudeWrites).toHaveLength(0);
    });

    it('sends the prompt after SessionStart source:"clear" confirmation arrives (existing /clear flow preserved)', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      actions.registerSession('session-cleared', 'terminal-1', 'clear');
      vi.advanceTimersByTime(500);
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-1',
        expect.any(Object),
        undefined,
        expect.any(String),
      );
    });
  });

  describe('Recurse advances do NOT auto-launch — they reuse the parent session', () => {
    it.todo('tier-(a) recurse: parent session alive in same terminal — no claude\\r written when next sibling starts');
    it.todo('tier-(b) recurse: parent session alive in different open tab — focus-existing-tab path, no claude\\r written');
    it.todo('only tier-(c) recurse fallback (parent session lost) auto-launches — fresh spawn on user terminal');
  });

  describe('stopWorkflow between claude\\r and SessionStart cancels the pending prompt', () => {
    it('stopping the workflow before SessionStart arrives prevents the prompt from being sent', async () => {
      await actions.startWorkflow('task-a', 'terminal-fresh');
      await flushMicrotasks();

      // claude\r was written
      expect(mockTerminalWrite).toHaveBeenCalledWith('terminal-fresh', 'claude\r');

      // User stops before SessionStart arrives
      actions.stopWorkflow('task-a');

      // SessionStart eventually arrives (e.g. user manually ran claude)
      actions.registerSession('session-new', 'terminal-fresh');
      await flushMicrotasks();

      // No prompt should be delivered
      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });
  });

  describe('Disruption reactions clear pending launch entries', () => {
    it.todo('terminal close cancels a pending launch — no prompt fires when SessionStart later arrives');
    it.todo('node delete on the running node cancels its pending launch');
    it.todo('step delete cancels pending launches for descendants of that step');
    it.todo('manual move (drag/cut-paste/indent) cancels pending launch');
  });

  describe('Off-PATH claude — workflow stalls and step-timeout fires', () => {
    it.todo('claude not on PATH: SessionStart never arrives, no prompt is sent, existing 15-min step-timeout toast fires unchanged');
  });

  describe('Concurrent / repeated interactions', () => {
    it.todo('repeated startWorkflow on the same fresh terminal does not write claude\\r twice');
    it.todo('startWorkflow on fresh terminal-A and fresh terminal-B in parallel each get their own claude\\r');
  });

  describe('Boundary inputs', () => {
    it.todo('startWorkflow with a null terminalId does not write claude\\r');
    it.todo('startWorkflow on a node with no enclosing workflow step is a no-op (auto-launch never fires)');
  });
});
