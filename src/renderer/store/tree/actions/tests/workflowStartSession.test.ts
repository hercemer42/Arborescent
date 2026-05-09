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

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
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
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  terminalNodeAssignments: Record<string, string>;
  contextDeclarations: Array<{ nodeId: string; content: string; icon: string; mode: 'execute' | 'collaborate' }>;
};

describe('startWorkflow — auto session routing (PR2)', () => {
  let state: State;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminals.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.window = { electron: {
      startKeepAwake: vi.fn(),
      stopKeepAwake: vi.fn(),
      terminalWrite: mockTerminalWrite,
      terminalGetCwd: vi.fn().mockResolvedValue(null),
      stopFeedbackFileWatcher: vi.fn().mockResolvedValue(undefined),
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
      terminalNodeAssignments: {},
      contextDeclarations: [],
    };

    const get = () => state;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      Object.assign(state, update);
    };

    actions = createWorkflowExecutionActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set as any,
      vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { flashNode: noop, scrollToNode: noop, startDeleteAnimation: noop, clearDeleteAnimation: noop } as any,
      mockAutonomousCollaborate,
      vi.fn(),
    );
  });

  describe('rule 7 / acceptance 1 — no prior session OR session lost → spawn fresh', () => {
    it('starts on the passed terminalId and does not call setActiveTerminal nor createNewTerminal when the node has no recorded session', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toEqual({
        state: 'running',
        terminalTabId: 'terminal-1',
      });
      expect(mockSetActiveTerminal).not.toHaveBeenCalled();
      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    });

    it('treats a session marked lost as no-prior-session — spawns fresh on the passed terminalId', async () => {
      state.nodes['task-a'].metadata.sessionId = 'sess-old';
      state.nodes['task-a'].metadata.sessionLiveness = 'lost';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-1');
      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    });
  });

  describe('rule 8a / acceptance 2 — alive-attached session in an open tab → focus tab, no duplicate (rule 9)', () => {
    it('focuses the existing tab and does not spawn a new terminal when the recorded sessionTabId is currently open', async () => {
      mockTerminals.push({ id: 'terminal-1' }, { id: 'terminal-2' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-attached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-2';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockSetActiveTerminal).toHaveBeenCalledWith('terminal-2');
      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-2');
    });

    it('does not produce a second tab bound to the same session id when start is invoked twice across a stop', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-attached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(mockSetActiveTerminal).toHaveBeenCalledTimes(2);
      expect(mockSetActiveTerminal).toHaveBeenNthCalledWith(1, 'terminal-1');
      expect(mockSetActiveTerminal).toHaveBeenNthCalledWith(2, 'terminal-1');
    });
  });

  describe('rule 8b / acceptance 3 — alive-detached or alive-attached without an open tab → resume in a new tab', () => {
    it('opens a new terminal and writes claude --resume <sessionId> when liveness is alive-detached', async () => {
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-detached';
      state.nodes['task-a'].metadata.sessionWorkingDirectory = '/Users/me/project';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).toHaveBeenCalledWith(expect.any(String), '/Users/me/project');
      expect(mockTerminalWrite).toHaveBeenCalledWith(
        'terminal-new',
        expect.stringContaining('claude --resume sess-1'),
      );
      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-new');
    });

    it('opens a new terminal and resumes when the recorded sessionTabId is no longer in the terminal store (post-restart alive-attached)', async () => {
      mockTerminals.push({ id: 'terminal-other' });
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-attached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-gone';
      state.nodes['task-a'].metadata.sessionWorkingDirectory = '/Users/me/project';

      await actions.startWorkflow('task-a', 'terminal-other');

      expect(mockCreateNewTerminal).toHaveBeenCalled();
      expect(mockTerminalWrite).toHaveBeenCalledWith(
        'terminal-new',
        expect.stringContaining('--resume sess-1'),
      );
    });

    it('does not mark the workflow running when resumeSession bails (e.g. createNewTerminal rejects) — must not leave a stale terminalTabId', async () => {
      mockCreateNewTerminal.mockRejectedValueOnce(new Error('terminal create failed'));
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-detached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-old-gone';
      state.nodes['task-a'].metadata.sessionWorkingDirectory = '/Users/me/project';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('acceptance 4 — stopped workflow + live session → continues that session', () => {
    it('does not spawn a new session when starting a previously stopped workflow whose session is still alive in an open tab', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-attached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockSetActiveTerminal.mockClear();
      mockCreateNewTerminal.mockClear();
      mockAutonomousCollaborate.mockClear();

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(mockSetActiveTerminal).toHaveBeenCalledWith('terminal-1');
      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });
  });

  describe('persistence — workflow session pointer survives a stop', () => {
    it('keeps sessionId on the node metadata after a stop, so the next start can route by liveness rather than spawning fresh', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-attached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');

      expect(state.nodes['task-a'].metadata.sessionId).toBe('sess-1');
      expect(state.nodes['task-a'].metadata.sessionLiveness).toBe('alive-attached');
    });
  });

  describe('reattach must not re-send the workflow prompt', () => {
    it('does not invoke clearSessionManager-driven prompt sending for the focus-existing-tab route', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-attached';
      state.nodes['task-a'].metadata.sessionTabId = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
      expect(mockTerminalWrite).not.toHaveBeenCalled();
    });

    it('does not invoke prompt sending for the resume-in-new-tab route after writing claude --resume', async () => {
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.nodes['task-a'].metadata.sessionLiveness = 'alive-detached';
      state.nodes['task-a'].metadata.sessionWorkingDirectory = '/Users/me/project';

      await actions.startWorkflow('task-a', 'terminal-1');

      const resumeWrites = mockTerminalWrite.mock.calls.filter(
        (call) => typeof call[1] === 'string' && (call[1] as string).includes('--resume sess-1'),
      );
      expect(resumeWrites).toHaveLength(1);
      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });
  });
});
