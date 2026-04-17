import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast, mockExecuteInTerminal } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/nodeHelpers')>();
  return {
    ...actual,
    buildContentWithContext: vi.fn().mockReturnValue({ contextPrefix: '', nodeContent: 'content' }),
  };
});

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: vi.fn((_c: string, content: string) => `execute: ${content}`),
}));

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

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

function countReferences(nodes: Record<string, TreeNode>, nodeId: string): number {
  let count = 0;
  for (const n of Object.values(nodes)) {
    for (const childId of n.children) {
      if (childId === nodeId) count++;
    }
  }
  return count;
}

describe('Node duplication invariant during workflow operations', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  beforeEach(() => {
    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2', 'step-3'],
          metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'],
          metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [],
          metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-3': { id: 'step-3', content: 'Step 3', children: [],
          metadata: { isBlueprint: true } },
        'task-a': { id: 'task-a', content: 'Task A', children: [],
          metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-3': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
    };

    setState = (partial) => { state = { ...state, ...partial }; };

    vi.clearAllMocks();
    mockExecuteInTerminal.mockResolvedValue(undefined);

    const visualEffects = {
      flashNode: vi.fn(), scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn(),
    };
    const autonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
    actions = createWorkflowExecutionActions(
      () => state, setState, vi.fn(), visualEffects, autonomousCollaborate,
    );
  });

  describe('advanceNode leaves the node referenced in exactly one parent', () => {
    it('moves task-a from step-1 to step-2 without leaving a stale reference', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(countReferences(state.nodes, 'task-a')).toBe(1);
      expect(state.nodes['step-1'].children).not.toContain('task-a');
      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('ancestorRegistry reflects the new parent and matches the children arrays', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.ancestorRegistry['task-a']).toEqual(['root', 'workflow', 'step-2']);
    });
  });

  describe('double-invocation races must not produce duplicates', () => {
    it('calling advanceNode twice in the same tick does not duplicate the node in the target step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      actions.advanceNode('task-a');

      expect(countReferences(state.nodes, 'task-a')).toBe(1);
    });

    it('rapid double-fire of send-to-next-step does not leave a copy in the current step', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      actions.advanceNode('task-a');

      const references = Object.values(state.nodes)
        .filter((n) => n.children.includes('task-a'))
        .map((n) => n.id);
      expect(references).toEqual(expect.arrayContaining([]));
      expect(references.length).toBe(1);
    });

    it('three back-to-back advanceNode calls never produce more than one reference at any time', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      expect(countReferences(state.nodes, 'task-a')).toBe(1);
      actions.advanceNode('task-a');
      expect(countReferences(state.nodes, 'task-a')).toBe(1);
      actions.advanceNode('task-a');
      expect(countReferences(state.nodes, 'task-a')).toBe(1);
    });
  });

  describe('edge case: advanceNode called when already at the final step', () => {
    it('does not duplicate when there is no next step', () => {
      state.nodes['step-1'].children = [];
      state.nodes['step-3'].children = ['task-a'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-3'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(countReferences(state.nodes, 'task-a')).toBeLessThanOrEqual(1);
    });
  });

  describe('edge case: advanceNode on a node without execution state', () => {
    it('is a no-op and does not duplicate', () => {
      const snapshotNodes = JSON.parse(JSON.stringify(state.nodes));

      actions.advanceNode('task-a');

      expect(state.nodes).toEqual(snapshotNodes);
      expect(countReferences(state.nodes, 'task-a')).toBe(1);
    });
  });

  describe('edge case: ancestorRegistry out of sync with children arrays', () => {
    it('does not insert the node into two parents when the registry points to a stale parent', () => {
      state.nodes['step-1'].children = [];
      state.nodes['step-2'].children = ['task-a'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-1'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(countReferences(state.nodes, 'task-a')).toBeLessThanOrEqual(1);
    });

    it('refuses to add the node to the target step if it already appears there', () => {
      state.nodes['step-1'].children = ['task-a'];
      state.nodes['step-2'].children = ['task-a'];
      state.ancestorRegistry['task-a'] = ['root', 'workflow', 'step-1'];
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      expect(state.nodes['step-2'].children.filter((id) => id === 'task-a').length).toBe(1);
    });
  });

  describe('full-tree invariant: no node id appears in more than one parents children array', () => {
    it('holds after a single advanceNode call', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');

      for (const node of Object.values(state.nodes)) {
        expect(countReferences(state.nodes, node.id)).toBeLessThanOrEqual(1);
      }
    });

    it('holds after repeated advanceNode calls', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.advanceNode('task-a');
      actions.advanceNode('task-a');
      actions.advanceNode('task-a');

      for (const node of Object.values(state.nodes)) {
        expect(countReferences(state.nodes, node.id)).toBeLessThanOrEqual(1);
      }
    });
  });

});
