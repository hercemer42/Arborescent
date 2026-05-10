import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeMovementActions } from '../nodeMovementActions';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';
import type { VisualEffectsActions } from '../visualEffectsActions';
import type { NavigationActions } from '../navigationActions';

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
      stepTimeoutMinutes: 10,
      markHookEventReceived: vi.fn(),
    }),
  },
}));

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));


describe('workflow disruption — movement wiring', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    cursorPosition: number;
    rememberedVisualX: number | null;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
    actions: {
      executeCommand: (cmd: unknown) => void;
      handleNodeMovedManually?: (nodeId: string) => void;
    };
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let movementActions: ReturnType<typeof createNodeMovementActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: VisualEffectsActions;
  let mockNavigation: NavigationActions;

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

    mockNavigation = {
      moveUp: vi.fn(),
      moveDown: vi.fn(),
      moveBack: vi.fn(),
      moveForward: vi.fn(),
      toggleNode: vi.fn(),
    };

    // Workflow with 3 steps, task-a is running inside step-1
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
          children: ['task-a', 'task-b'],
          metadata: { isBlueprint: true, stepType: 'autonomous' },
        },
        'step-2': {
          id: 'step-2',
          content: 'Step 2',
          children: ['task-c'],
          metadata: { isBlueprint: true, stepType: 'checkpoint' },
        },
        'task-a': {
          id: 'task-a',
          content: 'Task A',
          children: [],
          metadata: { isBlueprint: true },
        },
        'task-b': {
          id: 'task-b',
          content: 'Task B',
          children: [],
          metadata: { isBlueprint: true },
        },
        'task-c': {
          id: 'task-c',
          content: 'Task C',
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
        'task-b': ['root', 'workflow', 'step-1'],
        'task-c': ['root', 'workflow', 'step-2'],
      },
      cursorPosition: 0,
      rememberedVisualX: null,
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

    // Wire real workflow execution handlers onto state.actions
    const executionActions = createWorkflowExecutionActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave,
      mockVisualEffects
    );

    state.actions = {
      executeCommand: mockExecuteCommand,
      handleNodeMovedManually: executionActions.handleNodeMovedManually,
    };

    movementActions = createNodeMovementActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave,
      mockVisualEffects,
      mockNavigation
    );
  });

  describe('moveNodeVertically — within-parent reorder', () => {
    it('should NOT pause a running node when reordering within the same parent', () => {
      // task-a and task-b are siblings in step-1. Moving task-a down swaps with task-b.
      movementActions.moveNodeDown('task-a');

      // Parent didn't change — should remain running
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should NOT pause when moving a running node up within the same parent', () => {
      // task-b is at index 1 in step-1. Moving up swaps with task-a.
      state.workflowExecutionStates['task-b'] = { state: 'running', terminalTabId: 'terminal-2' };

      movementActions.moveNodeUp('task-b');

      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });
  });

  describe('moveNodeVertically — cross-parent move', () => {
    it('should clear execution state when moved to a different parent via moveNodeDown', () => {
      // task-a is the last child of step-1. Moving down crosses to step-2.
      state.nodes['step-1'].children = ['task-a'];

      movementActions.moveNodeDown('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should clear execution state when moved to a different parent via moveNodeUp', () => {
      // task-c is the first child of step-2. Moving up crosses to step-1.
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      movementActions.moveNodeUp('task-c');

      expect(state.workflowExecutionStates['task-c']).toBeUndefined();
    });
  });

  describe('indentNode — always cross-parent', () => {
    it('should clear execution state when indented to a new parent', () => {
      // Set up: two siblings under step-1, task-b can be indented into task-a
      state.workflowExecutionStates['task-b'] = { state: 'running', terminalTabId: 'terminal-2' };

      movementActions.indentNode('task-b');

      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    });
  });

  describe('outdentNode — always cross-parent', () => {
    it('should clear execution state when outdented to a new parent', () => {
      movementActions.outdentNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('dropNode — cross-parent', () => {
    it('should clear execution state when dropped into a different parent', () => {
      movementActions.dropNode('task-a', 'step-2', 'child');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('moving a non-running node cross-parent', () => {
    it('should not crash and not change workflow state for non-running nodes', () => {
      // task-b has no execution state
      movementActions.indentNode('task-b');

      // task-a still running, no crash
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    });
  });
});
