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

const mockParseFeedbackContent = vi.fn();
const mockInitializeFeedbackStore = vi.fn();
const mockExtractFeedbackContent = vi.fn();
const mockCleanupFeedback = vi.fn().mockResolvedValue(undefined);
const mockFindCollaboratingNode = vi.fn();

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
  initializeFeedbackStore: (...args: unknown[]) => mockInitializeFeedbackStore(...args),
  extractFeedbackContent: (...args: unknown[]) => mockExtractFeedbackContent(...args),
  cleanupFeedback: (...args: unknown[]) => mockCleanupFeedback(...args),
  findCollaboratingNode: (...args: unknown[]) => mockFindCollaboratingNode(...args),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForFile: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearFile: vi.fn(),
  },
}));

const { mockAddToast, mockGetAllStores } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockGetAllStores: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('../../../panel/panelStore', () => ({
  usePanelStore: { getState: () => ({ showBrowser: vi.fn(), showFeedback: vi.fn(), showFeedbackForFile: vi.fn(), closeFeedback: vi.fn() }) },
}));

describe('browser collaboration guard across files', () => {
  let mockState: TreeState;
  let mockSet: Mock;
  let actions: ReturnType<typeof createSendActions>;
  let mockClipboardWriteText: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockClipboardWriteText },
      writable: true,
    });

    global.window = {
      electron: {
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/feedback.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
        enqueuePrompt: vi.fn().mockResolvedValue(undefined),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockState = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['child1', 'ctx'], metadata: {} },
        child1: { id: 'child1', content: 'Child 1', children: [], metadata: { appliedContextId: 'ctx' } },
        ctx: { id: 'ctx', content: 'Review', children: [], metadata: { isContextDeclaration: true, collaborate: true, execute: false } },
      },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], child1: ['root'], ctx: ['root'] },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: '/file-b.arbo',
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

    const mockGet = vi.fn(() => mockState);
    mockSet = vi.fn((partial) => {
      if (typeof partial === 'function') {
        const updates = partial(mockState);
        Object.assign(mockState, updates);
      } else {
        Object.assign(mockState, partial);
      }
    });

    const mockExecuteCommand = vi.fn((command: { execute: () => void }) => command.execute());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockState.actions = { executeCommand: mockExecuteCommand } as any;

    const mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    mockGetAllStores.mockReturnValue([]);
    actions = createSendActions(mockGet, mockSet, mockVisualEffects, vi.fn(), mockGetAllStores);
  });

  describe('collaboration source tracking', () => {
    it('should set collaborationSource to browser when collaborate() starts', async () => {
      await actions.collaborate('child1');

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ collaborationSource: 'browser' }));
    });

    it('should set collaborationSource to terminal when collaborateInTerminal() starts', async () => {
      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ collaborationSource: 'terminal' }));
    });

    it('should clear collaborationSource on finishAccept', async () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaborationSource = 'browser';
      mockState.currentFilePath = '/test.arbo';

      const mockNodes: Record<string, TreeNode> = {
        'new-root': { id: 'new-root', content: 'New', children: [], metadata: {} },
      };

      actions.acceptFeedback('new-root', mockNodes);

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ collaborationSource: null }));
    });

    it('should clear collaborationSource on cancelCollaboration', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaborationSource = 'browser';

      actions.cancelCollaboration();

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ collaborationSource: null }));
    });
  });

  describe('cross-file browser guard', () => {
    it('should block collaborate() when another store has an active browser collaboration', async () => {
      mockGetAllStores.mockReturnValue([{
        getState: () => ({
          collaboratingNodeId: 'other-node',
          collaborationSource: 'browser',
          currentFilePath: '/file-a.arbo',
        }),
      }]);

      await actions.collaborate('child1');

      // Guard should have been called
      expect(mockGetAllStores).toHaveBeenCalled();
      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Browser collaboration already in progress'),
        'error'
      );
    });

    it('should NOT block collaborate() when another store has an active terminal collaboration', async () => {
      mockGetAllStores.mockReturnValue([{
        getState: () => ({
          collaboratingNodeId: 'other-node',
          collaborationSource: 'terminal',
          currentFilePath: '/file-a.arbo',
        }),
      }]);

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).toHaveBeenCalled();
    });

    it('should proceed when no other store has an active collaboration', async () => {
      mockGetAllStores.mockReturnValue([{
        getState: () => ({
          collaboratingNodeId: null,
          collaborationSource: null,
          currentFilePath: '/file-a.arbo',
        }),
      }]);

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).toHaveBeenCalled();
    });

    it('should include the blocking file name in the toast', async () => {
      mockGetAllStores.mockReturnValue([{
        getState: () => ({
          collaboratingNodeId: 'other-node',
          collaborationSource: 'browser',
          currentFilePath: '/projects/file-a.arbo',
        }),
      }]);

      await actions.collaborate('child1');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('file-a.arbo'),
        'error'
      );
    });
  });

  describe('guard lifecycle', () => {
    it('should allow browser collaboration after blocking file finishes', async () => {
      const otherStoreState = {
        collaboratingNodeId: 'other-node' as string | null,
        collaborationSource: 'browser' as string | null,
        currentFilePath: '/file-a.arbo',
      };

      mockGetAllStores.mockReturnValue([{
        getState: () => otherStoreState,
      }]);

      await actions.collaborate('child1');
      expect(mockClipboardWriteText).not.toHaveBeenCalled();

      otherStoreState.collaboratingNodeId = null;
      otherStoreState.collaborationSource = null;

      await actions.collaborate('child1');
      expect(mockClipboardWriteText).toHaveBeenCalled();
    });

    it('should still block within-file when terminal collaboration is active', async () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaborationSource = 'terminal';
      mockGetAllStores.mockReturnValue([]);

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });
  });

  describe('terminal collaboration independence', () => {
    it('should NOT block collaborateInTerminal when another file has browser collaboration', async () => {
      mockGetAllStores.mockReturnValue([{
        getState: () => ({
          collaboratingNodeId: 'other-node',
          collaborationSource: 'browser',
          currentFilePath: '/file-a.arbo',
        }),
      }]);

      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ collaboratingNodeId: 'child1' }));
    });
  });
});
