import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions, WorkflowExecutionActions } from '../../store/tree/actions/workflowExecutionActions';

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
      stepTimeoutMinutes: 10,
      markHookEventReceived: vi.fn(),
    }),
  },
}));

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, { state: 'idle' | 'running' | 'paused'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
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
  };
}

function createActions(stateRef: { current: TestState }) {
  const get = () => stateRef.current;
  const set = (partial: Partial<TestState>) => { stateRef.current = { ...stateRef.current, ...partial }; };
  const mockAutosave = vi.fn();
  const mockVisualEffects = {
    flashNode: vi.fn(),
    scrollToNode: vi.fn(),
    startDeleteAnimation: vi.fn(),
    clearDeleteAnimation: vi.fn(),
  };
  return {
    actions: createWorkflowExecutionActions(get, set, mockAutosave, mockVisualEffects),
    mockAutosave,
    mockVisualEffects,
  };
}

describe('Integration: Workflow Execution', () => {
  let stateRef: { current: TestState };
  let actions: WorkflowExecutionActions;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasReceivedHookEvent.value = true;
    stateRef = { current: buildThreeStepWorkflow() };
    const created = createActions(stateRef);
    actions = created.actions;
  });

  describe('full workflow traversal (autonomous → autonomous → manual)', () => {
    it('should advance through autonomous steps and stop at manual', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(state().nodes['s1'].children).toContain('task');
      expect(mockExecuteInTerminal).toHaveBeenCalledTimes(1);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s2'].children).toContain('task');
      expect(state().nodes['s1'].children).not.toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's2']);
      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(mockExecuteInTerminal).toHaveBeenCalledTimes(2);

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s3'].children).toContain('task');
      expect(state().nodes['s2'].children).not.toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's3']);
      expect(state().workflowExecutionStates['task'].state).toBe('paused');
      expect(mockExecuteInTerminal).toHaveBeenCalledTimes(2);
    });

    it('should complete workflow after all autonomous steps finish', () => {
      const state = () => stateRef.current;

      state().nodes['s3'].metadata.stepType = 'autonomous';

      actions.startWorkflow('task', 'term-1');
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
    it('should run at checkpoint step then pause when AI finishes', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'checkpoint';

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('paused');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Step complete'),
        'info'
      );
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

      actions.startWorkflow('task', 'term-1');
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

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.startWorkflow('task2', 'term-2');
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

  describe('disruption mid-workflow then resume', () => {
    it('should pause on terminal close and resume on new terminal', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');

      actions.handleTerminalClosed('term-1');
      expect(state().workflowExecutionStates['task'].state).toBe('paused');

      mockExecuteInTerminal.mockClear();
      actions.resumeWorkflow('task', 'term-2');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
      expect(state().workflowExecutionStates['task'].terminalTabId).toBe('term-2');
      expect(mockExecuteInTerminal).toHaveBeenCalledWith('term-2', expect.any(String));

      actions.registerSession('session-2', 'term-2');
      actions.handleHookEvent({ session_id: 'session-2', hook_event_name: 'Stop' });

      expect(state().nodes['s3'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('paused');
    });

    it('should handle app restart mid-workflow', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.initializeExecutionState();

      expect(state().workflowExecutionStates['task'].state).toBe('paused');
      expect(state().workflowSessionMap).toEqual({});
      expect(state().nodes['s2'].children).toContain('task');

      actions.resumeWorkflow('task', 'term-3');
      actions.registerSession('session-3', 'term-3');

      expect(state().workflowExecutionStates['task'].state).toBe('running');
    });
  });

  describe('tree edits during execution', () => {
    it('should advance to correct step after steps are reordered', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['wf'].children = ['s3', 's1', 's2'];

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s2'].children).toContain('task');
    });

    it('should advance to a newly inserted step', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['s-new'] = { id: 's-new', content: 'New Step', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } };
      state().nodes['wf'].children = ['s1', 's-new', 's2', 's3'];
      state().ancestorRegistry['s-new'] = ['root', 'wf'];

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s-new'].children).toContain('task');
      expect(state().ancestorRegistry['task']).toEqual(['root', 'wf', 's-new']);
    });

    it('should pause and notify when current step is deleted', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');

      actions.handleStepDeleted('s1');

      expect(state().workflowExecutionStates['task'].state).toBe('paused');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Step removed'),
        'warning'
      );
    });
  });

  describe('step type changed mid-run', () => {
    it('should pause on arrival when next step changed to manual', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'autonomous';
      state().nodes['s3'].metadata.stepType = 'autonomous';

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['s2'].metadata.stepType = 'manual';

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('paused');
    });

    it('should run then pause on Stop when next step changed to checkpoint', () => {
      const state = () => stateRef.current;

      state().nodes['s2'].metadata.stepType = 'autonomous';

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      state().nodes['s2'].metadata.stepType = 'checkpoint';

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().workflowExecutionStates['task'].state).toBe('paused');
    });
  });

  describe('notification hook', () => {
    it('should pause and show message on Notification event', () => {
      const state = () => stateRef.current;

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      actions.handleHookEvent({
        session_id: 'session-1',
        hook_event_name: 'Notification',
        message: 'Something went wrong',
      });

      expect(state().workflowExecutionStates['task'].state).toBe('paused');
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

      actions.startWorkflow('task', 'term-1');
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

      actions.startWorkflow('task', 'term-1');
      actions.registerSession('session-1', 'term-1');

      expect(state().nodes['s2'].children).toContain('task');
      expect(state().workflowExecutionStates['task'].state).toBe('running');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state().nodes['s3'].children).toContain('task');
    });
  });
});
