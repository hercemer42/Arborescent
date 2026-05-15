import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../../shared/types';
import { migrateWorkflowStepIcons } from '../migrateWorkflowStepIcons';

function makeNode(overrides: Partial<TreeNode> & { id: string }): TreeNode {
  return {
    id: overrides.id,
    content: overrides.content ?? '',
    children: overrides.children ?? [],
    metadata: overrides.metadata ?? {},
  };
}

describe('migrateWorkflowStepIcons', () => {
  it('strips blueprintIcon and blueprintColor from a workflow step descendant', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['step-1'],
        metadata: { isWorkflow: true, isBlueprint: true, blueprintIcon: 'cog', blueprintColor: '#000' },
      }),
      'step-1': makeNode({
        id: 'step-1',
        metadata: { isBlueprint: true, blueprintIcon: 'diamond', blueprintColor: '#f00' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['step-1'].metadata.blueprintIcon).toBeUndefined();
    expect(result['step-1'].metadata.blueprintColor).toBeUndefined();
  });

  it('preserves blueprintIcon and blueprintColor on the workflow root', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['step-1'],
        metadata: { isWorkflow: true, isBlueprint: true, blueprintIcon: 'cog', blueprintColor: '#abc' },
      }),
      'step-1': makeNode({
        id: 'step-1',
        metadata: { isBlueprint: true, blueprintIcon: 'diamond' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result.workflow.metadata.blueprintIcon).toBe('cog');
    expect(result.workflow.metadata.blueprintColor).toBe('#abc');
    expect(result.workflow.metadata.isWorkflow).toBe(true);
  });

  it('strips icons from deep blueprint descendants of a workflow', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['step-1'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog' },
      }),
      'step-1': makeNode({
        id: 'step-1',
        children: ['sub-1'],
        metadata: { isBlueprint: true, blueprintIcon: 'diamond' },
      }),
      'sub-1': makeNode({
        id: 'sub-1',
        metadata: { isBlueprint: true, blueprintIcon: 'scissors' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['step-1'].metadata.blueprintIcon).toBeUndefined();
    expect(result['sub-1'].metadata.blueprintIcon).toBeUndefined();
  });

  it('preserves icons on a nested workflow root inside an outer workflow', () => {
    const input = {
      outer: makeNode({
        id: 'outer',
        children: ['inner'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog-outer' },
      }),
      inner: makeNode({
        id: 'inner',
        children: ['inner-step'],
        metadata: { isWorkflow: true, isBlueprint: true, blueprintIcon: 'cog-inner', blueprintColor: '#111' },
      }),
      'inner-step': makeNode({
        id: 'inner-step',
        metadata: { isBlueprint: true, blueprintIcon: 'diamond' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result.outer.metadata.blueprintIcon).toBe('cog-outer');
    expect(result.inner.metadata.blueprintIcon).toBe('cog-inner');
    expect(result.inner.metadata.blueprintColor).toBe('#111');
    expect(result['inner-step'].metadata.blueprintIcon).toBeUndefined();
  });

  it('leaves blueprint nodes with no workflow ancestor untouched', () => {
    const input = {
      'ctx-decl': makeNode({
        id: 'ctx-decl',
        children: ['ctx-child'],
        metadata: { isContextDeclaration: true, isBlueprint: true, blueprintIcon: 'lightbulb', blueprintColor: '#3b82f6' },
      }),
      'ctx-child': makeNode({
        id: 'ctx-child',
        metadata: { isBlueprint: true, blueprintIcon: 'star' },
      }),
      'plain-blueprint': makeNode({
        id: 'plain-blueprint',
        metadata: { isBlueprint: true, blueprintIcon: 'folder' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['ctx-decl'].metadata.blueprintIcon).toBe('lightbulb');
    expect(result['ctx-decl'].metadata.blueprintColor).toBe('#3b82f6');
    expect(result['ctx-child'].metadata.blueprintIcon).toBe('star');
    expect(result['plain-blueprint'].metadata.blueprintIcon).toBe('folder');
  });

  it('preserves all other metadata on migrated step nodes', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['step-1'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog' },
      }),
      'step-1': makeNode({
        id: 'step-1',
        metadata: {
          status: 'completed',
          isBlueprint: true,
          stepType: 'autonomous',
          blueprintIcon: 'diamond',
          blueprintColor: '#f00',
          appliedContextId: 'ctx-1',
        },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['step-1'].metadata.status).toBe('completed');
    expect(result['step-1'].metadata.isBlueprint).toBe(true);
    expect(result['step-1'].metadata.stepType).toBe('autonomous');
    expect(result['step-1'].metadata.appliedContextId).toBe('ctx-1');
    expect(result['step-1'].metadata.blueprintIcon).toBeUndefined();
    expect(result['step-1'].metadata.blueprintColor).toBeUndefined();
  });

  it('is idempotent — running twice produces the same result', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['step-1'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog' },
      }),
      'step-1': makeNode({
        id: 'step-1',
        metadata: { isBlueprint: true, blueprintIcon: 'diamond' },
      }),
    };

    const once = migrateWorkflowStepIcons(input);
    const twice = migrateWorkflowStepIcons(once);

    expect(twice).toEqual(once);
  });

  it('returns the original map reference when there is nothing to migrate', () => {
    const input = {
      'plain-blueprint': makeNode({
        id: 'plain-blueprint',
        metadata: { isBlueprint: true, blueprintIcon: 'folder' },
      }),
      'ctx-decl': makeNode({
        id: 'ctx-decl',
        metadata: { isContextDeclaration: true, isBlueprint: true, blueprintIcon: 'lightbulb' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result).toBe(input);
  });

  it('migrates only the affected nodes and copies-on-write the rest', () => {
    const workflow = makeNode({
      id: 'workflow',
      children: ['step-1'],
      metadata: { isWorkflow: true, blueprintIcon: 'cog' },
    });
    const untouched = makeNode({
      id: 'untouched',
      metadata: { isBlueprint: true, blueprintIcon: 'folder' },
    });
    const input = {
      workflow,
      'step-1': makeNode({
        id: 'step-1',
        metadata: { isBlueprint: true, blueprintIcon: 'diamond' },
      }),
      untouched,
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result.workflow).toBe(workflow);
    expect(result.untouched).toBe(untouched);
    expect(result['step-1']).not.toBe(input['step-1']);
  });

  it('handles multiple sibling workflows independently', () => {
    const input = {
      'wf-1': makeNode({
        id: 'wf-1',
        children: ['s1'],
        metadata: { isWorkflow: true, blueprintIcon: 'a' },
      }),
      s1: makeNode({
        id: 's1',
        metadata: { isBlueprint: true, blueprintIcon: 'b' },
      }),
      'wf-2': makeNode({
        id: 'wf-2',
        children: ['s2'],
        metadata: { isWorkflow: true, blueprintIcon: 'c' },
      }),
      s2: makeNode({
        id: 's2',
        metadata: { isBlueprint: true, blueprintIcon: 'd' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['wf-1'].metadata.blueprintIcon).toBe('a');
    expect(result['wf-2'].metadata.blueprintIcon).toBe('c');
    expect(result.s1.metadata.blueprintIcon).toBeUndefined();
    expect(result.s2.metadata.blueprintIcon).toBeUndefined();
  });

  it('handles empty input without error', () => {
    expect(migrateWorkflowStepIcons({})).toEqual({});
  });

  it('preserves blueprintIcon and blueprintColor on context declarations nested inside a workflow', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['ctx-decl'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog' },
      }),
      'ctx-decl': makeNode({
        id: 'ctx-decl',
        metadata: {
          isContextDeclaration: true,
          isBlueprint: true,
          blueprintIcon: 'lightbulb',
          blueprintColor: '#3b82f6',
        },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['ctx-decl'].metadata.blueprintIcon).toBe('lightbulb');
    expect(result['ctx-decl'].metadata.blueprintColor).toBe('#3b82f6');
    expect(result['ctx-decl'].metadata.isContextDeclaration).toBe(true);
  });

  it('still strips icons from non-context-declaration workflow step descendants of a context-declaration parent inside a workflow', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['ctx-decl'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog' },
      }),
      'ctx-decl': makeNode({
        id: 'ctx-decl',
        children: ['plain-step'],
        metadata: { isContextDeclaration: true, isBlueprint: true, blueprintIcon: 'lightbulb' },
      }),
      'plain-step': makeNode({
        id: 'plain-step',
        metadata: { isBlueprint: true, blueprintIcon: 'diamond' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['ctx-decl'].metadata.blueprintIcon).toBe('lightbulb');
    expect(result['plain-step'].metadata.blueprintIcon).toBeUndefined();
  });

  it('strips blueprintColor only when no blueprintIcon is set on a step', () => {
    const input = {
      workflow: makeNode({
        id: 'workflow',
        children: ['step-1'],
        metadata: { isWorkflow: true, blueprintIcon: 'cog' },
      }),
      'step-1': makeNode({
        id: 'step-1',
        metadata: { isBlueprint: true, blueprintColor: '#abc' },
      }),
    };

    const result = migrateWorkflowStepIcons(input);

    expect(result['step-1'].metadata.blueprintColor).toBeUndefined();
  });
});
