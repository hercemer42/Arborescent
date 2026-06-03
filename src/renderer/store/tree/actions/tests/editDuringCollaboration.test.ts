import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeActions } from '../nodeActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: mockLoggerError },
}));

vi.mock('../../../terminal/syncBoundTerminalTitles', () => ({
  syncBoundTerminalTitles: vi.fn(),
}));

describe('editing a node during collaboration', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId: string | null;
    cursorPosition: number;
    rememberedVisualX: number | null;
    collaboratingNodeId: string | null;
    blueprintModeEnabled: boolean;
    actions?: { executeCommand?: (cmd: unknown) => void };
  };
  let state: TestState;
  let actions: ReturnType<typeof createNodeActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      command.execute();
    });

    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['collab-node', 'other-node', 'link-node'],
          metadata: {},
        },
        'collab-node': {
          id: 'collab-node',
          content: 'Being collaborated on',
          children: ['collab-child'],
          metadata: { status: 'pending' },
        },
        'collab-child': {
          id: 'collab-child',
          content: 'Child of collaborating node',
          children: [],
          metadata: { status: 'pending' },
        },
        'other-node': {
          id: 'other-node',
          content: 'Unrelated node',
          children: [],
          metadata: { status: 'pending' },
        },
        'link-node': {
          id: 'link-node',
          content: 'Hyperlink node',
          children: [],
          metadata: { status: 'pending', isHyperlink: true },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'collab-node': ['root'],
        'collab-child': ['root', 'collab-node'],
        'other-node': ['root'],
        'link-node': ['root'],
      },
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      collaboratingNodeId: 'collab-node',
      blueprintModeEnabled: false,
    };

    const setState = (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    actions = createNodeActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      vi.fn(),
      { executeCommand: mockExecuteCommand }
    );
  });

  describe('editing the collaborating node', () => {
    it('applies the edit to the store', () => {
      actions.updateContent('collab-node', 'User edit during collab');
      expect(state.nodes['collab-node'].content).toBe('User edit during collab');
    });

    it('does not show an error toast', () => {
      actions.updateContent('collab-node', 'User edit during collab');
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('does not log an error', () => {
      actions.updateContent('collab-node', 'User edit during collab');
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('routes the edit through the command stack so it is undo-recoverable', () => {
      actions.updateContent('collab-node', 'User edit during collab');
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });

    it('applies repeated keystroke edits in order', () => {
      actions.updateContent('collab-node', 'a');
      actions.updateContent('collab-node', 'ab');
      actions.updateContent('collab-node', 'abc');
      expect(state.nodes['collab-node'].content).toBe('abc');
      expect(mockExecuteCommand).toHaveBeenCalledTimes(3);
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('allows clearing the content to an empty string', () => {
      actions.updateContent('collab-node', '');
      expect(state.nodes['collab-node'].content).toBe('');
      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  describe('consistency with surrounding edit policy', () => {
    it('edits descendants of the collaborating node without a toast', () => {
      actions.updateContent('collab-child', 'Edited child');
      expect(state.nodes['collab-child'].content).toBe('Edited child');
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('edits unrelated nodes without a toast', () => {
      actions.updateContent('other-node', 'Edited other');
      expect(state.nodes['other-node'].content).toBe('Edited other');
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('still ignores edits to hyperlink nodes during collaboration', () => {
      state.collaboratingNodeId = 'link-node';
      actions.updateContent('link-node', 'Attempted link edit');
      expect(state.nodes['link-node'].content).toBe('Hyperlink node');
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('no-ops on an unknown node id without a toast', () => {
      actions.updateContent('missing-node', 'whatever');
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });
});
