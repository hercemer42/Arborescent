import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('../../../toast/toastStore', () => ({
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

const { mockResolveContextFlags } = vi.hoisted(() => ({
  mockResolveContextFlags: vi.fn().mockReturnValue({ collaborate: true, execute: true }),
}));
const flagsForMode = (mode: 'collaborate' | 'execute') =>
  mode === 'execute' ? { collaborate: true, execute: true } : { collaborate: true, execute: false };
const mockResolveContextMode = {
  mockReturnValue: (mode: 'collaborate' | 'execute') => mockResolveContextFlags.mockReturnValue(flagsForMode(mode)),
};
vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/nodeHelpers')>();
  return {
    ...actual,
    buildContentWithContext: vi.fn().mockReturnValue({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: vi.fn().mockReturnValue('ctx-1'),
    resolveContextFlags: mockResolveContextFlags,
    getContextDeclarations: vi.fn().mockReturnValue([]),
  };
});

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: vi.fn((_ctx: string, content: string) => `execute: ${content}`),
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

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

describe('workflow execute routing through collaborate pipeline', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true } },
        'task': { id: 'task', content: 'Task', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-pre': 'terminal-1' },
      sessionRegistry: {},
    };

    setState = (partial) => { state = { ...state, ...partial }; };
    vi.clearAllMocks();
    mockExecuteInTerminal.mockResolvedValue(undefined);
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback.md');
  });

  function createActions() {
    return createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      mockAutonomousCollaborate,
    );
  }

  it('should call autonomousCollaborateInTerminal with execute mode for execute steps', () => {
    mockResolveContextMode.mockReturnValue('execute');
    const actions = createActions();

    actions.startWorkflow('task', 'terminal-1');

    expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task', 'terminal-1', { collaborate: true, execute: true }, undefined, expect.any(String));
  });

  it('should call autonomousCollaborateInTerminal with collaborate mode for collaborate steps', () => {
    mockResolveContextMode.mockReturnValue('collaborate');
    const actions = createActions();

    actions.startWorkflow('task', 'terminal-1');

    expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task', 'terminal-1', { collaborate: true, execute: false }, undefined, expect.any(String));
  });

  it('should not call fire-and-forget executeInTerminal for execute mode', () => {
    mockResolveContextMode.mockReturnValue('execute');
    const actions = createActions();

    actions.startWorkflow('task', 'terminal-1');

    expect(mockExecuteInTerminal).not.toHaveBeenCalled();
  });
});
