import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBlueprintActions } from '../blueprintActions';
import type { TreeNode } from '@shared/types';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}));

describe('blueprintActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    blueprintModeEnabled: boolean;
    isFileBlueprintFile: boolean;
    activeNodeId: string | null;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createBlueprintActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['node-1', 'node-2'],
          metadata: { isBlueprint: true },
        },
        'node-1': {
          id: 'node-1',
          content: 'Task 1',
          children: ['node-3'],
          metadata: { status: 'pending', isBlueprint: true },
        },
        'node-2': {
          id: 'node-2',
          content: 'Task 2',
          children: [],
          metadata: { status: 'pending' },
        },
        'node-3': {
          id: 'node-3',
          content: 'Task 3',
          children: [],
          metadata: { status: 'pending', isBlueprint: true },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['node-1', 'root'],
      },
      blueprintModeEnabled: false,
      isFileBlueprintFile: false,
      activeNodeId: 'node-1',
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    mockTriggerAutosave = vi.fn();
    mockExecuteCommand = vi.fn((command) => command.execute());
    actions = createBlueprintActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockExecuteCommand
    );
  });

  describe('toggleBlueprintMode', () => {
    it('should toggle blueprint mode from false to true', () => {
      expect(state.blueprintModeEnabled).toBe(false);

      actions.toggleBlueprintMode();

      expect(state.blueprintModeEnabled).toBe(true);
    });

    it('should toggle blueprint mode from true to false', () => {
      state.blueprintModeEnabled = true;

      actions.toggleBlueprintMode();

      expect(state.blueprintModeEnabled).toBe(false);
    });

    it('should clear activeNodeId when enabling blueprint mode', () => {
      state.activeNodeId = 'node-1';

      actions.toggleBlueprintMode();

      expect(state.blueprintModeEnabled).toBe(true);
      expect(state.activeNodeId).toBe(null);
    });

    it('should preserve activeNodeId when disabling blueprint mode', () => {
      state.blueprintModeEnabled = true;
      state.activeNodeId = 'node-1';

      actions.toggleBlueprintMode();

      expect(state.blueprintModeEnabled).toBe(false);
      expect(state.activeNodeId).toBe('node-1');
    });
  });

  describe('setBlueprintIcon', () => {
    it('should set blueprint icon on a node', () => {
      actions.setBlueprintIcon('node-1', 'Star');

      expect(state.nodes['node-1'].metadata.blueprintIcon).toBe('Star');
    });

    it('should set blueprint icon with color', () => {
      actions.setBlueprintIcon('node-1', 'Star', '#ff0000');

      expect(state.nodes['node-1'].metadata.blueprintIcon).toBe('Star');
      expect(state.nodes['node-1'].metadata.blueprintColor).toBe('#ff0000');
    });

    it('should trigger autosave after setting icon', () => {
      actions.setBlueprintIcon('node-1', 'Star');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });
});
