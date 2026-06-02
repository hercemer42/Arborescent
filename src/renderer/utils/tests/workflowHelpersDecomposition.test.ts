import { describe, it, expect } from 'vitest';
import { isDecompositionEnabled } from '../workflowHelpers';
import type { TreeNode } from '../../../shared/types';

// Regression suite for the bug where a decomposition-marked step rejects
// multi-root submissions. The defect is in decomposition resolution: the flag
// is only seen when the bound node sits at one exact depth under the workflow
// (workflow -> step -> boundNode), so any other depth silently resolves to
// false and the feedback guard collapses the step to single-root.
//
// These tests pin the depth-tolerant contract: decomposition is a property of
// the bound node's enclosing workflow step, regardless of how far the bound
// node sits below that step.
describe('isDecompositionEnabled', () => {
  // --- Baseline: the one topology that already worked ---

  it('returns true for a node directly under a decomposition-marked step', () => {
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['wf'], metadata: { isBlueprint: true } },
      'wf': { id: 'wf', content: 'WF', children: ['step'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step': { id: 'step', content: 'Step', children: ['item'], metadata: { isBlueprint: true, decomposition: true } },
      'item': { id: 'item', content: 'Item', children: [], metadata: { isBlueprint: true } },
    };
    const registry = { 'root': [], 'wf': ['root'], 'step': ['root', 'wf'], 'item': ['root', 'wf', 'step'] };

    expect(isDecompositionEnabled('item', nodes, registry)).toBe(true);
  });

  it('returns false for a node directly under a step without decomposition', () => {
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['wf'], metadata: { isBlueprint: true } },
      'wf': { id: 'wf', content: 'WF', children: ['step'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step': { id: 'step', content: 'Step', children: ['item'], metadata: { isBlueprint: true } },
      'item': { id: 'item', content: 'Item', children: [], metadata: { isBlueprint: true } },
    };
    const registry = { 'root': [], 'wf': ['root'], 'step': ['root', 'wf'], 'item': ['root', 'wf', 'step'] };

    expect(isDecompositionEnabled('item', nodes, registry)).toBe(false);
  });

  // --- Empty / null / unknown input coverage ---

  it('returns false for a node with no enclosing workflow', () => {
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['item'], metadata: { isBlueprint: true } },
      'item': { id: 'item', content: 'Item', children: [], metadata: { isBlueprint: true, decomposition: true } },
    };
    const registry = { 'root': [], 'item': ['root'] };

    expect(isDecompositionEnabled('item', nodes, registry)).toBe(false);
  });

  it('returns false for an unknown node id against empty inputs', () => {
    expect(isDecompositionEnabled('ghost', {}, {})).toBe(false);
  });

  // --- Bug reproductions: currently resolve to false, must become true ---

  // Case A: the bound node IS the decomposition step (a direct child of the
  // workflow). getWorkflowStepPosition bails the moment the parent is the
  // workflow node, so the step's own decomposition flag is never read.
  it('returns true when the bound node is itself the decomposition step (direct child of the workflow)', () => {
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['wf'], metadata: { isBlueprint: true } },
      'wf': { id: 'wf', content: 'WF', children: ['step'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step': { id: 'step', content: 'Step', children: [], metadata: { isBlueprint: true, decomposition: true } },
    };
    const registry = { 'root': [], 'wf': ['root'], 'step': ['root', 'wf'] };

    expect(isDecompositionEnabled('step', nodes, registry)).toBe(true);
  });

  // Case B: the bound node sits two or more levels below the decomposition
  // step. getWorkflowStepPosition only inspects parent/grandparent, so the
  // workflow is out of reach and the flag resolves to false.
  it('returns true for a node nested two or more levels below a decomposition step', () => {
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['wf'], metadata: { isBlueprint: true } },
      'wf': { id: 'wf', content: 'WF', children: ['step'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step': { id: 'step', content: 'Step', children: ['mid'], metadata: { isBlueprint: true, decomposition: true } },
      'mid': { id: 'mid', content: 'Mid', children: ['leaf'], metadata: { isBlueprint: true } },
      'leaf': { id: 'leaf', content: 'Leaf', children: [], metadata: { isBlueprint: true } },
    };
    const registry = {
      'root': [],
      'wf': ['root'],
      'step': ['root', 'wf'],
      'mid': ['root', 'wf', 'step'],
      'leaf': ['root', 'wf', 'step', 'mid'],
    };

    expect(isDecompositionEnabled('leaf', nodes, registry)).toBe(true);
  });

  // --- Boundary: nested workflows resolve against the nearest workflow only ---
  // Mirrors findDecompositionStepInWorkflow, which does not cross out to a
  // parent workflow. The bound node's own (inner) step is not a decomposition
  // step, so an outer decomposition step must not leak in.
  it('reads decomposition from the nearest enclosing workflow step, not an outer workflow', () => {
    const nodes: Record<string, TreeNode> = {
      'root': { id: 'root', content: 'Root', children: ['outer-wf'], metadata: { isBlueprint: true } },
      'outer-wf': { id: 'outer-wf', content: 'Outer', children: ['outer-step'], metadata: { isBlueprint: true, isWorkflow: true } },
      'outer-step': { id: 'outer-step', content: 'Outer Step', children: ['inner-wf'], metadata: { isBlueprint: true, decomposition: true } },
      'inner-wf': { id: 'inner-wf', content: 'Inner', children: ['inner-step'], metadata: { isBlueprint: true, isWorkflow: true } },
      'inner-step': { id: 'inner-step', content: 'Inner Step', children: ['item'], metadata: { isBlueprint: true } },
      'item': { id: 'item', content: 'Item', children: [], metadata: { isBlueprint: true } },
    };
    const registry = {
      'root': [],
      'outer-wf': ['root'],
      'outer-step': ['root', 'outer-wf'],
      'inner-wf': ['root', 'outer-wf', 'outer-step'],
      'inner-step': ['root', 'outer-wf', 'outer-step', 'inner-wf'],
      'item': ['root', 'outer-wf', 'outer-step', 'inner-wf', 'inner-step'],
    };

    expect(isDecompositionEnabled('item', nodes, registry)).toBe(false);
  });

  // --- Uncertain semantics: title only, body intentionally empty ---
  // Open question from technical refinement: when the bound node's own step is
  // not a decomposition step but a preceding sibling step in the same workflow
  // is, should multi-root be permitted? Decide intended semantics before
  // asserting (immediate-step only vs preceding-sibling inheritance).
  it.todo('resolves decomposition when only a preceding sibling step — not the bound node\'s own step — is marked decomposition');
});
