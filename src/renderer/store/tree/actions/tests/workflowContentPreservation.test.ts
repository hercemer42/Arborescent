import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';

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

function getTerminalPrompt(executeInTerminal: unknown): string {
  const calls = vi.mocked(executeInTerminal as ReturnType<typeof vi.fn>).mock.calls;
  return (calls[calls.length - 1]?.[1] as string) ?? '';
}

describe('Workflow steps preserve the original node content', () => {
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
        createTempFile: vi.fn().mockResolvedValue('/tmp/arborescent/feedback-response.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const rootNode: TreeNode = {
      id: 'root', content: 'Root', children: ['feature', 'refactor', 'empty'],
      metadata: { plugins: {} },
    };
    const feature: TreeNode = {
      id: 'feature',
      content: 'Toast messages make the current panel lose focus',
      children: ['f-1', 'f-2'],
      metadata: { plugins: {} },
    };
    const f1: TreeNode = {
      id: 'f-1', content: 'For instance if in terminal and toast appears, focus moves to tree',
      children: [], metadata: { plugins: {} },
    };
    const f2: TreeNode = {
      id: 'f-2', content: 'Make it so they don\'t steal focus',
      children: [], metadata: { plugins: {} },
    };
    const refactor: TreeNode = {
      id: 'refactor',
      content: 'Refactor toast store to comply with conventions',
      children: ['r-1'],
      metadata: { plugins: {} },
    };
    const r1: TreeNode = {
      id: 'r-1', content: 'Move DOM side effects to a service',
      children: [], metadata: { plugins: {} },
    };
    const empty: TreeNode = {
      id: 'empty', content: 'Empty node', children: [], metadata: { plugins: {} },
    };
    const execCtx: TreeNode = {
      id: 'exec-ctx', content: 'Execute context', children: [],
      metadata: { isContextDeclaration: true, collaborate: true, execute: true },
    };

    mockState = {
      nodes: { root: rootNode, feature, 'f-1': f1, 'f-2': f2, refactor, 'r-1': r1, empty, 'exec-ctx': execCtx },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: {
        root: [], feature: ['root'], 'f-1': ['root', 'feature'], 'f-2': ['root', 'feature'],
        refactor: ['root'], 'r-1': ['root', 'refactor'], empty: ['root'], 'exec-ctx': ['root'],
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
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
      workflowSessionMap: {},
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

    mockState.nodes.feature.metadata.appliedContextId = 'exec-ctx';
    mockState.nodes.refactor.metadata.appliedContextId = 'exec-ctx';
    mockState.nodes.empty.metadata.appliedContextId = 'exec-ctx';
  });

  describe('execute-mode workflow prompt explicitly targets CONTENT (not INSTRUCTIONS)', () => {
    it('instructs the AI to write back the list that appears in the CONTENT section', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      const writeBackInstructions = prompt
        .split('===END INSTRUCTIONS===')[0]
        .split('IMPORTANT: Make the requested code changes')[1] ?? '';
      expect(writeBackInstructions).toMatch(/CONTENT/);
    });

    // The summary-replacement failure mode is structurally gone in both-mode:
    // there is no submission to replace. The prompt reports through MCP tools.
    it('contains no submit write-back — progress is recorded via mark_step_complete', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).not.toContain('submit_step_output');
      expect(prompt).toContain('mark_step_complete');
    });

    it('explicitly states that only statuses should change, not the list items themselves', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('only change statuses');
    });

    it('explicitly forbids rewriting, reorganizing, or retitling the list', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('Do NOT rewrite, reorganize, retitle');
    });

    it('instructs the AI to skip items already marked [x]', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('Skip items already marked [x]');
    });

    it('records issues via add_child_node', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('add_child_node');
    });
  });

  describe('collaborate-mode workflow prompt preserves CONTENT structure', () => {
    it('instructs the AI that the CONTENT list is the source material for its submission', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt(executeInTerminal);

      const submitBlock = prompt
        .split('===END INSTRUCTIONS===')[0]
        .split('IMPORTANT: When you are done')[1] ?? '';
      expect(submitBlock).toMatch(/CONTENT/);
    });
  });

  describe('disambiguation between CONTENT and CONTEXT sections', () => {
    it('wraps the original node content in the CONTENT section', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('===BEGIN CONTENT===');
      expect(prompt).toContain('===END CONTENT===');
      expect(prompt).toContain('Toast messages make the current panel lose focus');
    });

    it('places instructions in their own section so they cannot be confused with CONTENT', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('===BEGIN INSTRUCTIONS===');
      expect(prompt).toContain('===END INSTRUCTIONS===');
    });

    it('write-back instruction references the CONTENT marker, not the INSTRUCTIONS marker', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      const instructionsSection = prompt
        .split('===BEGIN INSTRUCTIONS===')[1]
        ?.split('===END INSTRUCTIONS===')[0] ?? '';
      const writeBackBlock = instructionsSection.split('IMPORTANT:')[1] ?? '';

      expect(writeBackBlock).toContain('CONTENT');
      expect(writeBackBlock).not.toMatch(/write back the INSTRUCTIONS/i);
    });
  });

  describe('happy path — node content reaches the AI intact', () => {
    it('includes the feature node title as the root of the CONTENT list', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('# [ ] Toast messages make the current panel lose focus');
    });

    it('includes all child nodes in the CONTENT list', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('For instance if in terminal and toast appears, focus moves to tree');
      expect(prompt).toContain("Make it so they don't steal focus");
    });

    it('also works for AI-refactor-style nodes with their own subtree', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('refactor', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('Refactor toast store to comply with conventions');
      expect(prompt).toContain('Move DOM side effects to a service');
      expect(prompt).toContain('Do NOT rewrite, reorganize, retitle');
      expect(prompt).toContain('only change statuses');
    });
  });

  describe('edge cases — empty, null, boundary', () => {
    it('handles a node with no children without erroring', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('empty', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt(executeInTerminal);

      expect(prompt).toContain('# [ ] Empty node');
      expect(prompt).toContain('Do NOT rewrite, reorganize, retitle');
    });
  });

  describe('OUTPUT FORMAT advertises that only heading lines persist between steps', () => {
    it('states explicitly that non-heading lines are discarded between steps', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt(executeInTerminal);

      const outputFormatBlock = prompt.split('OUTPUT FORMAT:')[1]?.split('===END INSTRUCTIONS===')[0] ?? '';
      expect(outputFormatBlock).toMatch(/only heading lines.*persist|non-heading.*(discarded|dropped|stripped)/i);
    });

    it('includes a worked example showing a value captured as its own heading line', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt(executeInTerminal);

      const outputFormatBlock = prompt.split('OUTPUT FORMAT:')[1]?.split('===END INSTRUCTIONS===')[0] ?? '';
      expect(outputFormatBlock).toMatch(/(value|capture|persist).{0,80}\n.*###?\s*\[\s\]/is);
    });

    it('uses "as a child node" wording rather than spatial words like "underneath" or "below" when persistence is required', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt(executeInTerminal);

      const outputFormatBlock = prompt.split('OUTPUT FORMAT:')[1]?.split('===END INSTRUCTIONS===')[0] ?? '';
      expect(outputFormatBlock).not.toMatch(/\bunderneath\b/i);
      expect(outputFormatBlock).not.toMatch(/place.*\bbelow\b.*the.*(node|heading)/i);
    });

    it.todo('OUTPUT FORMAT in the decomposition variant also advertises the heading-persistence rule');
  });
});
