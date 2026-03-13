import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWorkflowActions } from '../workflowActions';
import type { TreeNode } from '@shared/types';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast, mockMarkWorkflowDeclarationToastSeen, mockPrefsState } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockMarkWorkflowDeclarationToastSeen: vi.fn(),
  mockPrefsState: { hasSeenWorkflowDeclarationToast: false },
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));
vi.mock('../../../preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      ...mockPrefsState,
      markWorkflowDeclarationToastSeen: mockMarkWorkflowDeclarationToastSeen,
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

    mockAddToast.mockClear();
    mockMarkWorkflowDeclarationToastSeen.mockClear();
    mockPrefsState.hasSeenWorkflowDeclarationToast = false;
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

    it('should allow nesting when ancestor already has isWorkflow', () => {
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };

      actions.declareAsWorkflow('step-1');

      expect(state.nodes['step-1'].metadata.isWorkflow).toBe(true);
    });

    it('should allow declaring as workflow when descendant already has isWorkflow', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };

      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBe(true);
    });

    it('should be a no-op if parent is not a blueprint', () => {
      state.nodes['root'].metadata.isBlueprint = undefined;

      actions.declareAsWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
    });

    it('should trigger autosave', () => {
      actions.declareAsWorkflow('workflow-candidate');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should go through executeCommand for undo support', () => {
      actions.declareAsWorkflow('workflow-candidate');

      expect(mockExecuteCommand).toHaveBeenCalled();
      const command = mockExecuteCommand.mock.calls[0][0];
      expect(command.description).toContain('workflow-candidate');
    });

    it('should be undoable via command', () => {
      actions.declareAsWorkflow('workflow-candidate');

      const command = mockExecuteCommand.mock.calls[0][0];
      command.undo();

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
    });

    it('should show step type hint toast on first workflow declaration', () => {
      actions.declareAsWorkflow('workflow-candidate');

      expect(mockAddToast).toHaveBeenCalledWith(
        'All steps default to Manual. Right-click a step to change its type.',
        'info'
      );
      expect(mockMarkWorkflowDeclarationToastSeen).toHaveBeenCalled();
    });

    it('should not show step type hint toast on subsequent declarations', () => {
      mockPrefsState.hasSeenWorkflowDeclarationToast = true;

      actions.declareAsWorkflow('workflow-candidate');

      const infoToastCalls = mockAddToast.mock.calls.filter(
        (args: unknown[]) => args[1] === 'info'
      );
      expect(infoToastCalls).toHaveLength(0);
      expect(mockMarkWorkflowDeclarationToastSeen).not.toHaveBeenCalled();
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

    it('should cascade removal to descendant workflows', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };

      actions.removeFromWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
      expect(state.nodes['step-1'].metadata.isWorkflow).toBeUndefined();
    });

    it('should cascade removal through multiple nesting levels', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };
      state.nodes['item-a'] = {
        ...state.nodes['item-a'],
        metadata: { ...state.nodes['item-a'].metadata, isWorkflow: true },
      };

      actions.removeFromWorkflow('workflow-candidate');

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBeUndefined();
      expect(state.nodes['step-1'].metadata.isWorkflow).toBeUndefined();
      expect(state.nodes['item-a'].metadata.isWorkflow).toBeUndefined();
    });

    it('should keep isBlueprint on cascaded descendants', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };

      actions.removeFromWorkflow('workflow-candidate');

      expect(state.nodes['step-1'].metadata.isBlueprint).toBe(true);
    });

    it('should trigger autosave', () => {
      actions.removeFromWorkflow('workflow-candidate');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should go through executeCommand for undo support', () => {
      actions.removeFromWorkflow('workflow-candidate');

      expect(mockExecuteCommand).toHaveBeenCalled();
      const command = mockExecuteCommand.mock.calls[0][0];
      expect(command.description).toContain('workflow-candidate');
    });

    it('should show warning toast when descendant workflows exist', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };

      actions.removeFromWorkflow('workflow-candidate');

      expect(mockAddToast).toHaveBeenCalledWith(
        'Removed workflow and nested workflows',
        'warning'
      );
    });

    it('should show info toast when no descendant workflows exist', () => {
      actions.removeFromWorkflow('workflow-candidate');

      expect(mockAddToast).toHaveBeenCalledWith('Removed from workflow', 'info');
    });

    it('should be undoable via command including cascaded descendants', () => {
      state.nodes['step-1'] = {
        ...state.nodes['step-1'],
        metadata: { ...state.nodes['step-1'].metadata, isWorkflow: true },
      };

      actions.removeFromWorkflow('workflow-candidate');
      const command = mockExecuteCommand.mock.calls[0][0];
      command.undo();

      expect(state.nodes['workflow-candidate'].metadata.isWorkflow).toBe(true);
      expect(state.nodes['step-1'].metadata.isWorkflow).toBe(true);
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

    it('should expand collapsed workflow ancestor when navigating into nested workflow', () => {
      // Set up a nested workflow
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        children: ['step-1', 'nested-wf'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };
      state.nodes['nested-wf'] = {
        id: 'nested-wf',
        content: 'Nested',
        children: ['nested-step'],
        metadata: { isBlueprint: true, isWorkflow: true, expanded: false },
      };
      state.nodes['nested-step'] = {
        id: 'nested-step',
        content: 'Nested Step',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['nested-wf'] = ['root', 'workflow-candidate'];
      state.ancestorRegistry['nested-step'] = ['root', 'workflow-candidate', 'nested-wf'];

      actions.moveToNextStep('item-a');

      expect(state.nodes['nested-wf'].metadata.expanded).toBe(true);
      expect(state.nodes['nested-step'].children).toContain('item-a');
    });
  });

  describe('setStepType', () => {
    beforeEach(() => {
      state.nodes['workflow-candidate'] = {
        ...state.nodes['workflow-candidate'],
        metadata: { ...state.nodes['workflow-candidate'].metadata, isWorkflow: true },
      };
    });

    it('should set stepType on the target node', () => {
      actions.setStepType('step-1', 'checkpoint');

      expect(state.nodes['step-1'].metadata.stepType).toBe('checkpoint');
    });

    it('should go through executeCommand for undo support', () => {
      actions.setStepType('step-1', 'autonomous');

      expect(mockExecuteCommand).toHaveBeenCalled();
      const command = mockExecuteCommand.mock.calls[0][0];
      expect(command.description).toContain('step-1');
    });

    it('should be undoable via command', () => {
      actions.setStepType('step-1', 'checkpoint');

      const command = mockExecuteCommand.mock.calls[0][0];
      command.undo();

      expect(state.nodes['step-1'].metadata.stepType).toBeUndefined();
    });

    it('should show warning toast when setting to autonomous', () => {
      actions.setStepType('step-1', 'autonomous');

      expect(mockAddToast).toHaveBeenCalledWith(
        'This step will execute automatically and advance to the next step. Ensure contexts are correctly configured.',
        'warning'
      );
    });

    it('should show warning toast when setting to checkpoint', () => {
      actions.setStepType('step-1', 'checkpoint');

      expect(mockAddToast).toHaveBeenCalledWith(
        'This step will execute automatically but pause before advancing. Review the output before continuing.',
        'warning'
      );
    });

    it('should not show warning toast when setting to manual', () => {
      actions.setStepType('step-1', 'manual');
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('should trigger autosave', () => {
      actions.setStepType('step-1', 'checkpoint');

      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should be a no-op for nonexistent nodes', () => {
      actions.setStepType('nonexistent', 'checkpoint');

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
