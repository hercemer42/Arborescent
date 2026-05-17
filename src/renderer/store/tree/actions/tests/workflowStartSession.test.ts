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
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation' | 'stuck'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
  contextDeclarations: Array<{ nodeId: string; content: string; icon: string; mode: 'execute' | 'collaborate' }>;
};

describe('startWorkflow — auto session routing (PR1)', () => {
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

  describe('no prior session → spawn fresh', () => {
    it('starts on the passed terminalId when the node has no recorded session', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toEqual({
        state: 'running',
        terminalTabId: 'terminal-1',
      });
      expect(mockSetActiveTerminal).not.toHaveBeenCalled();
      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    });

    it('spawns fresh when sessionId is set but workflowSessionMap has no entry (alive-detached with no open tab)', async () => {
      state.nodes['task-a'].metadata.sessionId = 'sess-old';
      // workflowSessionMap is empty — session is detached with no recorded terminal open
      // sessionRegistry has cwd so resume-in-new-tab path fires
      state.sessionRegistry['sess-old'] = { cwd: '/some/path' };
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).toHaveBeenCalledWith(expect.any(String), '/some/path', 'task-a');
    });
  });

  describe('alive-attached — session in workflowSessionMap with open tab → focus tab', () => {
    it('focuses the mapped terminal and does not spawn a new one', async () => {
      mockTerminals.push({ id: 'terminal-1' }, { id: 'terminal-2' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-2';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockSetActiveTerminal).toHaveBeenCalledWith('terminal-2');
      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-2');
    });

    it('does not produce a second tab when start is invoked twice across a stop', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(mockSetActiveTerminal).toHaveBeenCalledTimes(2);
    });
  });

  describe('alive-detached — sessionId set, workflowSessionMap has no mapping → resume in new tab', () => {
    it('opens a new terminal at registry cwd and writes claude --resume', async () => {
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).toHaveBeenCalledWith(expect.any(String), '/Users/me/project', 'task-a');
      expect(mockTerminalWrite).toHaveBeenCalledWith(
        'terminal-new',
        expect.stringContaining('claude --resume sess-1'),
      );
      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-new');
    });

    it('opens a new terminal when the previously-mapped terminal is no longer open', async () => {
      mockTerminals.push({ id: 'terminal-other' });
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-gone';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-other');

      expect(mockCreateNewTerminal).toHaveBeenCalled();
      expect(mockTerminalWrite).toHaveBeenCalledWith(
        'terminal-new',
        expect.stringContaining('--resume sess-1'),
      );
    });

    it('falls back to the user-supplied terminal when createNewTerminal rejects', async () => {
      mockCreateNewTerminal.mockRejectedValueOnce(new Error('terminal create failed'));
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-1');
    });

    it('does NOT pass the literal "Resume" as the new tab title — uses task title or Terminal N fallback', async () => {
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].content = 'Audit feedback regression';
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-1');

      const titleArg = mockCreateNewTerminal.mock.calls[0][0];
      expect(titleArg).not.toBe('Resume');
      expect(titleArg).toBe('Audit feedback regression');
    });
  });

  describe('stopped workflow + live session → reuses the tab and re-sends the prompt', () => {
    it('does not spawn a new session when the session is still alive in an open tab', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockSetActiveTerminal.mockClear();
      mockCreateNewTerminal.mockClear();
      mockAutonomousCollaborate.mockClear();

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockCreateNewTerminal).not.toHaveBeenCalled();
      expect(mockSetActiveTerminal).toHaveBeenCalledWith('terminal-1');
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-1',
        expect.any(Object),
        undefined,
      );
    });
  });

  describe('sessionId persists through stop', () => {
    it('keeps sessionId on the node after a stop so the next start can route correctly', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');

      expect(state.nodes['task-a'].metadata.sessionId).toBe('sess-1');
    });
  });

  describe('user-initiated start sends the workflow prompt on every route', () => {
    it('sends the prompt on the focus-existing-tab route', async () => {
      mockTerminals.push({ id: 'terminal-1' });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.workflowSessionMap['sess-1'] = 'terminal-1';

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-1',
        expect.any(Object),
        undefined,
      );
    });

    it('sends the prompt on the resume-in-new-tab route after writing claude --resume', async () => {
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.sessionRegistry['sess-1'] = { cwd: '/Users/me/project' };

      await actions.startWorkflow('task-a', 'terminal-1');

      const resumeWrites = mockTerminalWrite.mock.calls.filter(
        (call) => typeof call[1] === 'string' && (call[1] as string).includes('--resume sess-1'),
      );
      expect(resumeWrites).toHaveLength(1);
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith(
        'task-a',
        'terminal-new',
        expect.any(Object),
        undefined,
      );
    });
  });

  describe('registerSession — writes sessionRegistry cwd at SessionStart', () => {
    it('writes sessionRegistry[sessionId].cwd from the terminal live cwd on SessionStart', async () => {
      const mockGetCwd = vi.fn().mockResolvedValue('/live/cwd');
      global.window.electron.terminalGetCwd = mockGetCwd;

      await actions.startWorkflow('task-a', 'terminal-1');
      actions.registerSession('sess-new', 'terminal-1');

      await vi.waitFor(() => {
        expect(state.sessionRegistry['sess-new']).toBeDefined();
      });
      expect(state.sessionRegistry['sess-new'].cwd).toBe('/live/cwd');
    });

    it('maps sessionId to terminalId in workflowSessionMap on SessionStart', () => {
      actions.registerSession('sess-new', 'terminal-1');
      expect(state.workflowSessionMap['sess-new']).toBe('terminal-1');
    });

    it('captures sessionId on the running node on SessionStart', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      actions.registerSession('sess-new', 'terminal-1');
      expect(state.nodes['task-a'].metadata.sessionId).toBe('sess-new');
    });

    it('does NOT write sessionLiveness or sessionTabId onto the node on SessionStart', async () => {
      await actions.startWorkflow('task-a', 'terminal-1');
      actions.registerSession('sess-new', 'terminal-1');
      expect(state.nodes['task-a'].metadata.sessionLiveness).toBeUndefined();
      expect(state.nodes['task-a'].metadata.sessionTabId).toBeUndefined();
    });

    it('replaces existing workflowSessionMap entry for the same terminal', () => {
      state.workflowSessionMap['sess-old'] = 'terminal-1';
      actions.registerSession('sess-new', 'terminal-1');
      expect(state.workflowSessionMap['sess-old']).toBeUndefined();
      expect(state.workflowSessionMap['sess-new']).toBe('terminal-1');
    });
  });

  describe('bindSessionTab — collapse to workflowSessionMap only (no node writes)', () => {
    it('updates workflowSessionMap when bindSessionTab is called via resumeSession', async () => {
      mockCreateNewTerminal.mockImplementation(async () => {
        const created = { id: 'terminal-new' };
        mockTerminals.push(created);
        return created;
      });
      state.nodes['task-a'].metadata.sessionId = 'sess-1';
      state.sessionRegistry['sess-1'] = { cwd: '/project' };

      await actions.resumeSession('task-a');

      expect(state.workflowSessionMap['sess-1']).toBe('terminal-new');
    });

    it.todo('bindSessionTab does NOT write sessionLiveness or sessionTabId onto any node');
    it.todo('bindSessionTab does NOT call rebindNodesForSession (function is deleted in PR1)');
  });
});
