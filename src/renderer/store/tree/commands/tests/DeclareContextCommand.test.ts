import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeclareContextCommand } from '../DeclareContextCommand';
import type { TreeNode } from '@shared/types';

describe('DeclareContextCommand', () => {
  let nodes: Record<string, TreeNode>;
  let setNodes: (n: Record<string, TreeNode>) => void;
  let triggerAutosave: ReturnType<typeof vi.fn>;
  let refreshContextDeclarations: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['candidate'],
        metadata: { isBlueprint: true, isRoot: true },
      },
      'candidate': {
        id: 'candidate',
        content: 'Review Context',
        children: ['child-1', 'child-2'],
        metadata: { isBlueprint: true },
      },
      'child-1': {
        id: 'child-1',
        content: 'Task 1',
        children: [],
        metadata: {},
      },
      'child-2': {
        id: 'child-2',
        content: 'Task 2',
        children: [],
        metadata: {},
      },
    };

    setNodes = (updated) => { nodes = updated; };
    triggerAutosave = vi.fn();
    refreshContextDeclarations = vi.fn();
  });

  function createCommand(
    nodeId = 'candidate',
    icon = 'star',
    color: string | undefined = undefined,
    mode: 'collaborate' | 'execute' = 'collaborate'
  ) {
    return new DeclareContextCommand(
      nodeId, icon, color, mode,
      () => nodes, setNodes,
      triggerAutosave, refreshContextDeclarations
    );
  }

  it('should set context declaration metadata on execute', () => {
    const cmd = createCommand('candidate', 'eye', '#0ea5e9', 'collaborate');
    cmd.execute();

    expect(nodes['candidate'].metadata.isContextDeclaration).toBe(true);
    expect(nodes['candidate'].metadata.blueprintIcon).toBe('eye');
    expect(nodes['candidate'].metadata.blueprintColor).toBe('#0ea5e9');
    expect(nodes['candidate'].metadata.contextMode).toBe('collaborate');
    expect(nodes['candidate'].metadata.isBlueprint).toBe(true);
  });

  it('should set execute mode when specified', () => {
    const cmd = createCommand('candidate', 'wrench', undefined, 'execute');
    cmd.execute();

    expect(nodes['candidate'].metadata.contextMode).toBe('execute');
  });

  it('should mark descendants as blueprints', () => {
    const cmd = createCommand();
    cmd.execute();

    expect(nodes['child-1'].metadata.isBlueprint).toBe(true);
    expect(nodes['child-2'].metadata.isBlueprint).toBe(true);
  });

  it('should not mark descendants of nested context declarations', () => {
    nodes['child-1'].metadata.isContextDeclaration = true;
    nodes['child-1'].children = ['nested-child'];
    nodes['nested-child'] = {
      id: 'nested-child',
      content: 'Nested',
      children: [],
      metadata: {},
    };

    const cmd = createCommand();
    cmd.execute();

    expect(nodes['child-2'].metadata.isBlueprint).toBe(true);
    expect(nodes['nested-child'].metadata.isBlueprint).toBeUndefined();
  });

  it('should restore original state on undo', () => {
    const originalChild1Meta = { ...nodes['child-1'].metadata };
    const originalCandidateMeta = { ...nodes['candidate'].metadata };

    const cmd = createCommand('candidate', 'eye', '#ef4444', 'execute');
    cmd.execute();

    expect(nodes['candidate'].metadata.contextMode).toBe('execute');
    expect(nodes['child-1'].metadata.isBlueprint).toBe(true);

    cmd.undo();

    expect(nodes['candidate'].metadata).toEqual(originalCandidateMeta);
    expect(nodes['child-1'].metadata).toEqual(originalChild1Meta);
  });

  it('should restore mode on undo when changing from collaborate to execute', () => {
    nodes['candidate'].metadata = {
      ...nodes['candidate'].metadata,
      isContextDeclaration: true,
      blueprintIcon: 'eye',
      contextMode: 'collaborate',
    };

    const cmd = createCommand('candidate', 'wrench', undefined, 'execute');
    cmd.execute();
    expect(nodes['candidate'].metadata.contextMode).toBe('execute');

    cmd.undo();
    expect(nodes['candidate'].metadata.contextMode).toBe('collaborate');
  });

  it('should re-apply on redo', () => {
    const cmd = createCommand('candidate', 'eye', undefined, 'execute');
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(nodes['candidate'].metadata.isContextDeclaration).toBe(true);
    expect(nodes['candidate'].metadata.contextMode).toBe('execute');
    expect(nodes['child-1'].metadata.isBlueprint).toBe(true);
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
