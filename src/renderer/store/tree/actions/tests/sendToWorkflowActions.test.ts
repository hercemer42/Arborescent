import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSendToWorkflowActions } from '../sendToWorkflowActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';
import type { VisualEffectsActions } from '../visualEffectsActions';

describe('sendToWorkflowActions.moveNodeToWorkflow', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    actions?: { executeCommand?: (cmd: { execute: () => void }) => void };
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createSendToWorkflowActions>;
  let mockVisualEffects: VisualEffectsActions;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecuteCommand = vi.fn((command: { execute: () => void }) => command.execute());
    mockTriggerAutosave = vi.fn();

    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['source-node', 'wf-a', 'wf-b'],
          metadata: {},
        },
        'source-node': {
          id: 'source-node',
          content: 'Loose task',
          children: ['source-child'],
          metadata: { appliedContextId: 'ctx-99' },
        },
        'source-child': {
          id: 'source-child',
          content: 'Child of loose task',
          children: [],
          metadata: { appliedContextId: 'ctx-100' },
        },
        'wf-a': {
          id: 'wf-a',
          content: 'Workflow A',
          children: ['wf-a-step1', 'wf-a-step2'],
          metadata: { isWorkflow: true },
        },
        'wf-a-step1': {
          id: 'wf-a-step1',
          content: 'A — Step 1',
          children: ['wf-a-step1-existing'],
          metadata: {},
        },
        'wf-a-step1-existing': {
          id: 'wf-a-step1-existing',
          content: 'Existing child under step 1',
          children: [],
          metadata: {},
        },
        'wf-a-step2': {
          id: 'wf-a-step2',
          content: 'A — Step 2',
          children: [],
          metadata: {},
        },
        'wf-b': {
          id: 'wf-b',
          content: 'Workflow B (empty)',
          children: [],
          metadata: { isWorkflow: true },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'source-node': ['root'],
        'source-child': ['root', 'source-node'],
        'wf-a': ['root'],
        'wf-a-step1': ['root', 'wf-a'],
        'wf-a-step1-existing': ['root', 'wf-a', 'wf-a-step1'],
        'wf-a-step2': ['root', 'wf-a'],
        'wf-b': ['root'],
      },
      actions: { executeCommand: mockExecuteCommand },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    actions = createSendToWorkflowActions(
      () => state as never,
      setState as never,
      mockTriggerAutosave,
      mockVisualEffects,
      mockExecuteCommand,
    );
  });

  it('places the moved node as the first child of the destination workflow first step', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(state.nodes['wf-a-step1'].children).toEqual(['source-node', 'wf-a-step1-existing']);
  });

  it('removes the moved node from its previous parent', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(state.nodes['root'].children).not.toContain('source-node');
  });

  it('moves the entire subtree (children come along with the node)', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(state.nodes['source-node'].children).toEqual(['source-child']);
    expect(state.nodes['source-child']).toBeDefined();
  });

  it('preserves attached contexts on the moved node and its descendants', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(state.nodes['source-node'].metadata.appliedContextId).toBe('ctx-99');
    expect(state.nodes['source-child'].metadata.appliedContextId).toBe('ctx-100');
  });

  it('updates the ancestor registry to reflect the new parentage', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(state.ancestorRegistry['source-node']).toEqual(['root', 'wf-a', 'wf-a-step1']);
    expect(state.ancestorRegistry['source-child']).toEqual(['root', 'wf-a', 'wf-a-step1', 'source-node']);
  });

  it('triggers the move animation (flash) on the moved node', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('source-node');
  });

  it('centers the view on the moved node', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(mockVisualEffects.scrollToNode).toHaveBeenCalledWith('source-node');
  });

  it('triggers autosave', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(mockTriggerAutosave).toHaveBeenCalled();
  });

  it('routes the move through executeCommand so undo/redo can reverse it', () => {
    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(mockExecuteCommand).toHaveBeenCalled();
  });

  it('is a no-op when the destination workflow node does not exist', () => {
    const rootChildrenBefore = [...state.nodes['root'].children];

    actions.moveNodeToWorkflow('source-node', 'does-not-exist');

    expect(state.nodes['root'].children).toEqual(rootChildrenBefore);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
    expect(mockVisualEffects.flashNode).not.toHaveBeenCalled();
  });

  it('is a no-op when the destination node is not flagged as a workflow', () => {
    const rootChildrenBefore = [...state.nodes['root'].children];

    actions.moveNodeToWorkflow('source-node', 'source-child');

    expect(state.nodes['root'].children).toEqual(rootChildrenBefore);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('is a no-op when the destination workflow has no first step', () => {
    const rootChildrenBefore = [...state.nodes['root'].children];

    actions.moveNodeToWorkflow('source-node', 'wf-b');

    expect(state.nodes['root'].children).toEqual(rootChildrenBefore);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
    expect(mockVisualEffects.flashNode).not.toHaveBeenCalled();
  });

  it('is a no-op when the source node does not exist', () => {
    const step1ChildrenBefore = [...state.nodes['wf-a-step1'].children];

    actions.moveNodeToWorkflow('ghost-node', 'wf-a');

    expect(state.nodes['wf-a-step1'].children).toEqual(step1ChildrenBefore);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('is a no-op when the destination is the source node itself', () => {
    state.nodes['wf-self'] = {
      id: 'wf-self',
      content: 'Self workflow',
      children: ['wf-self-step1'],
      metadata: { isWorkflow: true },
    };
    state.nodes['wf-self-step1'] = {
      id: 'wf-self-step1',
      content: 'Self step 1',
      children: [],
      metadata: {},
    };
    state.nodes['root'].children = [...state.nodes['root'].children, 'wf-self'];
    state.ancestorRegistry['wf-self'] = ['root'];
    state.ancestorRegistry['wf-self-step1'] = ['root', 'wf-self'];

    actions.moveNodeToWorkflow('wf-self', 'wf-self');

    expect(state.nodes['wf-self-step1'].children).toEqual([]);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('is a no-op when the destination is a descendant of the source (would cycle)', () => {
    state.nodes['wf-outer'] = {
      id: 'wf-outer',
      content: 'Outer',
      children: ['wf-outer-step1'],
      metadata: { isWorkflow: true },
    };
    state.nodes['wf-outer-step1'] = {
      id: 'wf-outer-step1',
      content: 'Outer step 1',
      children: ['wf-inner'],
      metadata: {},
    };
    state.nodes['wf-inner'] = {
      id: 'wf-inner',
      content: 'Inner',
      children: ['wf-inner-step1'],
      metadata: { isWorkflow: true },
    };
    state.nodes['wf-inner-step1'] = {
      id: 'wf-inner-step1',
      content: 'Inner step 1',
      children: [],
      metadata: {},
    };
    state.nodes['root'].children = [...state.nodes['root'].children, 'wf-outer'];
    state.ancestorRegistry['wf-outer'] = ['root'];
    state.ancestorRegistry['wf-outer-step1'] = ['root', 'wf-outer'];
    state.ancestorRegistry['wf-inner'] = ['root', 'wf-outer', 'wf-outer-step1'];
    state.ancestorRegistry['wf-inner-step1'] = ['root', 'wf-outer', 'wf-outer-step1', 'wf-inner'];

    actions.moveNodeToWorkflow('wf-outer', 'wf-inner');

    expect(state.nodes['wf-inner-step1'].children).toEqual([]);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('expands collapsed ancestors at the destination so the moved node is visible', () => {
    state.nodes['wf-a'].metadata.expanded = false;
    state.nodes['wf-a-step1'].metadata.expanded = false;

    actions.moveNodeToWorkflow('source-node', 'wf-a');

    expect(state.nodes['wf-a'].metadata.expanded).toBe(true);
    expect(state.nodes['wf-a-step1'].metadata.expanded).toBe(true);
  });

  it('relocates the node when destination is the workflow the node already lives in', () => {
    state.nodes['wf-a-step1'].children = ['source-node', 'wf-a-step1-existing'];
    state.nodes['root'].children = ['wf-a', 'wf-b'];
    state.ancestorRegistry['source-node'] = ['root', 'wf-a', 'wf-a-step1'];
    state.nodes['wf-a-step2'].children = ['stray'];
    state.nodes['stray'] = {
      id: 'stray',
      content: 'Stray under step 2',
      children: [],
      metadata: {},
    };
    state.ancestorRegistry['stray'] = ['root', 'wf-a', 'wf-a-step2'];

    actions.moveNodeToWorkflow('stray', 'wf-a');

    expect(state.nodes['wf-a-step1'].children[0]).toBe('stray');
    expect(state.nodes['wf-a-step2'].children).not.toContain('stray');
  });
});
