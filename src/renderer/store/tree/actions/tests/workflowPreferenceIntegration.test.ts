import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

vi.mock('../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

const { mockMarkHookEventReceived, mockHasReceivedHookEvent, mockStepTimeoutMinutes } = vi.hoisted(() => ({
  mockMarkHookEventReceived: vi.fn(),
  mockHasReceivedHookEvent: { value: false },
  mockStepTimeoutMinutes: { value: 10 },
}));

vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: mockHasReceivedHookEvent.value,
      stepTimeoutMinutes: mockStepTimeoutMinutes.value,
      markHookEventReceived: mockMarkHookEventReceived,
    }),
  },
}));

describe('workflow execution — preference integration', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'idle' | 'running' | 'paused'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasReceivedHookEvent.value = false;
    mockStepTimeoutMinutes.value = 10;

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
      workflowExecutionStates: {},
      workflowSessionMap: {},
      contextDeclarations: [],
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    mockTriggerAutosave = vi.fn();
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
      mockVisualEffects
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setup guide display', () => {
    it('should show setup guide toast when hasReceivedHookEvent is false', () => {
      mockHasReceivedHookEvent.value = false;

      actions.startWorkflow('task-a', 'terminal-1');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('hooks'),
        expect.anything()
      );
    });

    it('should not show setup guide toast when hasReceivedHookEvent is true', () => {
      mockHasReceivedHookEvent.value = true;

      actions.startWorkflow('task-a', 'terminal-1');

      const hookSetupCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('hooks')
      );
      expect(hookSetupCalls).toHaveLength(0);
    });

    it('should show setup guide with actionable content about configuration', () => {
      mockHasReceivedHookEvent.value = false;

      actions.startWorkflow('task-a', 'terminal-1');

      const hookSetupCall = mockAddToast.mock.calls.find(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('hooks')
      );
      expect(hookSetupCall).toBeDefined();
      expect(hookSetupCall![0]).toMatch(/hook|configure/i);
    });

    it('should check persisted flag regardless of session map state', () => {
      mockHasReceivedHookEvent.value = true;
      state.workflowSessionMap = {};

      actions.startWorkflow('task-a', 'terminal-1');

      const hookSetupCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('hooks')
      );
      expect(hookSetupCalls).toHaveLength(0);
    });
  });

  describe('hook-received flag setting', () => {
    it('should call markHookEventReceived on first registerSession when flag is false', () => {
      mockHasReceivedHookEvent.value = false;

      actions.registerSession('session-abc', 'terminal-1');

      expect(mockMarkHookEventReceived).toHaveBeenCalledTimes(1);
    });

    it('should not call markHookEventReceived when flag is already true', () => {
      mockHasReceivedHookEvent.value = true;

      actions.registerSession('session-abc', 'terminal-1');

      expect(mockMarkHookEventReceived).not.toHaveBeenCalled();
    });

    it('should set flag on first registerSession regardless of which terminal', () => {
      mockHasReceivedHookEvent.value = false;

      actions.registerSession('session-1', 'terminal-1');

      expect(mockMarkHookEventReceived).toHaveBeenCalledTimes(1);

      mockHasReceivedHookEvent.value = true;
      actions.registerSession('session-2', 'terminal-2');

      expect(mockMarkHookEventReceived).toHaveBeenCalledTimes(1);
    });
  });

  describe('configurable step timeout', () => {
    it('should read stepTimeoutMinutes from preferences store', () => {
      vi.useFakeTimers();
      mockStepTimeoutMinutes.value = 5;

      actions.startWorkflow('task-a', 'terminal-1');

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.objectContaining({ actions: expect.any(Array) })
      );
    });

    it('should not fire timeout before the configured interval', () => {
      vi.useFakeTimers();
      mockStepTimeoutMinutes.value = 15;

      actions.startWorkflow('task-a', 'terminal-1');

      vi.advanceTimersByTime(10 * 60 * 1000);

      const timeoutCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('taking longer')
      );
      expect(timeoutCalls).toHaveLength(0);

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.objectContaining({ actions: expect.any(Array) })
      );
    });

    it('should apply updated timeout to subsequent workflows, not already-running ones', () => {
      vi.useFakeTimers();
      mockStepTimeoutMinutes.value = 10;

      actions.startWorkflow('task-a', 'terminal-1');

      mockStepTimeoutMinutes.value = 1;

      vi.advanceTimersByTime(1 * 60 * 1000);

      const timeoutCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('taking longer')
      );
      expect(timeoutCalls).toHaveLength(0);
    });

    it('should skip timeout creation when stepTimeoutMinutes is 0', () => {
      vi.useFakeTimers();
      mockStepTimeoutMinutes.value = 0;

      actions.startWorkflow('task-a', 'terminal-1');

      vi.advanceTimersByTime(60 * 60 * 1000);

      const timeoutCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('taking longer')
      );
      expect(timeoutCalls).toHaveLength(0);
    });

    it('should not error when clearing timeout that was never created due to 0 setting', () => {
      mockStepTimeoutMinutes.value = 0;

      actions.startWorkflow('task-a', 'terminal-1');

      expect(() => actions.pauseWorkflow('task-a')).not.toThrow();
    });

    it('should use default 10 minutes when stepTimeoutMinutes is undefined', () => {
      vi.useFakeTimers();
      mockStepTimeoutMinutes.value = undefined as unknown as number;

      actions.startWorkflow('task-a', 'terminal-1');

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('taking longer'),
        expect.anything(),
        expect.objectContaining({ actions: expect.any(Array) })
      );
    });
  });
});
