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

function getTerminalPrompt(): string {
  const calls = (window.electron.enqueuePrompt as ReturnType<typeof vi.fn>).mock.calls;
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
        enqueuePrompt: vi.fn().mockResolvedValue(undefined),
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
      workflowSessionMap: { 'sess-1': 'term-1' },
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
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      const writeBackInstructions = prompt
        .split('===END INSTRUCTIONS===')[0]
        .split('IMPORTANT: Make the requested code changes')[1] ?? '';
      expect(writeBackInstructions).toMatch(/CONTENT/);
    });

    it('forbids replacing CONTENT with a summary of work that was done', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toMatch(/summary|what you did|what was done|done list/i);
    });

    it('forbids writing a "what was done" checklist in place of the original list', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toMatch(/do not (replace|overwrite|substitute).*(with|for) (a|the) (summary|checklist|list of|what was done)/i);
    });

    it('explicitly states that only status markers should change, not the list items themselves', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('only change status markers');
    });

    it('explicitly forbids rewriting, reorganizing, or retitling the list', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('Do NOT rewrite, reorganize, retitle');
    });

    it('instructs the AI to skip items already marked [x]', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('Skip items already marked [x]');
    });

    it('allows appending a single child node for issues encountered', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('append a single new child node at the end');
    });
  });

  describe('collaborate-mode workflow prompt preserves CONTENT structure', () => {
    it('instructs the AI that the CONTENT list is the source material for its submission', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt();

      const submitBlock = prompt
        .split('===END INSTRUCTIONS===')[0]
        .split('IMPORTANT: When you are done')[1] ?? '';
      expect(submitBlock).toMatch(/CONTENT/);
    });
  });

  describe('disambiguation between CONTENT and CONTEXT sections', () => {
    it('wraps the original node content in the CONTENT section', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('===BEGIN CONTENT===');
      expect(prompt).toContain('===END CONTENT===');
      expect(prompt).toContain('Toast messages make the current panel lose focus');
    });

    it('places instructions in their own section so they cannot be confused with CONTENT', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('===BEGIN INSTRUCTIONS===');
      expect(prompt).toContain('===END INSTRUCTIONS===');
    });

    it('write-back instruction references the CONTENT marker, not the INSTRUCTIONS marker', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

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
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('# [ ] Toast messages make the current panel lose focus');
    });

    it('includes all child nodes in the CONTENT list', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('For instance if in terminal and toast appears, focus moves to tree');
      expect(prompt).toContain("Make it so they don't steal focus");
    });

    it('also works for AI-refactor-style nodes with their own subtree', async () => {
      await actions.collaborateInTerminal('refactor', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('Refactor toast store to comply with conventions');
      expect(prompt).toContain('Move DOM side effects to a service');
      expect(prompt).toContain('Do NOT rewrite, reorganize, retitle');
      expect(prompt).toContain('only change status markers');
    });
  });

  describe('edge cases — empty, null, boundary', () => {
    it('handles a node with no children without erroring', async () => {
      await actions.collaborateInTerminal('empty', 'term-1', { collaborate: true, execute: true });
      const prompt = getTerminalPrompt();

      expect(prompt).toContain('# [ ] Empty node');
      expect(prompt).toContain('Do NOT rewrite, reorganize, retitle');
    });
  });

  describe('OUTPUT FORMAT advertises that only heading lines persist between steps', () => {
    it('states explicitly that non-heading lines are discarded between steps', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt();

      const outputFormatBlock = prompt.split('OUTPUT FORMAT:')[1]?.split('===END INSTRUCTIONS===')[0] ?? '';
      expect(outputFormatBlock).toMatch(/only heading lines.*persist|non-heading.*(discarded|dropped|stripped)/i);
    });

    it('includes a worked example showing a value captured as its own heading line', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt();

      const outputFormatBlock = prompt.split('OUTPUT FORMAT:')[1]?.split('===END INSTRUCTIONS===')[0] ?? '';
      expect(outputFormatBlock).toMatch(/(value|capture|persist).{0,80}\n.*###?\s*\[\s\]/is);
    });

    it('uses "as a child node" wording rather than spatial words like "underneath" or "below" when persistence is required', async () => {
      await actions.collaborateInTerminal('feature', 'term-1', { collaborate: true, execute: false });
      const prompt = getTerminalPrompt();

      const outputFormatBlock = prompt.split('OUTPUT FORMAT:')[1]?.split('===END INSTRUCTIONS===')[0] ?? '';
      expect(outputFormatBlock).not.toMatch(/\bunderneath\b/i);
      expect(outputFormatBlock).not.toMatch(/place.*\bbelow\b.*the.*(node|heading)/i);
    });

    it.todo('OUTPUT FORMAT in the decomposition variant also advertises the heading-persistence rule');
  });
});
