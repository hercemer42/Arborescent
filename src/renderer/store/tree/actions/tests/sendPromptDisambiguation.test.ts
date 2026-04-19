import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { BASIC_REVIEW_CONTEXT_ID, BASIC_EXECUTE_CONTEXT_ID } from '../../../../utils/nodeHelpers';

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
        startFeedbackFileWatcher: vi.fn().mockResolvedValue(undefined),
        stopFeedbackFileWatcher: vi.fn().mockResolvedValue(undefined),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const root: TreeNode = { id: 'root', content: 'Root', children: ['task'], metadata: { plugins: {} } };
    const task: TreeNode = {
      id: 'task',
      content: 'Write unit tests for X',
      children: [],
      metadata: { plugins: {} },
    };

    mockState = {
      nodes: { root, task },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], task: ['root'] },
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
      workflowSessionMap: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: {} as any,
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
    it('tells the AI to base its output on CONTENT, not on INSTRUCTIONS', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.nodes.task.metadata.appliedContextId = BASIC_REVIEW_CONTEXT_ID;

      await actions.collaborateInTerminal('task', 'terminal-1');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Base your output on the list from the CONTENT section, not from the INSTRUCTIONS section/);
    });
  });

  describe('execute-mode terminal prompt', () => {
    it('tells the AI to preserve the CONTENT list and only change status markers', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.nodes.task.metadata.appliedContextId = BASIC_EXECUTE_CONTEXT_ID;

      await actions.collaborateInTerminal('task', 'terminal-1', 'execute');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/only change status markers/);
    });

    it('tells the AI NOT to replace CONTENT with a "what was done" summary', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.nodes.task.metadata.appliedContextId = BASIC_EXECUTE_CONTEXT_ID;

      await actions.collaborateInTerminal('task', 'terminal-1', 'execute');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Do NOT replace the CONTENT list with a summary/);
    });

    it('explicitly forbids writing the CONTEXT or INSTRUCTIONS sections to the file', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.nodes.task.metadata.appliedContextId = BASIC_EXECUTE_CONTEXT_ID;

      await actions.collaborateInTerminal('task', 'terminal-1', 'execute');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Do NOT write any part of the CONTEXT or INSTRUCTIONS sections/i);
    });

    it('tells the AI the file root MUST be the CONTENT root (not a re-emitted CONTEXT root)', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.nodes.task.metadata.appliedContextId = BASIC_EXECUTE_CONTEXT_ID;

      await actions.collaborateInTerminal('task', 'terminal-1', 'execute');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/file's root heading MUST be the CONTENT section's root/i);
    });
  });

  describe('collaborate-mode write-back also forbids CONTEXT echo', () => {
    it('explicitly forbids writing the CONTEXT or INSTRUCTIONS sections to the file', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.nodes.task.metadata.appliedContextId = BASIC_REVIEW_CONTEXT_ID;

      await actions.collaborateInTerminal('task', 'terminal-1');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).toMatch(/Do NOT write any part of the CONTEXT or INSTRUCTIONS sections/i);
    });
  });
});
