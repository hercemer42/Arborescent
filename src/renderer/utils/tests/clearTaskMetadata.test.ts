import { describe, it, expect } from 'vitest';
import type { NodeMetadata, TreeNode } from '@shared/types';
import { clearTaskMetadata, declareNodeMetadata } from '../clearTaskMetadata';

// `clearTaskMetadata` is the single source of truth for "this node is now
// structural (blueprint, context, or workflow) and the task-state fields
// from its previous life as a leaf no longer apply." Pure function.

describe('clearTaskMetadata', () => {
  describe('strips task-status fields', () => {
    it('removes status', () => {
      const result = clearTaskMetadata({ status: 'completed' });
      expect(result.status).toBeUndefined();
    });

    it('removes resolvedAt', () => {
      const result = clearTaskMetadata({ resolvedAt: '2026-04-19T10:00:00Z' });
      expect(result.resolvedAt).toBeUndefined();
    });

    it('removes feedbackTempFile', () => {
      const result = clearTaskMetadata({ feedbackTempFile: '/tmp/feedback-foo.arbo' });
      expect(result.feedbackTempFile).toBeUndefined();
    });

    it('removes appliedContextId', () => {
      const result = clearTaskMetadata({ appliedContextId: 'ctx-123' });
      expect(result.appliedContextId).toBeUndefined();
    });

    it('removes appliedContextIds', () => {
      const result = clearTaskMetadata({ appliedContextIds: ['ctx-a', 'ctx-b'] });
      expect(result.appliedContextIds).toBeUndefined();
    });

    it('removes activeContextId', () => {
      const result = clearTaskMetadata({ activeContextId: 'ctx-active' });
      expect(result.activeContextId).toBeUndefined();
    });

    it('removes all task fields together in a single call', () => {
      const before: NodeMetadata = {
        status: 'completed',
        resolvedAt: '2026-04-19T10:00:00Z',
        feedbackTempFile: '/tmp/foo.arbo',
        appliedContextId: 'ctx-1',
        appliedContextIds: ['ctx-1'],
        activeContextId: 'ctx-1',
      };

      const result = clearTaskMetadata(before);

      expect(result.status).toBeUndefined();
      expect(result.resolvedAt).toBeUndefined();
      expect(result.feedbackTempFile).toBeUndefined();
      expect(result.appliedContextId).toBeUndefined();
      expect(result.appliedContextIds).toBeUndefined();
      expect(result.activeContextId).toBeUndefined();
    });
  });

  describe('preserves structural and identity fields', () => {
    it('preserves created', () => {
      const result = clearTaskMetadata({ created: '2026-01-01T00:00:00Z', status: 'completed' });
      expect(result.created).toBe('2026-01-01T00:00:00Z');
    });

    it('preserves updated', () => {
      const result = clearTaskMetadata({ updated: '2026-01-15T00:00:00Z', status: 'completed' });
      expect(result.updated).toBe('2026-01-15T00:00:00Z');
    });

    it('preserves expanded', () => {
      const result = clearTaskMetadata({ expanded: false, status: 'completed' });
      expect(result.expanded).toBe(false);
    });

    it('preserves plugins map', () => {
      const plugins = { foo: { setting: 'bar' } };
      const result = clearTaskMetadata({ plugins, status: 'completed' });
      expect(result.plugins).toEqual(plugins);
    });

    it('preserves transient', () => {
      const result = clearTaskMetadata({ transient: { isCut: true }, status: 'completed' });
      expect(result.transient).toEqual({ isCut: true });
    });

    it('preserves blueprint flags being set in the same operation', () => {
      const result = clearTaskMetadata({
        isBlueprint: true,
        blueprintIcon: 'star',
        blueprintColor: 'orange',
        status: 'completed',
      });

      expect(result.isBlueprint).toBe(true);
      expect(result.blueprintIcon).toBe('star');
      expect(result.blueprintColor).toBe('orange');
    });

    it('preserves isContextDeclaration and context flags', () => {
      const result = clearTaskMetadata({
        isContextDeclaration: true,
        collaborate: true,
        execute: true,
        status: 'completed',
      });

      expect(result.isContextDeclaration).toBe(true);
      expect(result.collaborate).toBe(true);
      expect(result.execute).toBe(true);
    });

    it('preserves isWorkflow and stepType', () => {
      const result = clearTaskMetadata({
        isWorkflow: true,
        stepType: 'autonomous',
        status: 'completed',
      });

      expect(result.isWorkflow).toBe(true);
      expect(result.stepType).toBe('autonomous');
    });

    it('preserves unknown plugin-added keys (escape hatch)', () => {
      const result = clearTaskMetadata({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['my-plugin/customField' as any]: 'preserved',
        status: 'completed',
      });

      expect(result['my-plugin/customField']).toBe('preserved');
    });
  });

  describe('purity and identity', () => {
    it('does not mutate the input object', () => {
      const before: NodeMetadata = { status: 'completed', expanded: true };
      const snapshot = { ...before };

      clearTaskMetadata(before);

      expect(before).toEqual(snapshot);
    });

    it('returns a new object reference even when nothing was cleared', () => {
      const before: NodeMetadata = { expanded: true };
      const result = clearTaskMetadata(before);
      expect(result).not.toBe(before);
    });
  });

  describe('empty and edge inputs', () => {
    it('handles an empty metadata object', () => {
      const result = clearTaskMetadata({});
      expect(result).toEqual({});
    });

    it('is idempotent — running twice produces the same shape as running once', () => {
      const before: NodeMetadata = {
        status: 'completed',
        resolvedAt: '2026-04-19T10:00:00Z',
        expanded: true,
      };

      const once = clearTaskMetadata(before);
      const twice = clearTaskMetadata(once);

      expect(twice).toEqual(once);
    });

    it('does not introduce undefined fields when the source did not have them', () => {
      const result = clearTaskMetadata({ expanded: true });
      expect(Object.prototype.hasOwnProperty.call(result, 'status')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result, 'resolvedAt')).toBe(false);
    });
  });

  describe('workflow-step settings are also cleared', () => {
    it('removes decomposition', () => {
      const result = clearTaskMetadata({ decomposition: true });
      expect(result.decomposition).toBeUndefined();
    });

    it('removes recurse', () => {
      const result = clearTaskMetadata({ recurse: true });
      expect(result.recurse).toBeUndefined();
    });

    it('removes nextStepContext', () => {
      const result = clearTaskMetadata({ nextStepContext: true });
      expect(result.nextStepContext).toBeUndefined();
    });
  });
});

describe('declareNodeMetadata', () => {
  function makeNodes(metadata: NodeMetadata): Record<string, TreeNode> {
    return {
      target: { id: 'target', content: 'X', children: [], metadata },
      sibling: { id: 'sibling', content: 'Y', children: [], metadata: { status: 'completed' } },
    };
  }

  it('strips task metadata and applies the declared additions in one step', () => {
    const nodes = makeNodes({
      status: 'completed',
      resolvedAt: '2026-04-19T00:00:00Z',
      expanded: true,
    });

    const result = declareNodeMetadata(nodes, 'target', { isBlueprint: true, blueprintIcon: 'star' });

    expect(result.target.metadata.status).toBeUndefined();
    expect(result.target.metadata.resolvedAt).toBeUndefined();
    expect(result.target.metadata.expanded).toBe(true);
    expect(result.target.metadata.isBlueprint).toBe(true);
    expect(result.target.metadata.blueprintIcon).toBe('star');
  });

  it('does not touch nodes other than the target', () => {
    const nodes = makeNodes({ status: 'completed' });
    const result = declareNodeMetadata(nodes, 'target', { isBlueprint: true });
    expect(result.sibling.metadata.status).toBe('completed');
  });

  it('returns the original map unchanged when the target node id does not exist', () => {
    const nodes = makeNodes({ status: 'completed' });
    const result = declareNodeMetadata(nodes, 'does-not-exist', { isBlueprint: true });
    expect(result).toBe(nodes);
  });

  it('does not mutate the input map or the input node', () => {
    const nodes = makeNodes({ status: 'completed', expanded: true });
    const beforeTargetMeta = { ...nodes.target.metadata };

    declareNodeMetadata(nodes, 'target', { isBlueprint: true });

    expect(nodes.target.metadata).toEqual(beforeTargetMeta);
  });

  it('lets additions override structural fields when intentionally specified', () => {
    const nodes = makeNodes({ expanded: true });
    const result = declareNodeMetadata(nodes, 'target', { expanded: false, isBlueprint: true });
    expect(result.target.metadata.expanded).toBe(false);
  });
});
