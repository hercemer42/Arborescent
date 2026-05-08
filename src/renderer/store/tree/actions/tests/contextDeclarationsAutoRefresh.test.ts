import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createContextActions } from '../contextActions';
import { createNodeActions } from '../nodeActions';
import { HistoryManager } from '../../commands/HistoryManager';
import type { TreeNode } from '@shared/types';

// Pins the contract that any edit to a context-declared node — whether it is
// the label, icon, colour, or mode — leaves `contextDeclarations` in sync,
// so the right-click "Set context" submenu reflects the change without a
// restart.

describe('contextDeclarations stay in sync with context node edits', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; collaborate: boolean; execute: boolean }[];
    ancestorRegistry: Record<string, string[]>;
    activeNodeId: string | null;
    cursorPosition: number;
    rememberedVisualX: number | null;
    collaboratingNodeId: string | null;
    blueprintModeEnabled: boolean;
    actions?: {
      executeCommand?: (cmd: unknown) => void;
      refreshContextDeclarations?: () => void;
    };
  };

  let state: TestState;
  let setState: (partial: Partial<TestState> | ((s: TestState) => Partial<TestState>)) => void;
  let contextActions: ReturnType<typeof createContextActions>;
  let nodeActions: ReturnType<typeof createNodeActions>;
  let historyManager: HistoryManager;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['ctx-node', 'plain-node'],
          metadata: { isBlueprint: true },
        },
        'ctx-node': {
          id: 'ctx-node',
          content: 'Original label',
          children: [],
          metadata: {},
        },
        'plain-node': {
          id: 'plain-node',
          content: 'Just a task',
          children: [],
          metadata: {},
        },
      },
      rootNodeId: 'root',
      contextDeclarations: [],
      ancestorRegistry: {
        'root': [],
        'ctx-node': ['root'],
        'plain-node': ['root'],
      },
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      collaboratingNodeId: null,
      blueprintModeEnabled: false,
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    historyManager = new HistoryManager();
    const executeCommand = (cmd: unknown) =>
      historyManager.executeCommand(cmd as Parameters<HistoryManager['executeCommand']>[0]);

    contextActions = createContextActions(
      () => state as never,
      setState as never,
      vi.fn(),
      executeCommand
    );

    nodeActions = createNodeActions(
      () => state as never,
      setState as never,
      vi.fn()
    );

    state.actions = {
      executeCommand,
      refreshContextDeclarations: contextActions.refreshContextDeclarations,
    };
  });

  function declarationFor(nodeId: string) {
    return state.contextDeclarations.find(d => d.nodeId === nodeId);
  }

  describe('label edits', () => {
    it('reflects new label in contextDeclarations after updateContent on a context-declared node', () => {
      contextActions.declareAsContext('ctx-node', 'star', undefined, 'collaborate');
      expect(declarationFor('ctx-node')?.content).toBe('Original label');

      nodeActions.updateContent('ctx-node', 'Renamed context');

      expect(declarationFor('ctx-node')?.content).toBe('Renamed context');
    });

    it('reflects undo of a label edit on a context-declared node in contextDeclarations', () => {
      contextActions.declareAsContext('ctx-node', 'star', undefined, 'collaborate');
      nodeActions.updateContent('ctx-node', 'Renamed context');
      expect(declarationFor('ctx-node')?.content).toBe('Renamed context');

      historyManager.undo();

      expect(declarationFor('ctx-node')?.content).toBe('Original label');
    });

    it('reflects redo of a label edit on a context-declared node in contextDeclarations', () => {
      contextActions.declareAsContext('ctx-node', 'star', undefined, 'collaborate');
      nodeActions.updateContent('ctx-node', 'Renamed context');
      historyManager.undo();
      expect(declarationFor('ctx-node')?.content).toBe('Original label');

      historyManager.redo();

      expect(declarationFor('ctx-node')?.content).toBe('Renamed context');
    });
  });

  describe('icon, colour and mode edits', () => {
    it('reflects an icon change to a context-declared node in contextDeclarations', () => {
      contextActions.declareAsContext('ctx-node', 'star', undefined, 'collaborate');
      expect(declarationFor('ctx-node')?.icon).toBe('star');

      contextActions.declareAsContextWithFlags('ctx-node', 'wrench', undefined, { collaborate: true, execute: false });

      expect(declarationFor('ctx-node')?.icon).toBe('wrench');
    });

    it('reflects a colour change to a context-declared node in contextDeclarations', () => {
      contextActions.declareAsContextWithFlags('ctx-node', 'star', '#ef4444', { collaborate: true, execute: false });
      expect(declarationFor('ctx-node')?.color).toBe('#ef4444');

      contextActions.declareAsContextWithFlags('ctx-node', 'star', '#10b981', { collaborate: true, execute: false });

      expect(declarationFor('ctx-node')?.color).toBe('#10b981');
    });

    it('reflects a mode change (collaborate to execute) in contextDeclarations', () => {
      contextActions.declareAsContextWithFlags('ctx-node', 'star', undefined, { collaborate: true, execute: false });
      expect(declarationFor('ctx-node')?.execute).toBe(false);

      contextActions.declareAsContextWithFlags('ctx-node', 'star', undefined, { collaborate: true, execute: true });

      expect(declarationFor('ctx-node')?.execute).toBe(true);
    });
  });

  describe('non-context nodes', () => {
    it('does not introduce a contextDeclarations entry when a non-context node is edited', () => {
      contextActions.declareAsContext('ctx-node', 'star', undefined, 'collaborate');
      const sizeBefore = state.contextDeclarations.length;

      nodeActions.updateContent('plain-node', 'Edited plain task');

      expect(state.contextDeclarations).toHaveLength(sizeBefore);
      expect(declarationFor('plain-node')).toBeUndefined();
    });
  });
});
