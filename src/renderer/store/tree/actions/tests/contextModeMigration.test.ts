import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createPersistenceActions } from '../persistenceActions';

describe('contextMode migration', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  let state: Record<string, unknown>;
  let mockStorage: { loadDocument: ReturnType<typeof vi.fn>; saveDocument: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    state = {
      nodes: {},
      rootNodeId: '',
      ancestorRegistry: {},
      currentFilePath: null,
      fileMeta: null,
      contextDeclarations: [],
      blueprintModeEnabled: false,
      isFileBlueprintFile: false,
      summaryDateFrom: null,
      summaryDateTo: null,
    };
    mockStorage = {
      loadDocument: vi.fn(),
      saveDocument: vi.fn(),
    };
  });

  async function loadWithNodes(nodes: Record<string, TreeNode>): Promise<Record<string, TreeNode>> {
    mockStorage.loadDocument.mockResolvedValue({
      nodes,
      rootNodeId: 'root',
      created: '2024-01-01',
      author: 'test',
    });

    const setState = (partial: Record<string, unknown>) => {
      state = { ...state, ...partial };
    };

    const actions = createPersistenceActions(
      () => state as never,
      setState as never,
      mockStorage as never,
    );
    await actions.loadFromPath('/test.arbo');

    return state.nodes as Record<string, TreeNode>;
  }

  describe('context declaration nodes', () => {
    it('should add contextMode: collaborate to context declarations missing the field', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'ctx-1': createNode('ctx-1', {
          isContextDeclaration: true,
          blueprintIcon: 'star',
          isBlueprint: true,
        }),
      });

      expect(nodes['ctx-1'].metadata.collaborate).toBe(true);
      expect(nodes['ctx-1'].metadata.execute).toBe(false);
    });

    it('should not overwrite existing flags on declarations (Both-on preserved from legacy execute)', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'ctx-1': createNode('ctx-1', {
          isContextDeclaration: true,
          blueprintIcon: 'wrench',
          isBlueprint: true,
          collaborate: true,
          execute: true,
        }),
      });

      expect(nodes['ctx-1'].metadata.collaborate).toBe(true);
      expect(nodes['ctx-1'].metadata.execute).toBe(true);
    });

    it('should migrate multiple context declarations independently', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'ctx-review': createNode('ctx-review', {
          isContextDeclaration: true,
          blueprintIcon: 'eye',
          isBlueprint: true,
        }),
        'ctx-exec': createNode('ctx-exec', {
          isContextDeclaration: true,
          blueprintIcon: 'wrench',
          isBlueprint: true,
          collaborate: true,
          execute: true,
        }),
      });

      expect(nodes['ctx-review'].metadata.collaborate).toBe(true);
      expect(nodes['ctx-review'].metadata.execute).toBe(false);
      expect(nodes['ctx-exec'].metadata.collaborate).toBe(true);
      expect(nodes['ctx-exec'].metadata.execute).toBe(true);
    });
  });

  describe('non-context nodes', () => {
    it('should not add contextMode to regular nodes', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'task': createNode('task', { status: 'pending' }),
      });

      expect(nodes['task'].metadata.contextMode).toBeUndefined();
    });

    it('should not add contextMode to blueprint nodes that are not context declarations', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'blueprint': createNode('blueprint', { isBlueprint: true }),
      });

      expect(nodes['blueprint'].metadata.contextMode).toBeUndefined();
    });
  });

  describe('appliedContextId preservation', () => {
    it('should preserve appliedContextId on nodes', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'ctx-1': createNode('ctx-1', {
          isContextDeclaration: true,
          blueprintIcon: 'star',
          isBlueprint: true,
        }),
        'task': createNode('task', { appliedContextId: 'ctx-1' }),
      });

      expect(nodes['task'].metadata.appliedContextId).toBe('ctx-1');
    });
  });

  describe('stale appliedContextIds cleanup', () => {
    it('should clean up stale appliedContextIds arrays', async () => {
      const nodes = await loadWithNodes({
        'root': createNode('root', { isBlueprint: true, isRoot: true }),
        'ctx-1': createNode('ctx-1', {
          isContextDeclaration: true,
          blueprintIcon: 'star',
          isBlueprint: true,
        }),
        'task': createNode('task', {
          appliedContextId: 'ctx-1',
          appliedContextIds: ['ctx-1'],
        }),
      });

      expect(nodes['task'].metadata.appliedContextIds).toBeUndefined();
      expect(nodes['task'].metadata.appliedContextId).toBe('ctx-1');
    });
  });
});
