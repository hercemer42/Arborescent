import { describe, it, expect } from 'vitest';
import { stripDroppedSessionFields, garbageCollectSessionRegistry } from '../sessionRegistryMigrations';
import type { TreeNode } from '@shared/types';

function makeNode(id: string, metadata: Record<string, unknown> = {}): TreeNode {
  return { id, content: '', children: [], metadata };
}

// ─── stripDroppedSessionFields ────────────────────────────────────────────────

describe('stripDroppedSessionFields', () => {
  describe('strips the five dropped fields silently', () => {
    it('removes sessionLiveness from node metadata', () => {
      const nodes = { n: makeNode('n', { sessionId: 's1', sessionLiveness: 'alive-attached' }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.sessionLiveness).toBeUndefined();
    });

    it('removes sessionTabId from node metadata', () => {
      const nodes = { n: makeNode('n', { sessionTabId: 'tab-1' }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.sessionTabId).toBeUndefined();
    });

    it('removes sessionStarting from node metadata', () => {
      const nodes = { n: makeNode('n', { sessionStarting: true }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.sessionStarting).toBeUndefined();
    });

    it('removes sessionLost from node metadata', () => {
      const nodes = { n: makeNode('n', { sessionLost: true }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.sessionLost).toBeUndefined();
    });

    it('removes sessionWorkingDirectory from node metadata', () => {
      const nodes = { n: makeNode('n', { sessionWorkingDirectory: '/Users/me/project' }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.sessionWorkingDirectory).toBeUndefined();
    });

    it('strips all five dropped fields in one pass', () => {
      const nodes = {
        n: makeNode('n', {
          sessionId: 'sess-1',
          sessionLiveness: 'alive-attached',
          sessionTabId: 'tab-1',
          sessionStarting: true,
          sessionLost: true,
          sessionWorkingDirectory: '/work',
        }),
      };
      const result = stripDroppedSessionFields(nodes);
      const meta = result['n'].metadata;
      expect(meta.sessionLiveness).toBeUndefined();
      expect(meta.sessionTabId).toBeUndefined();
      expect(meta.sessionStarting).toBeUndefined();
      expect(meta.sessionLost).toBeUndefined();
      expect(meta.sessionWorkingDirectory).toBeUndefined();
    });
  });

  describe('preserves allowed fields', () => {
    it('keeps sessionId intact', () => {
      const nodes = { n: makeNode('n', { sessionId: 'sess-1', sessionLiveness: 'lost' }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.sessionId).toBe('sess-1');
    });

    it('keeps brokenChain intact', () => {
      const nodes = { n: makeNode('n', { brokenChain: true, sessionTabId: 'tab-x' }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.brokenChain).toBe(true);
    });

    it('preserves all non-session metadata fields', () => {
      const nodes = {
        n: makeNode('n', {
          isWorkflow: true,
          stepType: 'autonomous',
          status: 'pending',
          sessionLiveness: 'lost',
        }),
      };
      const result = stripDroppedSessionFields(nodes);
      expect(result['n'].metadata.isWorkflow).toBe(true);
      expect(result['n'].metadata.stepType).toBe('autonomous');
      expect(result['n'].metadata.status).toBe('pending');
    });
  });

  describe('no-op optimization', () => {
    it('returns the same nodes reference when no dropped fields are present', () => {
      const nodes = { n: makeNode('n', { sessionId: 'sess-1', isWorkflow: true }) };
      const result = stripDroppedSessionFields(nodes);
      expect(result).toBe(nodes);
    });

    it('returns the same reference for an empty nodes object', () => {
      const nodes: Record<string, TreeNode> = {};
      expect(stripDroppedSessionFields(nodes)).toBe(nodes);
    });
  });

  describe('multi-node handling', () => {
    it('strips fields across all nodes independently', () => {
      const nodes = {
        a: makeNode('a', { sessionLiveness: 'lost', sessionId: 'sess-a' }),
        b: makeNode('b', { sessionTabId: 'tab-b' }),
        c: makeNode('c', { isWorkflow: true }),
      };
      const result = stripDroppedSessionFields(nodes);
      expect(result['a'].metadata.sessionLiveness).toBeUndefined();
      expect(result['a'].metadata.sessionId).toBe('sess-a');
      expect(result['b'].metadata.sessionTabId).toBeUndefined();
      expect(result['c'].metadata.isWorkflow).toBe(true);
    });

    it('does not mutate the original nodes', () => {
      const nodes = { n: makeNode('n', { sessionLiveness: 'alive-detached' }) };
      stripDroppedSessionFields(nodes);
      expect(nodes['n'].metadata.sessionLiveness).toBe('alive-detached');
    });
  });
});

// ─── garbageCollectSessionRegistry ───────────────────────────────────────────

describe('garbageCollectSessionRegistry', () => {
  describe('removes orphan entries', () => {
    it('drops a registry entry when no node references that sessionId', () => {
      const nodes = { n: makeNode('n', { sessionId: 'sess-live' }) };
      const registry = { 'sess-live': { cwd: '/a' }, 'sess-orphan': { cwd: '/b' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(result['sess-orphan']).toBeUndefined();
    });

    it('drops all entries when no node has a sessionId', () => {
      const nodes = { n: makeNode('n', {}) };
      const registry = { 'sess-1': { cwd: '/a' }, 'sess-2': { cwd: '/b' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('drops all entries when nodes is empty', () => {
      const registry = { 'sess-1': { cwd: '/a' } };
      const result = garbageCollectSessionRegistry({}, registry);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('keeps referenced entries', () => {
    it('keeps a registry entry that is referenced by exactly one node', () => {
      const nodes = { n: makeNode('n', { sessionId: 'sess-1' }) };
      const registry = { 'sess-1': { cwd: '/project' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(result['sess-1']).toEqual({ cwd: '/project' });
    });

    it('keeps an entry referenced by multiple nodes sharing the same sessionId', () => {
      const nodes = {
        a: makeNode('a', { sessionId: 'shared' }),
        b: makeNode('b', { sessionId: 'shared' }),
      };
      const registry = { shared: { cwd: '/shared-project' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(result['shared']).toEqual({ cwd: '/shared-project' });
    });
  });

  describe('no-op optimization', () => {
    it('returns the same registry reference when all entries are referenced', () => {
      const nodes = {
        a: makeNode('a', { sessionId: 'sess-1' }),
        b: makeNode('b', { sessionId: 'sess-2' }),
      };
      const registry = { 'sess-1': { cwd: '/a' }, 'sess-2': { cwd: '/b' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(result).toBe(registry);
    });

    it('returns the same reference when registry is empty', () => {
      const registry = {};
      const result = garbageCollectSessionRegistry({ n: makeNode('n') }, registry);
      expect(result).toBe(registry);
    });
  });

  describe('does not mutate inputs', () => {
    it('does not mutate the registry argument', () => {
      const nodes = { n: makeNode('n') };
      const registry = { 'sess-orphan': { cwd: '/x' } };
      garbageCollectSessionRegistry(nodes, registry);
      expect(registry['sess-orphan']).toEqual({ cwd: '/x' });
    });
  });

  describe('boundary inputs', () => {
    it('handles nodes whose sessionId field is undefined (not a reference)', () => {
      const nodes = { n: makeNode('n', { sessionId: undefined }) };
      const registry = { 'sess-x': { cwd: '/x' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(result['sess-x']).toBeUndefined();
    });

    it('handles nodes whose sessionId is an empty string (not a reference)', () => {
      const nodes = { n: makeNode('n', { sessionId: '' }) };
      const registry = { '': { cwd: '/empty' }, 'sess-x': { cwd: '/x' } };
      const result = garbageCollectSessionRegistry(nodes, registry);
      expect(result['']).toBeUndefined();
      expect(result['sess-x']).toBeUndefined();
    });
  });
});
