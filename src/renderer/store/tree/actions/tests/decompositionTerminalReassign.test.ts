import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({ executeInTerminal: mockExecuteInTerminal }));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => undefined,
    resolveContextFlags: () => ({ collaborate: false, execute: true }),
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

const { mockParseFeedbackContent } = vi.hoisted(() => ({ mockParseFeedbackContent: vi.fn() }));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

// AcceptFeedbackCommand mock — execute() can be re-configured per-test via mockAcceptFeedbackExecute
// to simulate the multi-root splice the real command performs on state.nodes /
// state.ancestorRegistry. The real command does NOT touch workflowExecutionStates or
// terminalNodeAssignments — the mock mirrors that intentional gap so the bug surfaces.
const { mockAcceptFeedbackExecute } = vi.hoisted(() => ({ mockAcceptFeedbackExecute: vi.fn() }));
vi.mock('../../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: mockAcceptFeedbackExecute,
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({ mockNotifyWorkflowEvent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: mockNotifyWorkflowEvent }));

describe('decomposition acceptance — terminal reassignment and first-sibling auto-play', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, {
      state: 'running' | 'awaiting-validation' | 'stuck';
      terminalTabId: string;
      needsReview?: boolean;
      collaborating?: boolean;
      stopReceived?: boolean;
    }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
    activeNodeId: string | null;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  // Tree:
  // root
  // └── workflow (isWorkflow)
  //     ├── step-1 (decomposition: true, autonomous) — orchestrator runs here
  //     └── step-2 (autonomous) — siblings should auto-play here after decomposition
  beforeEach(() => {
    state = {
      nodes: {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['orchestrator'], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'orchestrator': { id: 'orchestrator', content: 'Orchestrator', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'orchestrator': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {
        'orchestrator': { state: 'running', terminalTabId: 'terminal-1', collaborating: true },
      },
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
      terminalNodeAssignments: { 'terminal-1': 'orchestrator' },
      contextDeclarations: [],
      activeNodeId: null,
    };

    setState = (partial) => { state = { ...state, ...partial }; };

    vi.clearAllMocks();
    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
    mockExecuteCommand = vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute());
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    // Multi-root parse — two new siblings, mirrors the real path where the AI
    // returns several root-level headings under a decomposition step.
    mockParseFeedbackContent.mockReturnValue({
      nodes: {
        'sib-1': { id: 'sib-1', content: 'Sibling 1', children: [], metadata: {} },
        'sib-2': { id: 'sib-2', content: 'Sibling 2', children: [], metadata: {} },
      },
      rootNodeId: 'sib-1',
      rootNodeIds: ['sib-1', 'sib-2'],
      nodeCount: 2,
    });

    // Default AcceptFeedbackCommand mock: simulate the multi-root strategy by splicing
    // sib-1 and sib-2 into step-1 in place of orchestrator. Crucially, do NOT touch
    // workflowExecutionStates or terminalNodeAssignments — that is the bug surface
    // the production fix is expected to address from inside handleAutonomousFeedback.
    mockAcceptFeedbackExecute.mockImplementation(() => {
      const next: TestState = {
        ...state,
        nodes: {
          ...state.nodes,
          'step-1': { ...state.nodes['step-1'], children: ['sib-1', 'sib-2'] },
          'sib-1': { id: 'sib-1', content: 'Sibling 1', children: [], metadata: {} },
          'sib-2': { id: 'sib-2', content: 'Sibling 2', children: [], metadata: {} },
        },
        ancestorRegistry: {
          ...state.ancestorRegistry,
          'sib-1': ['root', 'workflow', 'step-1'],
          'sib-2': ['root', 'workflow', 'step-1'],
        },
      };
      delete next.nodes['orchestrator'];
      delete next.ancestorRegistry['orchestrator'];
      state = next;
    });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockVisualEffects,
      mockAutonomousCollaborate,
      mockExecuteCommand,
    );
  });

  describe('terminal reassignment on decomposition acceptance', () => {
    it('releases the terminal binding away from the decomposed orchestrator before the auto-play setTimeout fires', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');

      // Pre-timer-advance: the release happens synchronously inside handleAutonomousFeedback.
      // Reassignment to sib-1 only occurs after the 2s pacing setTimeout dispatches —
      // the post-advance binding is asserted in the auto-play describe block.
      expect(state.terminalNodeAssignments['terminal-1']).toBeUndefined();

      vi.useRealTimers();
    });

    it('clears the orchestrator workflowExecutionStates entry so the recurse guard does not bail', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');

      // The line-696 guard returns early when the orchestrator is still in `running`.
      // The fix deletes the entry outright so the guard falls through and checkRecurse proceeds.
      expect(state.workflowExecutionStates['orchestrator']).toBeUndefined();

      vi.useRealTimers();
    });

    it('does not fire the "already assigned" toast when starting the first sibling manually after decomposition', async () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');

      mockAddToast.mockClear();
      await actions.startWorkflow('sib-1', 'terminal-1');

      const alreadyAssignedCalls = mockAddToast.mock.calls.filter(
        ([msg]) => typeof msg === 'string' && msg.includes('already assigned'),
      );
      expect(alreadyAssignedCalls).toEqual([]);

      vi.useRealTimers();
    });
  });

  describe('first-sibling auto-play in the next step', () => {
    it('advances the first decomposed sibling to step-2 (next step), not the decomposition step', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');
      vi.advanceTimersByTime(2500);

      expect(state.nodes['step-2'].children).toContain('sib-1');
      expect(state.nodes['step-1'].children).not.toContain('sib-1');

      vi.useRealTimers();
    });

    it('starts the first sibling running on the same terminal after the 2s pacing delay', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');
      vi.advanceTimersByTime(2500);

      const sib1Entry = state.workflowExecutionStates['sib-1'];
      expect(sib1Entry).toBeDefined();
      expect(sib1Entry?.state).toBe('running');
      expect(sib1Entry?.terminalTabId).toBe('terminal-1');
      expect(state.terminalNodeAssignments['terminal-1']).toBe('sib-1');

      vi.useRealTimers();
    });

    it('leaves the remaining siblings parented under the decomposition step until their turn', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');
      vi.advanceTimersByTime(2500);

      expect(state.nodes['step-1'].children).toContain('sib-2');
      expect(state.workflowExecutionStates['sib-2']).toBeUndefined();

      vi.useRealTimers();
    });

    it('does not auto-play any sibling within the same step as the decomposition itself', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');
      vi.advanceTimersByTime(2500);

      // Neither sibling should be left running while still parented to the decomposition step
      const sib1Step = state.ancestorRegistry['sib-1']?.[state.ancestorRegistry['sib-1'].length - 1];
      const sib2Step = state.ancestorRegistry['sib-2']?.[state.ancestorRegistry['sib-2'].length - 1];
      if (state.workflowExecutionStates['sib-1']?.state === 'running') {
        expect(sib1Step).not.toBe('step-1');
      }
      if (state.workflowExecutionStates['sib-2']?.state === 'running') {
        expect(sib2Step).not.toBe('step-1');
      }

      vi.useRealTimers();
    });
  });

  describe('single-root decomposition — no sibling hand-off', () => {
    beforeEach(() => {
      // Parse returns a single root — common when the AI does not actually split work
      // even though decomposition is enabled on the step.
      mockParseFeedbackContent.mockReturnValue({
        nodes: { 'only-root': { id: 'only-root', content: 'Only', children: [], metadata: {} } },
        rootNodeId: 'only-root',
        rootNodeIds: ['only-root'],
        nodeCount: 1,
      });
      mockAcceptFeedbackExecute.mockImplementation(() => {
        // single-root strategy preserves the orchestrator's id and updates content/children
        // — model it as a content swap; the orchestrator node stays in step-1.
      });
    });

    it('does not schedule any auto-play when there are no siblings to hand off to', () => {
      vi.useFakeTimers();

      actions.handleAutonomousFeedback('orchestrator', '# Only');
      vi.advanceTimersByTime(2500);

      // Nothing should have moved into step-2 from the single-root path
      expect(state.nodes['step-2'].children).toEqual([]);

      vi.useRealTimers();
    });
  });

  describe('Stop-then-feedback race — multi-root with stopReceived', () => {
    it('still auto-plays the first sibling cleanly even when Stop arrived before the feedback', () => {
      vi.useFakeTimers();

      // Simulate Stop arrived first: handleHookEvent on a collaborating node sets stopReceived=true
      // and keeps the entry in 'running'. The release helper must clean this up so advanceNode is
      // never invoked on a now-replaced orchestrator (which would dangle the deleted id into step-2).
      state.workflowExecutionStates['orchestrator'] = {
        state: 'running',
        terminalTabId: 'terminal-1',
        collaborating: true,
        stopReceived: true,
      };

      actions.handleAutonomousFeedback('orchestrator', '# Sibling 1\n# Sibling 2');
      vi.advanceTimersByTime(2500);

      expect(state.workflowExecutionStates['orchestrator']).toBeUndefined();
      expect(state.nodes['step-2'].children).toContain('sib-1');
      expect(state.nodes['step-2'].children).not.toContain('orchestrator');
      expect(state.workflowExecutionStates['sib-1']?.state).toBe('running');
      expect(state.terminalNodeAssignments['terminal-1']).toBe('sib-1');

      vi.useRealTimers();
    });
  });

  describe('decomposition on a non-automatic step — no auto-play', () => {
    it.todo('does not auto-play any sibling when the decomposition step is checkpoint or manual');
  });

  describe('regression coverage — adjacent fixes must keep working', () => {
    it.todo('does not surface a "Recurse halted" toast during intermediate autonomous-to-autonomous advances (43488ce)');
    it.todo('does not re-select the just-completed sibling as the hand-off target after stopWorkflow (ba5ef73)');
    it.todo('terminates cleanly with an info toast when decomposition lands on the final step (4ecbcc1)');
    it.todo('restart-after-stop on a decomposed sibling re-sends the workflow prompt (f32ea06)');
  });
});
