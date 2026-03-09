import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoveContextCommand } from '../RemoveContextCommand';
import type { TreeNode } from '@shared/types';

describe('RemoveContextCommand', () => {
  let nodes: Record<string, TreeNode>;
  let ancestorRegistry: Record<string, string[]>;
  let setNodes: (n: Record<string, TreeNode>) => void;
  let triggerAutosave: ReturnType<typeof vi.fn>;
  let refreshContextDeclarations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['ctx-node'],
        metadata: { isBlueprint: true, isRoot: true },
      },
      'ctx-node': {
        id: 'ctx-node',
        content: 'Context',
        children: ['child-1'],
        metadata: {
          isBlueprint: true,
          isContextDeclaration: true,
          blueprintIcon: 'star',
          blueprintColor: '#ef4444',
          contextMode: 'execute',
        },
      },
      'child-1': {
        id: 'child-1',
        content: 'Task',
        children: [],
        metadata: { isBlueprint: true },
      },
      'user-node': {
        id: 'user-node',
        content: 'User Task',
        children: [],
        metadata: { appliedContextId: 'ctx-node' },
      },
    };

    ancestorRegistry = {
      'root': [],
      'ctx-node': ['root'],
      'child-1': ['ctx-node', 'root'],
      'user-node': [],
    };

    setNodes = (updated) => { nodes = updated; };
    triggerAutosave = vi.fn();
    refreshContextDeclarations = vi.fn();
  });

  function createCommand(nodeId = 'ctx-node') {
    return new RemoveContextCommand(
      nodeId,
      () => nodes,
      () => ancestorRegistry,
      setNodes,
      triggerAutosave,
      refreshContextDeclarations
    );
  }

  it('should clear context declaration metadata on execute', () => {
    const cmd = createCommand();
    cmd.execute();

    expect(nodes['ctx-node'].metadata.isContextDeclaration).toBe(false);
    expect(nodes['ctx-node'].metadata.blueprintIcon).toBeUndefined();
    expect(nodes['ctx-node'].metadata.blueprintColor).toBeUndefined();
    expect(nodes['ctx-node'].metadata.contextMode).toBeUndefined();
  });

  it('should remove isBlueprint from node and descendants when no ancestor context', () => {
    const cmd = createCommand();
    cmd.execute();

    expect(nodes['ctx-node'].metadata.isBlueprint).toBe(false);
    expect(nodes['child-1'].metadata.isBlueprint).toBe(false);
  });

  it('should keep isBlueprint when node has ancestor context', () => {
    nodes['parent-ctx'] = {
      id: 'parent-ctx',
      content: 'Parent Context',
      children: ['ctx-node'],
      metadata: { isBlueprint: true, isContextDeclaration: true },
    };
    ancestorRegistry['ctx-node'] = ['parent-ctx', 'root'];

    const cmd = createCommand();
    cmd.execute();

    expect(nodes['ctx-node'].metadata.isContextDeclaration).toBe(false);
    expect(nodes['ctx-node'].metadata.isBlueprint).toBe(true);
  });

  it('should clean up appliedContextId references on other nodes', () => {
    const cmd = createCommand();
    cmd.execute();

    expect(nodes['user-node'].metadata.appliedContextId).toBeUndefined();
  });

  it('should restore all metadata on undo', () => {
    const originalCtxMeta = { ...nodes['ctx-node'].metadata };
    const originalChildMeta = { ...nodes['child-1'].metadata };
    const originalUserMeta = { ...nodes['user-node'].metadata };

    const cmd = createCommand();
    cmd.execute();

    expect(nodes['ctx-node'].metadata.isContextDeclaration).toBe(false);

    cmd.undo();

    expect(nodes['ctx-node'].metadata).toEqual(originalCtxMeta);
    expect(nodes['child-1'].metadata).toEqual(originalChildMeta);
    expect(nodes['user-node'].metadata).toEqual(originalUserMeta);
  });

  it('should restore contextMode on undo', () => {
    const cmd = createCommand();
    cmd.execute();
    expect(nodes['ctx-node'].metadata.contextMode).toBeUndefined();

    cmd.undo();
    expect(nodes['ctx-node'].metadata.contextMode).toBe('execute');
  });

  it('should re-apply removal on redo', () => {
    const cmd = createCommand();
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(nodes['ctx-node'].metadata.isContextDeclaration).toBe(false);
    expect(nodes['ctx-node'].metadata.contextMode).toBeUndefined();
    expect(nodes['user-node'].metadata.appliedContextId).toBeUndefined();
  });

  it('should call triggerAutosave on execute and undo', () => {
    const cmd = createCommand();
    cmd.execute();
    expect(triggerAutosave).toHaveBeenCalledTimes(1);

    cmd.undo();
    expect(triggerAutosave).toHaveBeenCalledTimes(2);
  });

  it('should call refreshContextDeclarations on execute and undo', () => {
    const cmd = createCommand();
    cmd.execute();
    expect(refreshContextDeclarations).toHaveBeenCalledTimes(1);

    cmd.undo();
    expect(refreshContextDeclarations).toHaveBeenCalledTimes(2);
  });
});
