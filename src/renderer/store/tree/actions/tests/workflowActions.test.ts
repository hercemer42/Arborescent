import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWorkflowActions } from '../workflowActions';
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

describe('createWorkflowActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockVisualEffects: { flashNode: ReturnType<typeof vi.fn>; scrollToNode: ReturnType<typeof vi.fn>; startDeleteAnimation: ReturnType<typeof vi.fn>; clearDeleteAnimation: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Tree:
    // root (blueprint)
    // ├── workflow-candidate (blueprint) → will become workflow
    // │   ├── step-1
    // │   │   ├── item-a
    // │   │   └── item-b
    // │   └── step-2
    // │       └── item-c
    // └── other-node
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['workflow-candidate', 'other-node'],
          metadata: { isBlueprint: true },
        },
        'workflow-candidate': {
          id: 'workflow-candidate',
          content: 'Workflow',
          children: ['step-1', 'step-2'],
          metadata: { isBlueprint: true },
        },
        'step-1': {
          id: 'step-1',
          content: 'Step 1',
          children: ['item-a', 'item-b'],
          metadata: { isBlueprint: true },
        },
        'step-2': {
          id: 'step-2',
          content: 'Step 2',
          children: ['item-c'],
          metadata: { isBlueprint: true },
        },
        'item-a': {
          id: 'item-a',
          content: 'Item A',
          children: [],
          metadata: { isBlueprint: true },
        },
        'item-b': {
          id: 'item-b',
          content: 'Item B',
          children: [],
          metadata: { isBlueprint: true },
        },
        'item-c': {
          id: 'item-c',
          content: 'Item C',
          children: [],
          metadata: { isBlueprint: true },
        },
        'other-node': {
          id: 'other-node',
          content: 'Other',
          children: [],
          metadata: {},
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow-candidate': ['root'],
        'step-1': ['root', 'workflow-candidate'],
        'step-2': ['root', 'workflow-candidate'],
        'item-a': ['root', 'workflow-candidate', 'step-1'],
        'item-b': ['root', 'workflow-candidate', 'step-1'],
        'item-c': ['root', 'workflow-candidate', 'step-2'],
        'other-node': ['root'],
      },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    mockTriggerAutosave = vi.fn();
    mockExecuteCommand = vi.fn((command) => command.execute());
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    actions = createWorkflowActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockExecuteCommand,
      mockVisualEffects
    );
  });

  describe('declareAsWorkflow', () => {
    it('should set isWorkflow and isBlueprint on a valid candidate', () => {
      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBe(true);
      expect(state.nodes['workflow-candidate'].metadata.isBlueprint).toBe(true);
    });

    it('should auto-add node as blueprint when declaring as workflow', () => {
      state.nodes['workflow-candidate'].metadata.isBlueprint = undefined;

      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isBlueprint).toBe(true);
      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBe(true);
    });

    it('should auto-add children as blueprints', () => {
      state.nodes['step-1'].metadata.isBlueprint = undefined;
      state.nodes['step-2'].metadata.isBlueprint = undefined;

      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['step-1'].metadata.isBlueprint).toBe(true);
      expect(state.nodes['step-2'].metadata.isBlueprint).toBe(true);
    });

    it('should be a no-op if parent is not a blueprint', () => {
      state.nodes['root'].metadata.isBlueprint = undefined;

      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
    });

    it('should be a no-op if ancestor already has isWorkflow', () => {
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };

      actions.declareAsWorkflow('step-1');

      expect(state.nodes['step-1'].metadata.isWorkflow).toBeUndefined();
    });

    it('should be a no-op if descendant already has isWorkflow', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };

      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
    });

    it('should trigger autosave', () => {
      actions.declareAsWorkflow('workflow-candidate');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('removeFromWorkflow', () => {
    beforeEach(() => {
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };
    });

    it('should clear isWorkflow but keep isBlueprint', () => {
      actions.removeFromWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
      expect(state.nodes['workflow-candidate'].metadata.isBlueprint).toBe(true);
    });

    it('should trigger autosave', () => {
      actions.removeFromWorkflow('workflow-candidate');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('moveToNextStep', () => {
    beforeEach(() => {
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };
    });

    it('should call executeCommand with MoveNodeCommand targeting next step position 0', () => {
      actions.moveToNextStep('item-a');

      expect(mockExecuteCommand).toHaveBeenCalled();
      expect(state.nodes['step-2'].children).toContain('item-a');
      expect(state.nodes['step-1'].children).not.toContain('item-a');
    });

    it('should call flashNode and scrollToNode', () => {
      actions.moveToNextStep('item-a');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('item-a');
      expect(mockVisualEffects.scrollToNode).toHaveBeenCalledWith('item-a');
    });

    it('should be a no-op when at last step', () => {
      actions.moveToNextStep('item-c');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });

  describe('moveToPreviousStep', () => {
    beforeEach(() => {
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };
    });

    it('should call executeCommand with MoveNodeCommand targeting previous step position 0', () => {
      actions.moveToPreviousStep('item-c');

      expect(mockExecuteCommand).toHaveBeenCalled();
      expect(state.nodes['step-1'].children).toContain('item-c');
      expect(state.nodes['step-2'].children).not.toContain('item-c');
    });

    it('should be a no-op when at first step', () => {
      actions.moveToPreviousStep('item-a');

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });
});
