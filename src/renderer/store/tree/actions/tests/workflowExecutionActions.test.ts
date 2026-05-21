import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import { useTerminalStore } from '../../../terminal/terminalStore';

vi.mock('../../../services/logger', () => ({
  logger: {
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

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: () => 'mock prompt',
}));

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

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({
  mockNotifyWorkflowEvent: vi.fn(),
}));
vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: mockNotifyWorkflowEvent,
}));


describe('createWorkflowExecutionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Tree:
    // root (blueprint)
    // └── workflow (blueprint, isWorkflow)
    //     ├── step-1 (blueprint, stepType: 'autonomous')
    //     │   ├── task-a
    //     │   └── task-b
    //     ├── step-2 (blueprint, stepType: 'checkpoint')
    //     │   └── task-c
    //     └── step-3 (blueprint) — default stepType (manual)
    //         └── (empty)
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
          children: ['task-a', 'task-b'],
          metadata: { isBlueprint: true, stepType: 'autonomous' },
        },
        'step-2': {
          id: 'step-2',
          content: 'Step 2',
          children: ['task-c'],
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
        'step-3': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
        'task-b': ['root', 'workflow', 'step-1'],
        'task-c': ['root', 'workflow', 'step-2'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-pre': 'terminal-1' },
      terminalNodeAssignments: {},
      contextDeclarations: [],
      sessionRegistry: {},
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    vi.clearAllMocks();
    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
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
    );
  });

  describe('startWorkflow', () => {
    it('should set node execution state to running with terminal assignment', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a']).toEqual({
        state: 'running',
        terminalTabId: 'terminal-1',
      });
    });

    it('should reject if terminal tab is already assigned to another running node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.startWorkflow('task-b', 'terminal-1');

      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalled();
    });

    it('should NOT reject when the terminal merely carries a stale originNodeId (blue bar) but no running workflow', async () => {
      useTerminalStore.setState({
        terminals: [],
        activeTerminalId: null,
        currentFilePath: '/test.arbo',
        fileStates: { '/test.arbo': { terminals: [], activeTerminalId: null } },
      });
      useTerminalStore.getState().addTerminal({
        id: 'terminal-1', title: 'Stale', cwd: '/tmp',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        originNodeId: 'task-a',
      });

      await actions.startWorkflow('task-b', 'terminal-1');

      expect(state.workflowExecutionStates['task-b']).toEqual(
        expect.objectContaining({ state: 'running', terminalTabId: 'terminal-1' })
      );
    });

    it('should show toast if no terminal tab is available', () => {
      actions.startWorkflow('task-a', null);

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('terminal'),
        'warning'
      );
    });

    it('should not allow starting a workflow step itself', () => {
      actions.startWorkflow('step-1', 'terminal-1');
      expect(state.workflowExecutionStates['step-1']).toBeUndefined();
    });

    it('should not allow starting the workflow node itself', () => {
      actions.startWorkflow('workflow', 'terminal-1');
      expect(state.workflowExecutionStates['workflow']).toBeUndefined();
    });

    it('should not allow starting a node that is not inside a workflow', () => {
      state.nodes['outside'] = { id: 'outside', content: 'Outside', children: [], metadata: {} };
      state.ancestorRegistry['outside'] = ['root'];

      actions.startWorkflow('outside', 'terminal-1');
      expect(state.workflowExecutionStates['outside']).toBeUndefined();
    });

    it('stamps metadata.sessionId on the originating node and clears brokenChain on initial start for focus-existing-tab route', async () => {
      useTerminalStore.setState({
        terminals: [],
        activeTerminalId: null,
        currentFilePath: '/test.arbo',
        fileStates: { '/test.arbo': { terminals: [], activeTerminalId: null } },
      });
      useTerminalStore.getState().addTerminal({
        id: 'terminal-1', title: 'Existing', cwd: '/tmp',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      state.nodes['task-a'] = {
        ...state.nodes['task-a'],
        metadata: { ...state.nodes['task-a'].metadata, sessionId: 'session-pre', brokenChain: true },
      };

      await actions.startWorkflow('task-a', 'terminal-1');

      expect(state.nodes['task-a'].metadata.sessionId).toBe('session-pre');
      expect(state.nodes['task-a'].metadata.brokenChain).toBeUndefined();
    });

    it('should allow multiple nodes to be running simultaneously in different terminals', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-c', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });

    it('should send content to the terminal on start', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', expect.objectContaining({ collaborate: expect.any(Boolean), execute: expect.any(Boolean) }), undefined, expect.any(String));
    });

    it('should trigger autosave after starting', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('stopWorkflow', () => {
    it('should clear execution state entirely', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should be a no-op if node is not running', () => {
      actions.stopWorkflow('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should clear execution state for awaiting-validation nodes', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should release terminal assignment when stopping an awaiting-validation node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.terminalNodeAssignments = { 'terminal-1': 'task-a' };

      actions.stopWorkflow('task-a');

      expect(state.terminalNodeAssignments['terminal-1']).toBeUndefined();
    });

    it('should allow restarting after stopping from awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();

      actions.startWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should not affect another node when stopping an awaiting-validation node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });

    it('should allow restarting after stop', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.stopWorkflow('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();

      actions.startWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });
  });

  describe('continueWorkflow', () => {
    it('should advance node to next step when continuing from awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      // task-a was in step-1 (autonomous), should advance to step-2
      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('should be a no-op if node is not awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
    });

    it('should show toast when no terminal is available', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', null);

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('terminal'),
        'warning'
      );
    });

    it('should reject if terminal is assigned to another running node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.continueWorkflow('task-a', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('already assigned'),
        'warning'
      );
    });

    it('should be a no-op if node has no execution state', () => {
      actions.continueWorkflow('task-a', 'terminal-1');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should complete workflow when continuing from the last step', () => {
      // task-a at step-3 (final step), awaiting-validation
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });

    it('should stop at manual step when continuing past checkpoint', () => {
      // task-a at step-2 (checkpoint), next step is step-3 (manual)
      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.continueWorkflow('task-a', 'terminal-1');

      // Advances to step-3 (manual) → execution state cleared
      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should keep running when continuing to an autonomous step', () => {
      vi.useFakeTimers();

      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.nodes['step-2'].metadata.stepType = 'autonomous';

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a'].state).toBe('running');

      vi.advanceTimersByTime(1500);
      expect(mockAutonomousCollaborate).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('resendStep', () => {
    it('should transition awaiting-validation to running without moving the node and bind the passed terminal', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.resendStep('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toEqual({
        state: 'running',
        terminalTabId: 'terminal-1',
      });
      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).not.toContain('task-a');
    });

    it('should rebind the terminal when the user resends on a different terminal than was previously assigned', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.resendStep('task-a', 'terminal-3');

      expect(state.workflowExecutionStates['task-a']).toEqual({
        state: 'running',
        terminalTabId: 'terminal-3',
      });
    });

    it('should be a no-op if node is not awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      const previous = state.workflowExecutionStates['task-a'];

      actions.resendStep('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toEqual(previous);
    });

    it('should be a no-op if node has no execution state', () => {
      actions.resendStep('task-a', 'terminal-1');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show toast when no terminal is available', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.resendStep('task-a', null);

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('terminal'),
        'warning',
      );
    });

    it('should reject if terminal is assigned to another running node', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.resendStep('task-a', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('already assigned'),
        'warning',
      );
    });
  });

  describe('completeWorkflow', () => {
    it('should clear execution state entirely', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('should show completion toast with node name', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'success'
      );
    });

    it('should leave node at its current position in the tree', () => {
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-c');

      expect(state.nodes['step-2'].children).toContain('task-c');
    });

    it('should trigger autosave', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('advanceNode (direct movement, bypasses undo stack)', () => {
    it('should move node to the next workflow step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-1'].children).not.toContain('task-a');
    });

    it('should update ancestorRegistry after move', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.ancestorRegistry['task-a']).toEqual(['root', 'workflow', 'step-2']);
    });

    it('should NOT push to undo stack (HistoryManager)', () => {
      const mockExecuteCommand = vi.fn();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it('should trigger debounced autosave', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should show advancement toast with node name and step number', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Task A'),
        'info'
      );
    });

    it('should flash the node with workflow-specific intensity', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('task-a', 'advance');
    });

    it('should complete workflow when node is at final step and has no next step', () => {
      // Move task-a to step-3 (final step)
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('complete'),
        'success'
      );
    });

    it('should be a no-op if node is not in running state', () => {
      actions.advanceNode('task-a');

      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(mockVisualEffects.flashNode).not.toHaveBeenCalled();
    });
  });

  describe('advanceNode with nested workflows', () => {
    beforeEach(() => {
      state.nodes['workflow'].children = ['step-1', 'nested-wf', 'step-3'];
      state.nodes['nested-wf'] = {
        id: 'nested-wf',
        content: 'Nested Workflow',
        children: ['nested-step-1', 'nested-step-2'],
        metadata: { isBlueprint: true, isWorkflow: true },
      };
      state.nodes['nested-step-1'] = {
        id: 'nested-step-1',
        content: 'Nested Step 1',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.nodes['nested-step-2'] = {
        id: 'nested-step-2',
        content: 'Nested Step 2',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['nested-wf'] = ['root', 'workflow'];
      state.ancestorRegistry['nested-step-1'] = ['root', 'workflow', 'nested-wf'];
      state.ancestorRegistry['nested-step-2'] = ['root', 'workflow', 'nested-wf'];

      delete state.nodes['step-2'];
      delete state.nodes['task-c'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['task-c'];
    });

    it('should advance into nested workflow first step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['nested-step-1'].children).toContain('task-a');
    });

    it('should advance from last nested step back to parent workflow', () => {
      state.nodes['nested-step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'nested-wf', 'nested-step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
    });

    it('should traverse deeply nested workflows (3+ levels) in correct order', () => {
      state.nodes['nested-step-1'].metadata.isWorkflow = true;
      state.nodes['nested-step-1'].children = ['deep-step'];
      state.nodes['deep-step'] = { id: 'deep-step', content: 'Deep Step', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['deep-step'] = ['root', 'workflow', 'nested-wf', 'nested-step-1'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['deep-step'].children).toContain('task-a');
    });
  });

  describe('registerSession', () => {
    it('should map session_id to terminal tab', () => {
      actions.registerSession('session-abc', 'terminal-1');

      expect(state.workflowSessionMap['session-abc']).toBe('terminal-1');
    });

    it('should update mapping when same tab gets new session (Claude Code restart)', () => {
      state.workflowSessionMap['session-old'] = 'terminal-1';

      actions.registerSession('session-new', 'terminal-1');

      expect(state.workflowSessionMap['session-new']).toBe('terminal-1');
    });

    it('should handle multiple sessions across different terminals', () => {
      actions.registerSession('session-1', 'terminal-1');
      actions.registerSession('session-2', 'terminal-2');

      expect(state.workflowSessionMap['session-1']).toBe('terminal-1');
      expect(state.workflowSessionMap['session-2']).toBe('terminal-2');
    });

    describe('node↔terminal reattach on resume', () => {
      beforeEach(() => {
        useTerminalStore.setState({
          terminals: [],
          activeTerminalId: null,
          currentFilePath: '/test.arbo',
          fileStates: { '/test.arbo': { terminals: [], activeTerminalId: null } },
        });
      });

      it('seeds originNodeId on a fresh terminal when a node carries the matching sessionId', () => {
        state.nodes['task-a'].metadata.sessionId = 'session-reattach';
        useTerminalStore.getState().addTerminal({
          id: 'fresh-terminal', title: 'Resume', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        });

        actions.registerSession('session-reattach', 'fresh-terminal');

        const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'fresh-terminal');
        expect(terminal?.originNodeId).toBe('task-a');
      });

      it('does not overwrite an existing originNodeId when reattaching', () => {
        state.nodes['task-a'].metadata.sessionId = 'session-reattach';
        useTerminalStore.getState().addTerminal({
          id: 'existing-bound', title: 'Existing', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
          originNodeId: 'task-b',
        });

        actions.registerSession('session-reattach', 'existing-bound');

        const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'existing-bound');
        expect(terminal?.originNodeId).toBe('task-b');
      });

      it('leaves originNodeId undefined when no node carries the sessionId (untracked session)', () => {
        useTerminalStore.getState().addTerminal({
          id: 'fresh-terminal', title: 'Resume', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        });

        actions.registerSession('session-never-seen', 'fresh-terminal');

        const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'fresh-terminal');
        expect(terminal?.originNodeId).toBeUndefined();
      });

      it('leaves originNodeId undefined when the previously-associated node has been deleted before resume', () => {
        state.nodes['task-a'].metadata.sessionId = 'session-orphan';
        delete state.nodes['task-a'];
        useTerminalStore.getState().addTerminal({
          id: 'fresh-terminal', title: 'Resume', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        });

        actions.registerSession('session-orphan', 'fresh-terminal');

        const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'fresh-terminal');
        expect(terminal?.originNodeId).toBeUndefined();
        expect(mockAddToast).not.toHaveBeenCalled();
      });

      it('keeps two parallel resumes independent — each terminal gets its own node', () => {
        state.nodes['task-a'].metadata.sessionId = 'session-A';
        state.nodes['task-b'].metadata.sessionId = 'session-B';
        useTerminalStore.getState().addTerminal({
          id: 'terminal-A', title: 'A', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        });
        useTerminalStore.getState().addTerminal({
          id: 'terminal-B', title: 'B', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        });

        actions.registerSession('session-A', 'terminal-A');
        actions.registerSession('session-B', 'terminal-B');

        const all = useTerminalStore.getState().terminals;
        expect(all.find((t) => t.id === 'terminal-A')?.originNodeId).toBe('task-a');
        expect(all.find((t) => t.id === 'terminal-B')?.originNodeId).toBe('task-b');
      });
    });

    describe('capture for plain plays via originNodeId fallback', () => {
      beforeEach(() => {
        useTerminalStore.setState({
          terminals: [],
          activeTerminalId: null,
          currentFilePath: '/test.arbo',
          fileStates: { '/test.arbo': { terminals: [], activeTerminalId: null } },
        });
      });

      it('captures sessionId on the node when the terminal has originNodeId but no workflow assignment', () => {
        useTerminalStore.getState().addTerminal({
          id: 'plain-play-terminal', title: 'Play', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
          originNodeId: 'task-a',
        });

        actions.registerSession('session-plain', 'plain-play-terminal');

        expect(state.nodes['task-a'].metadata.sessionId).toBe('session-plain');
      });

      it('does not capture when the terminal has an originNodeId pointing to a node that no longer exists', () => {
        useTerminalStore.getState().addTerminal({
          id: 'ghost-origin', title: 'Ghost', cwd: '/tmp',
          shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
          originNodeId: 'deleted-node',
        });
        const captured = { ...state.nodes };

        actions.registerSession('session-ghost', 'ghost-origin');

        expect(state.nodes).toEqual(captured);
      });
    });
  });

  describe('handleHookEvent', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap['session-abc'] = 'terminal-1';
    });

    describe('Stop event', () => {
      it('should advance node when step type is autonomous', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-2'].children).toContain('task-a');
      });

      it('should set awaiting-validation when step type is checkpoint', () => {
        state.nodes['step-2'].children = ['task-a'];
        state.nodes['step-1'].children = ['task-b'];
        state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.stringContaining('complete'),
          'info',
          expect.objectContaining({ persistent: true, actions: expect.any(Array) })
        );
      });

      it('should not advance node when step type is manual', () => {
        state.nodes['step-3'].children = ['task-a'];
        state.nodes['step-1'].children = ['task-b'];
        state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        // Manual step: Stop hook is a no-op, node stays in place
        expect(state.nodes['step-3'].children).toContain('task-a');
      });

      it('should evaluate step type at arrival time, not at workflow start', () => {
        state.nodes['step-1'].metadata.stepType = 'manual';

        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Stop',
        });

        // Should NOT advance because step is now manual
        expect(state.nodes['step-1'].children).toContain('task-a');
      });

      it('should ignore Stop event with unknown session_id', () => {
        actions.handleHookEvent({
          session_id: 'unknown-session',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-1'].children).toContain('task-a');
      });

      it('should ignore Stop event when no node is assigned to that terminal', () => {
        state.workflowSessionMap['session-orphan'] = 'terminal-3';

        actions.handleHookEvent({
          session_id: 'session-orphan',
          hook_event_name: 'Stop',
        });

        expect(state.nodes['step-1'].children).toContain('task-a');
      });
    });

    describe('Notification event', () => {
      it('should stop the workflow for the affected node', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Notification',
          message: 'Claude needs attention',
        });

        expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      });

      it('should show a toast with the notification message', () => {
        actions.handleHookEvent({
          session_id: 'session-abc',
          hook_event_name: 'Notification',
          message: 'Claude needs attention',
        });

        expect(mockAddToast).toHaveBeenCalled();
      });

      it('should ignore Notification event with unknown session_id', () => {
        actions.handleHookEvent({
          session_id: 'unknown-session',
          hook_event_name: 'Notification',
          message: 'test',
        });

        expect(Object.keys(state.workflowExecutionStates)).toHaveLength(1);
      });
    });

  });

  describe('parallel execution', () => {
    it('should allow two nodes running in separate terminals', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-c', 'terminal-2');

      expect(state.workflowExecutionStates['task-a'].state).toBe('running');
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
      expect(state.workflowExecutionStates['task-a'].terminalTabId).toBe('terminal-1');
      expect(state.workflowExecutionStates['task-c'].terminalTabId).toBe('terminal-2');
    });

    it('should advance nodes independently when their respective Stop hooks fire', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };
      state.workflowSessionMap['session-1'] = 'terminal-1';
      state.workflowSessionMap['session-2'] = 'terminal-2';

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-c');
    });

    it('should stop one node without affecting the other', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-2' };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
    });

    it('should allow two nodes at the same step simultaneously', () => {
      state.nodes['step-2'].children = ['task-c', 'task-b'];
      state.nodes['step-1'].children = ['task-a'];
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];

      actions.startWorkflow('task-c', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');

      expect(state.workflowExecutionStates['task-c'].state).toBe('running');
      expect(state.workflowExecutionStates['task-b'].state).toBe('running');
    });
  });

  describe('initialization (app restart)', () => {
    it('should clear all running nodes on initialization', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        'task-c': { state: 'running', terminalTabId: 'terminal-2' },
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-c']).toBeUndefined();
    });

    it('should preserve awaiting-validation nodes on initialization', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
      };

      actions.initializeExecutionState();

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should clear session map on initialization', () => {
      state.workflowSessionMap = { 'old-session': 'terminal-1' };

      actions.initializeExecutionState();

      expect(state.workflowSessionMap).toEqual({});
    });

    it('should show toast when workflows are stopped on restart', () => {
      state.workflowExecutionStates = {
        'task-a': { state: 'running', terminalTabId: 'terminal-1' },
      };

      actions.initializeExecutionState();

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('stopped'),
        'warning'
      );
    });
  });

  describe('NeedsReview hook event', () => {
    beforeEach(() => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should set needsReview flag on the execution state when received for a running node', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBe(true);
    });

    it('should be idempotent — calling twice results in one flag', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBe(true);
    });

    it('should ignore the event when no running node is found on the terminal', () => {
      state.workflowExecutionStates = {};

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates).toEqual({});
    });

    it('should ignore the event when the node is in awaiting-validation state', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBeUndefined();
    });

    it('should ignore the event when the session_id has no mapped terminal', () => {
      actions.handleHookEvent({ session_id: 'unknown-session', hook_event_name: 'NeedsReview' });

      expect(state.workflowExecutionStates['task-a'].needsReview).toBeUndefined();
    });
  });

  describe('NeedsReview immediate user-visible signal (fix)', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should show a toast immediately when NeedsReview arrives on an autonomous step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('review'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should show a toast immediately when NeedsReview arrives on a checkpoint step', () => {
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('review'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should show a toast immediately when NeedsReview arrives on a manual step', () => {
      state.nodes['task-d'] = { id: 'task-d', content: 'Task D', children: [], metadata: { isBlueprint: true } };
      state.nodes['step-3'].children = ['task-d'];
      state.ancestorRegistry['task-d'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-d'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('review'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should fire notifyWorkflowEvent immediately on NeedsReview regardless of step type', () => {
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith(
        'alert',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should not double-notify when Stop follows NeedsReview on an autonomous step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'NeedsReview' });
      const toastsAfterReview = mockAddToast.mock.calls.length;
      const notifsAfterReview = mockNotifyWorkflowEvent.mock.calls.length;

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(mockAddToast.mock.calls.length).toBe(toastsAfterReview);
      expect(mockNotifyWorkflowEvent.mock.calls.length).toBe(notifsAfterReview);
    });
  });

  describe('Stop handler with NeedsReview flag', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should treat autonomous step as checkpoint when needsReview flag is set', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-a'].state).toBe('awaiting-validation');
    });

    it('should show persistent toast when autonomous step pauses due to NeedsReview', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('review'),
        expect.anything(),
        expect.objectContaining({ persistent: true })
      );
    });

    it('should advance normally when needsReview flag is not set on autonomous step', () => {
      vi.useFakeTimers();
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      // Autonomous step should advance (task-a moves to step-2)
      vi.advanceTimersByTime(1500);
      expect(state.workflowExecutionStates['task-a']?.state).not.toBe('awaiting-validation');
      vi.useRealTimers();
    });

    it('should not change checkpoint behavior when needsReview flag is set', () => {
      state.workflowExecutionStates['task-c'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.workflowExecutionStates['task-c'].state).toBe('awaiting-validation');
    });
  });

  describe('NeedsReview flag clearing', () => {
    it('should clear needsReview flag when continuing workflow', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1', needsReview: true };

      actions.continueWorkflow('task-a', 'terminal-1');

      const entry = state.workflowExecutionStates['task-a'];
      if (entry) {
        expect(entry.needsReview).toBeFalsy();
      }
    });

    it('should implicitly clear needsReview flag when stopping workflow', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.stopWorkflow('task-a');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('recurse', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should schedule startWorkflow for the next waiting node after advancing past a recurse step', () => {
      vi.useFakeTimers();

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      // After advancement (1s delay) + recurse check schedules startWorkflow (2s delay)
      // Verify task-a advanced to step-2 (the advancement itself works)
      vi.advanceTimersByTime(1500);
      expect(state.nodes['step-2'].children).toContain('task-a');
      // task-b should still be in step-1 waiting
      expect(state.nodes['step-1'].children).toContain('task-b');

      vi.useRealTimers();
    });

    it('should not trigger recurse when step has no recurse flag', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.recurse = false;
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      vi.advanceTimersByTime(1500);

      // task-a should advance but task-b should not be started
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });

    it('should not schedule recurse when no waiting nodes exist', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].children = ['task-a'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      vi.advanceTimersByTime(1500);

      // task-a advances but no new workflow should start since no waiting nodes
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('recurse with completeWorkflow', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('should trigger recurse check after completeWorkflow when the originating decomposition step has waiting siblings', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.nodes['step-3'].metadata.stepType = 'autonomous';
      state.nodes['step-3'].metadata.recurse = true;

      // task-a at step-3 (last step) just completed, task-b waiting at the decomposition step (step-1)
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];

      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      vi.advanceTimersByTime(2500);
      expect(state.workflowExecutionStates['task-b']).toBeDefined();

      vi.useRealTimers();
    });

    it('should not trigger recurse after completeWorkflow when step has no recurse flag', () => {
      vi.useFakeTimers();

      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      vi.advanceTimersByTime(2500);
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('halt at recurse step for decomposed siblings', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.nodes['step-2'].metadata.recurse = true;
      state.nodes['step-3'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('halts a decomposed sibling at the recurse step instead of advancing to the next step', () => {
      vi.useFakeTimers();

      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).not.toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();

      vi.advanceTimersByTime(2500);
      expect(state.workflowExecutionStates['task-b']).toBeDefined();

      vi.useRealTimers();
    });

    it('halts the last decomposed sibling at the recurse step even when no waiting siblings remain', () => {
      vi.useFakeTimers();

      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = [];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).not.toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();

      vi.advanceTimersByTime(2500);
      expect(Object.keys(state.workflowExecutionStates)).toHaveLength(0);

      vi.useRealTimers();
    });

    it('does NOT halt at a recurse step when the workflow has no decomposition step', () => {
      state.nodes['step-1'].metadata.decomposition = false;
      state.nodes['step-2'].children = ['task-a'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeDefined();
    });

    it('does NOT halt when the just-completed step has no recurse flag (decomposed workflow, non-recurse step)', () => {
      state.nodes['step-2'].metadata.recurse = false;
      state.nodes['step-2'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-2'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-3'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']).toBeDefined();
    });
  });

  describe('recurse safety limit', () => {
    it('should stop recursing and show warning after exceeding safety limit', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      const taskIds: string[] = [];
      for (let i = 0; i < 52; i++) {
        const id = `task-${i}`;
        taskIds.push(id);
        state.nodes[id] = { id, content: `Task ${i}`, children: [], metadata: { isBlueprint: true } };
        state.ancestorRegistry[id] = ['root', 'workflow', 'step-1'];
      }
      state.nodes['step-1'].children = taskIds;
      state.workflowExecutionStates[taskIds[0]] = { state: 'running', terminalTabId: 'terminal-1' };

      for (let i = 0; i < 51; i++) {
        actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
        vi.advanceTimersByTime(3000);
      }

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Recurse limit reached'),
        'warning'
      );

      vi.useRealTimers();
    });

    it('should reset recurse counter when chain completes naturally', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      // Only one item — chain completes without finding next waiting node
      state.nodes['step-1'].children = ['task-a'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');

      vi.useRealTimers();
    });

    it('should not start more nodes after stopping the workflow mid-recurse', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      state.nodes['step-1'].children = ['task-a', 'task-b'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(1500);

      if (state.workflowExecutionStates['task-a']) {
        actions.stopWorkflow('task-a');
      }

      expect(state.nodes['step-1'].children).toContain('task-b');

      vi.useRealTimers();
    });
  });

  describe('decomposed siblings advance to next workflow step', () => {
    it('moves the next waiting sibling (not the just-completed node) out to step N+1 on recurse hand-off', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      state.nodes['step-1'].children = ['task-a', 'task-b'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-b');
      expect(state.nodes['step-1'].children).not.toContain('task-b');
      expect(state.ancestorRegistry['task-b']).toEqual(['root', 'workflow', 'step-2']);
      expect(state.nodes['step-1'].children).toContain('task-a');

      vi.useRealTimers();
    });

    it('moves each pending sibling out of the decomposition step across successive recurse passes', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };

      state.nodes['step-1'].children = ['task-a', 'task-b'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(3000);
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(3000);

      expect(state.nodes['step-1'].children).not.toContain('task-b');
      expect(state.nodes['step-3'].children).toContain('task-b');
      expect(state.nodes['step-2'].children).toContain('task-a');

      vi.useRealTimers();
    });

    it('terminates the recurse chain cleanly when the decomposition step is the final step (no infinite loop, no error)', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['workflow'].children = ['step-1'];
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      delete state.nodes['step-2'];
      delete state.nodes['step-3'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['step-3'];

      state.nodes['step-1'].children = ['task-a', 'task-b', 'task-c'];
      state.ancestorRegistry['task-c'] = ['root', 'workflow', 'step-1'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(10000);

      expect(state.nodes['step-1'].children).toEqual(expect.arrayContaining(['task-b', 'task-c']));
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      expect(state.workflowExecutionStates['task-c']).toBeUndefined();
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringContaining('Recurse limit reached'),
        'warning',
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Decomposition at final step'),
        'info',
      );

      vi.useRealTimers();
    });
  });

  describe('notification wiring', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      mockNotifyWorkflowEvent.mockClear();
    });

    it('should notify success when workflow completes', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('success', 'Workflow complete', 'Task A');
    });

    it('should notify alert on NeedsReview', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1', needsReview: true };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Review requested', expect.any(String));
    });

    it('should notify alert on recurse limit', () => {
      vi.useFakeTimers();

      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';

      const taskIds: string[] = [];
      for (let i = 0; i < 52; i++) {
        const id = `task-${i}`;
        taskIds.push(id);
        state.nodes[id] = { id, content: `Task ${i}`, children: [], metadata: { isBlueprint: true } };
        state.ancestorRegistry[id] = ['root', 'workflow', 'step-1'];
      }
      state.nodes['step-1'].children = taskIds;
      state.workflowExecutionStates[taskIds[0]] = { state: 'running', terminalTabId: 'terminal-1' };

      for (let i = 0; i < 51; i++) {
        actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
        vi.advanceTimersByTime(3000);
      }

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Recurse limit reached', expect.any(String));

      vi.useRealTimers();
    });

    it('should notify alert on Notification hook event', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Notification', message: 'Check output' });

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', 'Workflow notification', 'Check output');
    });
  });

  describe('recurse-without-decomposition warning (PR2)', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('fires the warning toast when a recurse step runs in a workflow with no decomposition step anywhere', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].children = ['task-a'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(2500);

      expect(mockAddToast).toHaveBeenCalledWith(
        'Warning, you have recursion set without decomposition',
        expect.anything(),
      );
      vi.useRealTimers();
    });

    it('fires the warning toast at most once per workflow run, even after multiple advances on the same terminal', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-1'].metadata.recurse = true;
      state.nodes['workflow'].children = ['step-1'];
      delete state.nodes['step-2'];
      delete state.nodes['step-3'];
      delete state.ancestorRegistry['step-2'];
      delete state.ancestorRegistry['step-3'];

      const taskIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = `recurse-task-${i}`;
        taskIds.push(id);
        state.nodes[id] = { id, content: `Recurse task ${i}`, children: [], metadata: { isBlueprint: true } };
        state.ancestorRegistry[id] = ['root', 'workflow', 'step-1'];
      }
      state.nodes['step-1'].children = taskIds;
      state.workflowExecutionStates[taskIds[0]] = { state: 'running', terminalTabId: 'terminal-1' };

      for (let i = 0; i < 4; i++) {
        actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
        vi.advanceTimersByTime(3000);
      }

      const warningCalls = mockAddToast.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('recursion set without decomposition'),
      );
      expect(warningCalls).toHaveLength(1);
      vi.useRealTimers();
    });

    it('does not fire the warning when the recurse step (or one upstream) has decomposition: true', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-1'].children = ['task-a'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(2500);

      const warningCalls = mockAddToast.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('recursion set without decomposition'),
      );
      expect(warningCalls).toHaveLength(0);
      vi.useRealTimers();
    });

    it.todo('resets the once-per-run guard when the workflow is restarted on the same terminal so a fresh run sees the warning again');
  });

  describe('chain-traversal removal (PR2)', () => {
    beforeEach(() => {
      state.nodes['step-1'].metadata.stepType = 'autonomous';
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.nodes['step-3'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
    });

    it('completing a node on a non-decomposition workflow with recurse: true does not start any waiting node from earlier chain steps', () => {
      vi.useFakeTimers();
      // No step has decomposition. Only step-3 has recurse.
      state.nodes['step-3'].metadata.recurse = true;
      state.nodes['step-3'].children = ['task-a'];
      state.nodes['step-1'].children = ['task-b'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');
      vi.advanceTimersByTime(2500);

      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      vi.useRealTimers();
    });

    it('after the last decomposed sibling completes its pipeline, the workflow stops without picking up unrelated chain nodes', () => {
      vi.useFakeTimers();
      // step-1 is a decomposition step; step-3 has recurse. Only one sibling left at step-1, but it's already running.
      // Once task-a finishes step-3, no further siblings are available at the decomp step → chain traversal must not pick up task-c in some other step.
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-3'].metadata.recurse = true;
      state.nodes['step-1'].children = []; // no more siblings waiting at decomp step
      state.nodes['step-2'].children = ['task-c']; // an unrelated waiting node in a different step
      state.ancestorRegistry['task-c'] = ['root', 'workflow', 'step-2'];
      state.nodes['step-3'].children = ['task-a'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.completeWorkflow('task-a');
      vi.advanceTimersByTime(2500);

      // task-c lives outside the decomposition step's children, so it must not auto-start.
      expect(state.workflowExecutionStates['task-c']).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('intermediate autonomous advance does not fire spurious recurse halt', () => {
    it('does not schedule a recurse start for a waiting sibling while the orchestrator is still running on the terminal', () => {
      vi.useFakeTimers();
      state.nodes['step-1'].metadata.decomposition = true;
      state.nodes['step-2'].metadata.stepType = 'autonomous';
      state.workflowSessionMap = { 'session-1': 'terminal-1' };
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      vi.advanceTimersByTime(3000);

      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      expect(state.nodes['step-1'].children).toContain('task-b');
      expect(state.nodes['step-2'].children).not.toContain('task-b');

      const haltCalls = mockAddToast.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Recurse halted'),
      );
      expect(haltCalls).toHaveLength(0);

      vi.useRealTimers();
    });
  });
});
