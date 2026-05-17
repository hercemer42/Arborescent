import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

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
      stepTimeoutMinutes: 10,
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

const {
  mockSetActiveTerminal,
  mockCreateNewTerminal,
  mockTerminalWrite,
  mockTerminals,
  mockAutonomousCollaborate,
} = vi.hoisted(() => ({
  mockSetActiveTerminal: vi.fn(),
  mockCreateNewTerminal: vi.fn(),
  mockTerminalWrite: vi.fn().mockResolvedValue(undefined),
  mockTerminals: [] as Array<{ id: string }>,
  mockAutonomousCollaborate: vi.fn().mockResolvedValue('/tmp/feedback.md'),
}));

vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      setActiveTerminal: mockSetActiveTerminal,
      createNewTerminal: mockCreateNewTerminal,
      terminals: mockTerminals,
    }),
  },
}));

type State = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation' | 'stuck'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
  contextDeclarations: Array<{ nodeId: string; content: string; icon: string; mode: 'execute' | 'collaborate' }>;
};

describe('workflow restart after stop — prompt must reach the terminal (bug: green arrow without dispatch)', () => {
  let state: State;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  const noop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminals.length = 0;
    global.window = { electron: {
      startKeepAwake: vi.fn(),
      stopKeepAwake: vi.fn(),
      terminalWrite: mockTerminalWrite,
      terminalGetCwd: vi.fn().mockResolvedValue(null),
      stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
    } } as unknown as Window & typeof globalThis;

    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: {
          id: 'workflow', content: 'Workflow', children: ['step-1'],
          metadata: { isBlueprint: true, isWorkflow: true },
        },
        'step-1': {
          id: 'step-1', content: 'Step 1', children: ['task-a'],
          metadata: { isBlueprint: true, stepType: 'autonomous' },
        },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
      sessionRegistry: {},
      terminalNodeAssignments: {},
      contextDeclarations: [],
    };

    const get = () => state;
    const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      Object.assign(state, update);
    };

    actions = createWorkflowExecutionActions(
      get as never,
      set as never,
      vi.fn(),
      { flashNode: noop, scrollToNode: noop, startDeleteAnimation: noop, clearDeleteAnimation: noop } as never,
      mockAutonomousCollaborate,
      vi.fn(),
    );
  });

  describe('stop → start on the same terminal (focus-existing-tab route)', () => {
    it('re-sends the workflow prompt to the same terminal on restart after stop', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      // First start (initial) — produces a send, then we stop.
      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockAutonomousCollaborate.mockClear();
      mockTerminalWrite.mockClear();

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-1',
        expect.any(Object),
        undefined,
      );
    });

    it('still focuses the mapped terminal rather than spawning a new one', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockSetActiveTerminal.mockClear();
      mockCreateNewTerminal.mockClear();

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(mockSetActiveTerminal).toHaveBeenCalledWith('terminal-1');
    });

    it('sends the prompt exactly once across a single stop → start cycle', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockAutonomousCollaborate.mockClear();

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop → kill terminal → resume session → start (resume-in-new-tab route)', () => {
    it('re-sends the workflow prompt to the freshly created terminal on restart', async () => {
      // Initial start binds session to terminal-1.
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');

      // User kills the terminal — drop it from the mocked terminals list and
      // clear the workflowSessionMap binding as the real terminalStore would.
      mockTerminals.length = 0;
      delete state.workflowSessionMap['sess-1'];

      // resume-in-new-tab spawns a fresh terminal.
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-resumed' };
        mockTerminals.push(created);
        return created;
      });
      mockAutonomousCollaborate.mockClear();
      mockTerminalWrite.mockClear();

      await actions.startWorkflow('task-a', null);

      expect(mockCreateNewTerminal).toHaveBeenCalledWith(
        expect.any(String),
        '/Users/me/project',
        'task-a',
      );
      expect(mockTerminalWrite).toHaveBeenCalledWith(
        'terminal-resumed',
        expect.stringContaining('claude --resume sess-1'),
      );
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-resumed',
        expect.any(Object),
        undefined,
      );
    });

    it('binds the workflow execution state to the new terminal', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');

      mockTerminals.length = 0;
      delete state.workflowSessionMap['sess-1'];

      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-resumed' };
        mockTerminals.push(created);
        return created;
      });

      await actions.startWorkflow('task-a', null);

      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-resumed');
    });
  });

  describe('guard: genuine reattach without a prior stop must not double-send', () => {
    it('does not re-send when the node is already running on the focused terminal', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      mockAutonomousCollaborate.mockClear();

      // No stop between starts — second start is a no-op (still running).
      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });
  });

  describe('dispatch outcome must drive the running indicator (no silent failure)', () => {
    it.todo('does not mark the node as running when the terminal-write rejects');
    it.todo('surfaces a toast/error when the dispatch path fails');
    it.todo('clears the green-arrow indicator if dispatch ultimately fails');
  });

  describe('resume-in-new-tab readiness (deferred)', () => {
    it.todo('waits for SessionStart from the resumed claude process before sending the workflow prompt, so the prompt does not race claude --resume startup');
    it.todo('respects clearSession=true on the step by issuing /clear after the resumed session is ready, not before claude --resume has finished initializing');
  });
});
