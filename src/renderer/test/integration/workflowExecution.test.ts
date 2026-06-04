import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions, WorkflowExecutionActions } from '../../store/tree/actions/workflowExecutionActions';
import { useTerminalStore, type TerminalInfo } from '../../store/terminal/terminalStore';

vi.mock('@/services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('@/store/toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

const { mockHasReceivedHookEvent } = vi.hoisted(() => ({
  mockHasReceivedHookEvent: { value: true },
}));
vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: mockHasReceivedHookEvent.value,
      hasLaunchedWorkflow: true,
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

vi.mock('../../services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/nodeHelpers')>();
  return {
    ...actual,
    resolveContextMode: () => 'execute',
  };
});

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments?: Record<string, string>;
};

function buildThreeStepWorkflow(): TestState {
  return {
    nodes: {
      'root': { id: 'root', content: 'Root', children: ['wf'], metadata: { isBlueprint: true } },
      'wf': { id: 'wf', content: 'Workflow', children: ['s1', 's2', 's3'], metadata: { isBlueprint: true, isWorkflow: true } },
      's1': { id: 's1', content: 'Step 1', children: ['task'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      's2': { id: 's2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      's3': { id: 's3', content: 'Step 3', children: [], metadata: { isBlueprint: true, stepType: 'manual' } },
      'task': { id: 'task', content: 'My Task', children: [], metadata: { isBlueprint: true } },
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      'root': [],
      'wf': ['root'],
      's1': ['root', 'wf'],
      's2': ['root', 'wf'],
      's3': ['root', 'wf'],
      'task': ['root', 'wf', 's1'],
    },
    workflowExecutionStates: {},
    workflowSessionMap: {},
    sessionRegistry: {},
  };
}

function createActions(stateRef: { current: TestState }) {
  const get = () => stateRef.current;
  const set = (partial: Partial<TestState>) => { stateRef.current = { ...stateRef.current, ...partial }; };
  const mockAutosave = vi.fn();
  const mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
  const mockVisualEffects = {
    flashNode: vi.fn(),
    scrollToNode: vi.fn(),
    startDeleteAnimation: vi.fn(),
    clearDeleteAnimation: vi.fn(),
  };
  return {
    actions: createWorkflowExecutionActions(get, set, mockAutosave, mockVisualEffects, mockAutonomousCollaborate),
    mockAutosave,
    mockAutonomousCollaborate,
    mockVisualEffects,
  };
}

describe('Integration: Workflow Execution', () => {
  let stateRef: { current: TestState };
  let actions: WorkflowExecutionActions;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasReceivedHookEvent.value = true;
    stateRef = { current: buildThreeStepWorkflow() };
    const created = createActions(stateRef);
    actions = created.actions;
    mockAutonomousCollaborate = created.mockAutonomousCollaborate;
  });

  describe('durable-binding Stop recovery after run-state loss', () => {
    const liveTerminal: TerminalInfo = {
      id: 'term-1',
      title: 'Terminal 1',
      cwd: '/tmp',
      shellCommand: 'bash',
      shellArgs: [],
      pinnedToBottom: false,
    };

    it('recovers the advance end-to-end when transient run-state was cleared by a reload', () => {
      vi.useFakeTimers();
      useTerminalStore.setState({ terminals: [liveTerminal] });
      const state = () => stateRef.current;
      try {
        void actions.startWorkflow('task', 'term-1');
        actions.registerSession('session-1', 'term-1');
        // the session is durably stamped onto the bound node
        expect(state().nodes['task'].metadata.sessionId).toBe('session-1');

        // announce_step_done persists the completed status on the bound node
        stateRef.current = {
          ...stateRef.current,
          nodes: {
            ...stateRef.current.nodes,
            task: {
              ...stateRef.current.nodes['task'],
              metadata: { ...stateRef.current.nodes['task'].metadata, status: 'completed' },
            },
          },
        };

        // a reload clears all transient run-state (initializeExecutionState contract)
        // while the node keeps its persisted sessionId + completed status
        stateRef.current = {
          ...stateRef.current,
          workflowExecutionStates: {},
          terminalNodeAssignments: {},
          workflowSessionMap: {},
        };

        actions.handleHookEvent({
          session_id: 'session-1',
          hook_event_name: 'Stop',
          terminal_id: 'term-1',
          explicit_submit_seen: true,
        });
        vi.advanceTimersByTime(1500);

        // the durable fallback re-seeded the running entry and the real advanceNode
        // advanced the node to the next step — the crux working end-to-end
        expect(state().nodes['s2'].children).toContain('task');
        expect(state().nodes['s1'].children).not.toContain('task');
        expect(state().workflowExecutionStates['task'].state).toBe('running');
      } finally {
        useTerminalStore.setState({ terminals: [] });
        vi.useRealTimers();
      }
    });
  });

  describe('full workflow traversal (autonomous → autonomous → manual)', () => {
    it('should advance through autonomous steps and stop at manual', () => {
      vi.useFakeTimers();
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(state().nodes['s1'].children).toContain('task');
      expect(mockAutonomousCollaborate).toHaveBeenCalledTimes(1);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(1500);

      expect(state().nodes['s2'].children).toContain('task');
      expect(state().nodes['s1'].children).not.toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's2']);
      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(mockAutonomousCollaborate).toHaveBeenCalledTimes(2);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s3'].children).toContain('task');
      expect(state().nodes['s2'].children).not.toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's3']);
      expect(state().workflowExecutionStates['task']).toBeUndefined();
      expect(mockAutonomousCollaborate).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('should complete workflow after all autonomous steps finish', () => {
      const state = () => stateRef.current;

      state().nodes['s3'].metadata.stepType = 'autonomous';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().workflowExecutionStates['task']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Workflow complete'),
        'success'
      );
      expect(state().nodes['s3'].children).toContain('task');
    });
  });

  describe('checkpoint step behavior', () => {
    it('should run at checkpoint step then set awaiting-validation when AI finishes', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'checkpoint';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'info',
        expect.objectContaining({ persistent: true, actions: expect.any(Array) })
      );
    });
  });

  describe('Stop completion gate — interrupt mid-task then unrelated turn', () => {
    it('autonomous step stays in flight when Stop arrives with explicit_submit_seen=false and advances on a subsequent explicit submit', () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({
        session_id: 'session-1',
        hook_event_name: 'Stop',
        explicit_submit_seen: false,
      });

      expect(state().nodes['s1'].children).toContain('task');
      expect(state().nodes['s2'].children).not.toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({
        session_id: 'session-1',
        hook_event_name: 'Stop',
        explicit_submit_seen: true,
      });

      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');
    });

    it('checkpoint step does not raise step-complete toast when Stop arrives with explicit_submit_seen=false', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'checkpoint';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({
        session_id: 'session-1',
        hook_event_name: 'Stop',
        explicit_submit_seen: true,
      });
      expect(state().nodes['s2'].children).toContain('task');
      mockAddToast.mockClear();

      actions.handleHookEvent({
        session_id: 'session-1',
        hook_event_name: 'Stop',
        explicit_submit_seen: false,
      });

      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  describe('nested workflow traversal', () => {
    beforeEach(() => {
      const state = stateRef.current;
      state.nodes['s2'].metadata.isWorkflow = true;
      state.nodes['s2'].children = ['s2a', 's2b'];
      state.nodes['s2a'] = { id: 's2a', content: 'Step 2a', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } };
      state.nodes['s2b'] = { id: 's2b', content: 'Step 2b', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } };
      state.ancestorRegistry['s2a'] = ['root', 'wf', 's2'];
      state.ancestorRegistry['s2b'] = ['root', 'wf', 's2'];
      state.nodes['s1'].metadata.stepType = 'autonomous';
      state.nodes['s3'].metadata.stepType = 'autonomous';
    });

    it('should traverse into nested workflow and back out depth-first', () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2a'].children).toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's2', 's2a']);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2b'].children).toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's2', 's2b']);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s3'].children).toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's3']);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task']).toBeUndefined();
    });
  });

  describe('parallel execution', () => {
    it('should advance two nodes independently without state crosstalk', () => {
      const state = () => stateRef.current;

      state().nodes['s1'].children.push('task2');
      state().nodes['task2'] = { id: 'task2', content: 'Task 2', children: [], metadata: { isBlueprint: true } };
      state().ancestorRegistry['task2'] = ['root', 'wf', 's1'];

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      void actions.startWorkflow('task2', 'term-2');
      actions.registerSession('session-2', 'term-2');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(state().workflowExecutionStates['task2'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().nodes['s1'].children).toContain('task2');
      expect(state().workflowExecutionStates['task2'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-2', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().nodes['s2'].children).toContain('task2');
    });
  });

  describe('disruption mid-workflow then restart', () => {
    it('should stop on terminal close and allow restart on new terminal', async () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');

      actions.handleTerminalClosed('term-1');
      expect(state().workflowExecutionStates['task']).toBeUndefined();

      // Must use startWorkflow again (not continueWorkflow — that's only for awaiting-validation)
      mockAutonomousCollaborate.mockClear();
      await actions.startWorkflow('task', 'term-2');
      actions.registerSession('session-2', 'term-2');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(state().workflowExecutionStates['task'].terminalTabId).toBe('term-2');
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task', 'term-2', expect.objectContaining({ collaborate: expect.any(Boolean), execute: expect.any(Boolean) }), undefined, expect.any(String));
    });

    it('should handle app restart mid-workflow', async () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.initializeExecutionState();

      // Running entries are cleared on restart
      expect(state().workflowExecutionStates['task']).toBeUndefined();
      expect(state().workflowSessionMap).toEqual({});
      expect(state().nodes['s2'].children).toContain('task');

      // Restart with new terminal
      await actions.startWorkflow('task', 'term-3');
      actions.registerSession('session-3', 'term-3');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
    });
  });

  describe('tree edits during execution', () => {
    it('should advance to correct step after steps are reordered', () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['wf'].children = ['s3', 's1', 's2'];

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s2'].children).toContain('task');
    });

    it('should advance to a newly inserted step', () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['s-new'] = { id: 's-new', content: 'New Step', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } };
      state().nodes['wf'].children = ['s1', 's-new', 's2', 's3'];
      state().ancestorRegistry['s-new'] = ['root', 'wf'];

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s-new'].children).toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's-new']);
    });

    it('should stop and notify when current step is deleted', () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');

      actions.handleStepDeleted('s1');

      expect(state().workflowExecutionStates['task']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Step removed'),
        'warning'
      );
    });
  });

  describe('step type changed mid-run', () => {
    it('should stop on arrival when next step changed to manual', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'autonomous';
      state().nodes['s3'].metadata.stepType = 'autonomous';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['s2'].metadata.stepType = 'manual';

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s2'].children).toContain('task');
      // Manual step: entry cleared
      expect(state().workflowExecutionStates['task']).toBeUndefined();
    });

    it('should run then set awaiting-validation on Stop when next step changed to checkpoint', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'autonomous';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['s2'].metadata.stepType = 'checkpoint';

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('awaiting-validation');
    });
  });

  describe('notification hook', () => {
    it('should stop and show message on Notification event', () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({
        session_id: 'session-1',
        hook_event_name: 'Notification',
        message: 'Something went wrong',
      });

      expect(state().workflowExecutionStates['task']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong'),
        'warning'
      );
    });
  });

  describe('ancestor registry consistency', () => {
    it('should maintain correct ancestry through full traversal', () => {
      const state = () => stateRef.current;

      state().nodes['s3'].metadata.stepType = 'autonomous';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's1']);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's2']);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's3']);

      expect(state().nodes['s1'].children).not.toContain('task');
      expect(state().nodes['s2'].children).not.toContain('task');
      expect(state().nodes['s3'].children).toContain('task');
    });
  });

  describe('start from mid-workflow position', () => {
    it('should start from current step without moving', () => {
      const state = () => stateRef.current;

      state().nodes['s1'].children = [];
      state().nodes['s2'].children = ['task'];
      state().ancestorRegistry['task'] = ['root', 'wf', 's2'];

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s3'].children).toContain('task');
    });
  });

  describe('continue from checkpoint', () => {
    it('should advance node when continuing from awaiting-validation at checkpoint', () => {
      const state = () => stateRef.current;

      state().nodes['s1'].metadata.stepType = 'checkpoint';

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      // First Stop at checkpoint → awaiting-validation
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('awaiting-validation');

      // User clicks Continue → advances to s2 and continues running
      actions.continueWorkflow('task', 'term-1');
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');
    });

    it('should traverse checkpoint → autonomous → manual with continue in between', () => {
      const state = () => stateRef.current;

      state().nodes['s1'].metadata.stepType = 'checkpoint';
      state().nodes['s2'].metadata.stepType = 'autonomous';
      // s3 is manual (default)

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      // Run at s1 (checkpoint), AI finishes → awaiting-validation
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('awaiting-validation');
      expect(state().nodes['s1'].children).toContain('task');

      // Continue → advances to s2 (autonomous), keeps running
      actions.continueWorkflow('task', 'term-1');
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      // AI finishes at s2 (autonomous) → advances to s3 (manual) → stops
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s3'].children).toContain('task');
      expect(state().workflowExecutionStates['task']).toBeUndefined();
    });

    it('should auto-complete workflow when last checkpoint step finishes', () => {
      const state = () => stateRef.current;

      state().nodes['s3'].metadata.stepType = 'checkpoint';

      // Move task to s3
      state().nodes['s1'].children = [];
      state().nodes['s3'].children = ['task'];
      state().ancestorRegistry['task'] = ['root', 'wf', 's3'];

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      // AI finishes at s3 (last step) → auto-completes
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });
  });

  describe('stop and restart', () => {
    it('should allow stopping a running workflow and restarting it', async () => {
      const state = () => stateRef.current;

      void actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      // Advance once
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');

      // Stop the workflow
      actions.stopWorkflow('task');
      expect(state().workflowExecutionStates['task']).toBeUndefined();

      // Restart — starts at current position (s2), not from beginning
      mockAutonomousCollaborate.mockClear();
      await actions.startWorkflow('task', 'term-1');
      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(state().nodes['s2'].children).toContain('task');
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task', 'term-1', expect.objectContaining({ collaborate: expect.any(Boolean), execute: expect.any(Boolean) }), undefined, expect.any(String));
    });
  });
});
