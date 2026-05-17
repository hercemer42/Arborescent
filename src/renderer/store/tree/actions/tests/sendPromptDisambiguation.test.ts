import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';

// These tests guard the write-back instructions in the generated terminal
// prompts. The AI must be steered to output ONLY the updated CONTENT list,
// never echoing the INSTRUCTIONS envelope or CONTEXT section. Suspected
// cause of the "automated feedback overwrites node with context text" bug.

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: vi.fn(),
  initializeFeedbackStore: vi.fn(),
  extractFeedbackContent: vi.fn(),
  cleanupFeedback: vi.fn().mockResolvedValue(undefined),
  findCollaboratingNode: vi.fn(),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForFile: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearFile: vi.fn(),
  },
}));

describe('send prompt — write-back disambiguation', () => {
  let mockGet: Mock<() => TreeState>;
  let mockSet: Mock<(partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void>;
  let actions: ReturnType<typeof createSendActions>;
  let mockState: TreeState;

  beforeEach(() => {
    vi.clearAllMocks();

    global.window = {
      electron: {
        terminalWrite: vi.fn().mockResolvedValue(undefined),
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/arborescent/feedback.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
        enqueuePrompt: vi.fn().mockResolvedValue(undefined),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const root: TreeNode = { id: 'root', content: 'Root', children: ['task', 'collab-ctx', 'exec-ctx'], metadata: { plugins: {} } };
    const task: TreeNode = {
      id: 'task',
      content: 'Write unit tests for X',
      children: [],
      metadata: { plugins: {} },
    };
    const collabCtx: TreeNode = {
      id: 'collab-ctx',
      content: 'Review context',
      children: [],
      metadata: { isContextDeclaration: true, collaborate: true, execute: false },
    };
    const execCtx: TreeNode = {
      id: 'exec-ctx',
      content: 'Execute context',
      children: [],
      metadata: { isContextDeclaration: true, collaborate: true, execute: true },
    };

    mockState = {
      nodes: { root, task, 'collab-ctx': collabCtx, 'exec-ctx': execCtx },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], task: ['root'], 'collab-ctx': ['root'], 'exec-ctx': ['root'] },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: '/project.arbo',
      fileMeta: null,
      flashingNodeIds: new Set<string>(),
      flashingIntensity: 'light' as const,
      scrollToNodeId: null,
      deletingNodeIds: new Set<string>(),
      deleteAnimationCallback: null,
      collaboratingNodeId: null,
      collaborationSource: null,
      collaboratingTerminalId: null,
      decomposition: false,
      feedbackFadingNodeIds: new Set(),
      contextDeclarations: [],
      blueprintModeEnabled: false,
      isFileBlueprintFile: false,
      summaryModeEnabled: false,
      summaryDateFrom: null,
      summaryDateTo: null,
      summaryVisibleNodeIds: null,
      workflowExecutionStates: {},
      workflowSessionMap: { 'sess-1': 'terminal-1' },
      terminalNodeAssignments: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: {} as any,
      sessionRegistry: {},
    };

    mockGet = vi.fn(() => mockState);
    mockSet = vi.fn((partial) => {
      if (typeof partial === 'function') {
        Object.assign(mockState, partial(mockState));
      } else {
        Object.assign(mockState, partial);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockExecuteCommand = vi.fn((command: any) => command.execute());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockState.actions = { executeCommand: mockExecuteCommand } as any;

    const mockVisualEffects = {
      flashNode: vi.fn(), scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn(),
    };

    actions = createSendActions(mockGet, mockSet, mockVisualEffects, vi.fn());
  });

  describe('collaborate-mode terminal prompt', () => {
    it('tells the AI to base its submission on CONTENT, not on INSTRUCTIONS', async () => {
      mockState.nodes.task.metadata.appliedContextId = 'collab-ctx';

      await actions.collaborateInTerminal('task', 'terminal-1');

      const prompt = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Base your submission on the list from the CONTENT section, not from the INSTRUCTIONS section/);
    });
  });

  describe('execute-mode terminal prompt', () => {
    it('tells the AI to preserve the CONTENT list and only change status markers', async () => {
      mockState.nodes.task.metadata.appliedContextId = 'exec-ctx';

      await actions.collaborateInTerminal('task', 'terminal-1', { collaborate: true, execute: true });

      const prompt = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/only change status markers/);
    });

    it('tells the AI NOT to replace CONTENT with a "what was done" summary', async () => {
      mockState.nodes.task.metadata.appliedContextId = 'exec-ctx';

      await actions.collaborateInTerminal('task', 'terminal-1', { collaborate: true, execute: true });

      const prompt = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Do NOT replace the CONTENT list with a summary/);
    });

    it('explicitly forbids including the CONTEXT or INSTRUCTIONS sections in the submission', async () => {
      mockState.nodes.task.metadata.appliedContextId = 'exec-ctx';

      await actions.collaborateInTerminal('task', 'terminal-1', { collaborate: true, execute: true });

      const prompt = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Do NOT include the CONTEXT or INSTRUCTIONS sections/i);
    });

    it('tells the AI the submission root MUST be the CONTENT root (not a re-emitted CONTEXT root)', async () => {
      mockState.nodes.task.metadata.appliedContextId = 'exec-ctx';

      await actions.collaborateInTerminal('task', 'terminal-1', { collaborate: true, execute: true });

      const prompt = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/submission's root heading MUST be the CONTENT section's root/i);
    });
  });

  describe('collaborate-mode write-back also forbids CONTEXT echo', () => {
    it('explicitly forbids including the CONTEXT or INSTRUCTIONS sections in the submission', async () => {
      mockState.nodes.task.metadata.appliedContextId = 'collab-ctx';

      await actions.collaborateInTerminal('task', 'terminal-1');

      const prompt = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Do NOT include the CONTEXT or INSTRUCTIONS sections/i);
    });
  });
});
