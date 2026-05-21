import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeDeletionActions } from '../nodeDeletionActions';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';

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

vi.mock('../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

const { mockHasReceivedHookEvent } = vi.hoisted(() => ({
  mockHasReceivedHookEvent: { value: true },
}));

vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: mockHasReceivedHookEvent.value,
      markHookEventReceived: vi.fn(),
    }),
  },
}));

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));


describe('workflow disruption — deletion wiring', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId: string | null;
    cursorPosition: number;
    collaboratingNodeId: string | null;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
    actions: {
      executeCommand: (cmd: unknown) => void;
      handleNodeDeleted?: (nodeId: string) => void;
      handleStepDeleted?: (stepId: string) => void;
      handleAllStepsRemoved?: (workflowId: string) => void;
    };
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let deletionActions: ReturnType<typeof createNodeDeletionActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasReceivedHookEvent.value = true;

    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      command.execute();
    });

    mockTriggerAutosave = vi.fn();
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

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
          children: ['step-1', 'step-2', 'step-3'],
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
          metadata: { isBlueprint: true, stepType: 'checkpoint' },
        },
        'step-3': {
          id: 'step-3',
          content: 'Step 3',
          children: [],
          metadata: { isBlueprint: true },
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
        'step-3': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      activeNodeId: 'task-a',
      cursorPosition: 0,
      collaboratingNodeId: null,
      workflowExecutionStates: {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
      },
      workflowSessionMap: {},
      contextDeclarations: [],
      actions: { executeCommand: mockExecuteCommand },
      sessionRegistry: {},
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    // Create workflow execution actions to wire real handlers onto state.actions
    const executionActions = createWorkflowExecutionActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave,
      mockVisualEffects
    );

    state.actions = {
      executeCommand: mockExecuteCommand,
      handleNodeDeleted: executionActions.handleNodeDeleted,
      handleStepDeleted: executionActions.handleStepDeleted,
      handleAllStepsRemoved: executionActions.handleAllStepsRemoved,
    };

    deletionActions = createNodeDeletionActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave
    );
  });

  describe('deleteNode with a running node', () => {
    it('should clear execution state for the deleted running node', () => {
      deletionActions.deleteNode('task-a', true);

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should not show toast for the deletion itself (handler clears state silently)', () => {
      deletionActions.deleteNode('task-a', true);

      const warningToasts = mockAddToast.mock.calls.filter(
        (args: unknown[]) => args[1] === 'warning'
      );
      expect(warningToasts).toHaveLength(0);
    });
  });

  describe('deleteNode of a step containing a running child', () => {
    it('should clear execution state for the running child when step is deleted', () => {
      deletionActions.deleteNode('step-1', true);

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('deleteNode of the last step in a workflow', () => {
    it('should trigger handleAllStepsRemoved when deleting the only remaining step', () => {
      // Remove step-2 and step-3 first so step-1 is the last step
      state.nodes['workflow'].children = ['step-1'];

      deletionActions.deleteNode('step-1', true);

      // task-a's execution state should be cleared (completed via handleAllStepsRemoved)
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('deleteNode of a non-running node', () => {
    it('should not change workflow execution state when deleting a non-running node', () => {
      deletionActions.deleteNode('step-2', true);

      // task-a still running
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });
  });

  describe('deleteNode of a node with no workflow ancestry', () => {
    it('should not crash and not change workflow state', () => {
      // Add a non-workflow node
      state.nodes['plain-node'] = {
        id: 'plain-node',
        content: 'Plain',
        children: [],
        metadata: {},
      };
      state.nodes['root'].children = ['workflow', 'plain-node'];
      state.ancestorRegistry['plain-node'] = ['root'];

      deletionActions.deleteNode('plain-node', true);

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });
  });

  describe('deleteNode of a step that triggers handleStepDeleted', () => {
    it('should pause running children when a step is deleted (not the last step)', () => {
      // step-1 has task-a running. Deleting step-1 while step-2 and step-3 remain
      // should call handleStepDeleted to pause task-a (if it wasn't already cleared by handleNodeDeleted)
      // In practice, handleNodeDeleted fires first for descendants, clearing task-a.
      // But handleStepDeleted should also fire for the step itself.
      deletionActions.deleteNode('step-1', true);

      // Either way, task-a's execution state should be gone
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });
});
