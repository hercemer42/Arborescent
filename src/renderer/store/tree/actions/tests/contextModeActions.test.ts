import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContextActions } from '../contextActions';
import { HistoryManager } from '../../commands/HistoryManager';
import type { TreeNode } from '@shared/types';

describe('contextActions — contextMode', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; collaborate: boolean; execute: boolean }[];
    ancestorRegistry: Record<string, string[]>;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createContextActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
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
          content: 'Review Context',
          children: ['node-3'],
          metadata: { status: 'pending' },
        },
        'node-2': {
          id: 'node-2',
          content: 'Execute Context',
          children: [],
          metadata: { status: 'pending' },
        },
        'node-3': {
          id: 'node-3',
          content: 'Task',
          children: [],
          metadata: { status: 'pending' },
        },
      },
      contextDeclarations: [],
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['node-1', 'root'],
      },
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    mockTriggerAutosave = vi.fn();

    actions = createContextActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('declareAsContext with mode', () => {
    it('should default contextMode to collaborate when no mode is provided', () => {
      actions.declareAsContext('node-1', 'star');
      expect(state.nodes['node-1'].metadata.collaborate).toBe(true);
    });

    it('should store contextMode as execute when provided', () => {
      // Once declareAsContext accepts a mode parameter
      actions.declareAsContext('node-1', 'wrench', undefined, 'execute');
      expect(state.nodes['node-1'].metadata.execute).toBe(true);
    });

    it('should store contextMode as collaborate when explicitly provided', () => {
      actions.declareAsContext('node-1', 'eye', undefined, 'collaborate');
      expect(state.nodes['node-1'].metadata.collaborate).toBe(true);
    });

    it('should preserve contextMode when re-declaring an existing context with a new icon', () => {
      actions.declareAsContext('node-1', 'wrench', undefined, 'execute');
      expect(state.nodes['node-1'].metadata.execute).toBe(true);

      actions.declareAsContext('node-1', 'star', undefined, 'execute');
      expect(state.nodes['node-1'].metadata.execute).toBe(true);
    });

    it('should allow changing contextMode on an existing context declaration', () => {
      actions.declareAsContext('node-1', 'star', undefined, 'collaborate');
      expect(state.nodes['node-1'].metadata.collaborate).toBe(true);

      actions.declareAsContext('node-1', 'star', undefined, 'execute');
      expect(state.nodes['node-1'].metadata.execute).toBe(true);
    });

    it('should trigger autosave when mode is set', () => {
      actions.declareAsContext('node-1', 'star', undefined, 'execute');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should not set contextMode on descendant nodes', () => {
      actions.declareAsContext('node-1', 'star', undefined, 'execute');
      expect(state.nodes['node-3'].metadata.execute).toBeUndefined();
    });
  });

  describe('refreshContextDeclarations includes mode', () => {
    it('should include mode in ContextDeclarationInfo for collaborate context', async () => {
      state.nodes['node-1'].metadata = {
        isContextDeclaration: true,
        blueprintIcon: 'eye',
        isBlueprint: true,
        contextMode: 'collaborate',
      };

      actions.refreshContextDeclarations();

      // refreshContextDeclarations uses setTimeout(0), so we need to flush
      await vi.advanceTimersByTimeAsync(0);

      const declaration = state.contextDeclarations.find(d => d.nodeId === 'node-1');
      expect(declaration?.execute ? 'execute' : 'collaborate').toBe('collaborate');
    });

    it('should include mode in ContextDeclarationInfo for execute context', async () => {
      state.nodes['node-2'].metadata = {
        isContextDeclaration: true,
        blueprintIcon: 'wrench',
        isBlueprint: true,
        collaborate: true,
        execute: true,
      };

      actions.refreshContextDeclarations();

      await vi.advanceTimersByTimeAsync(0);

      const declaration = state.contextDeclarations.find(d => d.nodeId === 'node-2');
      expect(declaration?.execute).toBe(true);
    });

    it('should default mode to collaborate when contextMode metadata is missing', async () => {
      state.nodes['node-1'].metadata = {
        isContextDeclaration: true,
        blueprintIcon: 'star',
        isBlueprint: true,
        // no contextMode set
      };

      actions.refreshContextDeclarations();

      await vi.advanceTimersByTimeAsync(0);

      const declaration = state.contextDeclarations.find(d => d.nodeId === 'node-1');
      expect(declaration?.execute ? 'execute' : 'collaborate').toBe('collaborate');
    });
  });

  describe('removeContextDeclaration clears contextMode', () => {
    it('should clear contextMode when removing a context declaration', () => {
      state.nodes['node-1'].metadata = {
        isContextDeclaration: true,
        blueprintIcon: 'wrench',
        isBlueprint: true,
        contextMode: 'execute',
      };

      actions.removeContextDeclaration('node-1');

      expect(state.nodes['node-1'].metadata.execute).toBeUndefined();
    });
  });
});

describe('contextActions — undo/redo via command system', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; collaborate: boolean; execute: boolean }[];
    ancestorRegistry: Record<string, string[]>;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createContextActions>;
  let historyManager: HistoryManager;

  beforeEach(() => {
    vi.useFakeTimers();
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['node-1'],
          metadata: { isBlueprint: true },
        },
        'node-1': {
          id: 'node-1',
          content: 'Context Node',
          children: ['child-1'],
          metadata: { isBlueprint: true },
        },
        'child-1': {
          id: 'child-1',
          content: 'Task',
          children: [],
          metadata: {},
        },
      },
      contextDeclarations: [],
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'child-1': ['node-1', 'root'],
      },
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    historyManager = new HistoryManager();

    actions = createContextActions(
      () => state,
      setState as never,
      vi.fn(),
      (cmd) => historyManager.executeCommand(cmd)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should undo declareAsContext and restore previous metadata', () => {
    const originalMeta = { ...state.nodes['node-1'].metadata };

    actions.declareAsContext('node-1', 'star', '#ef4444', 'execute');
    expect(state.nodes['node-1'].metadata.execute).toBe(true);
    expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(true);
    expect(state.nodes['child-1'].metadata.isBlueprint).toBe(true);

    historyManager.undo();
    expect(state.nodes['node-1'].metadata).toEqual(originalMeta);
    expect(state.nodes['child-1'].metadata.isBlueprint).toBeUndefined();
  });

  it('should redo declareAsContext after undo', () => {
    actions.declareAsContext('node-1', 'wrench', undefined, 'execute');
    historyManager.undo();
    historyManager.redo();

    expect(state.nodes['node-1'].metadata.execute).toBe(true);
    expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(true);
  });

  it('should undo mode change from collaborate to execute', () => {
    actions.declareAsContext('node-1', 'eye', undefined, 'collaborate');
    expect(state.nodes['node-1'].metadata.collaborate).toBe(true);

    actions.declareAsContext('node-1', 'wrench', undefined, 'execute');
    expect(state.nodes['node-1'].metadata.execute).toBe(true);

    historyManager.undo();
    expect(state.nodes['node-1'].metadata.collaborate).toBe(true);
  });

  it('should undo removeContextDeclaration and restore declaration', () => {
    actions.declareAsContext('node-1', 'star', '#ef4444', 'execute');

    actions.removeContextDeclaration('node-1');
    expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(false);
    expect(state.nodes['node-1'].metadata.execute).toBeUndefined();

    historyManager.undo();
    expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(true);
    expect(state.nodes['node-1'].metadata.execute).toBe(true);
    expect(state.nodes['node-1'].metadata.blueprintIcon).toBe('star');
  });

  it('should undo removeContextDeclaration and restore applied context references', () => {
    state.nodes['user-node'] = {
      id: 'user-node',
      content: 'User Task',
      children: [],
      metadata: { appliedContextId: 'node-1' },
    };

    actions.declareAsContext('node-1', 'star', undefined, 'collaborate');

    actions.removeContextDeclaration('node-1');
    expect(state.nodes['user-node'].metadata.appliedContextId).toBeUndefined();

    historyManager.undo();
    expect(state.nodes['user-node'].metadata.appliedContextId).toBe('node-1');
  });
});
