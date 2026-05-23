import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TreeNode } from '@shared/types';

import { bindSessionToNode } from '../bindSessionToNode';

type NodeMap = Record<string, TreeNode>;

function makeNode(id: string, metadata: Record<string, unknown> = {}): TreeNode {
  return { id, content: id, children: [], metadata };
}

describe('bindSessionToNode — centralized sessionId write helper', () => {
  let nodes: NodeMap;
  let setState: ReturnType<typeof vi.fn>;
  let getState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      'node-a': makeNode('node-a'),
      'node-b': makeNode('node-b'),
      'node-c': makeNode('node-c'),
    };
    setState = vi.fn((partial: { nodes?: NodeMap }) => {
      if (partial.nodes) nodes = partial.nodes;
    });
    getState = vi.fn(() => ({ nodes }));
  });

  describe('stamping sessionId on the target node', () => {
    it('writes sessionId onto the target node when no other node carries it', () => {
      bindSessionToNode('sess-X', 'node-a', getState, setState);
      expect(nodes['node-a'].metadata.sessionId).toBe('sess-X');
    });

    it('does not modify unrelated nodes', () => {
      bindSessionToNode('sess-X', 'node-a', getState, setState);
      expect(nodes['node-b'].metadata.sessionId).toBeUndefined();
      expect(nodes['node-c'].metadata.sessionId).toBeUndefined();
    });

    it('no-op when target node id does not exist — does not crash, does not stamp anything', () => {
      bindSessionToNode('sess-X', 'does-not-exist', getState, setState);
      for (const node of Object.values(nodes)) {
        expect(node.metadata.sessionId).toBeUndefined();
      }
    });
  });

  describe('atomic clear of any prior holder of the same sessionId', () => {
    it('clears sessionId from a different node that previously held it', () => {
      nodes['node-b'].metadata.sessionId = 'sess-X';

      bindSessionToNode('sess-X', 'node-a', getState, setState);

      expect(nodes['node-a'].metadata.sessionId).toBe('sess-X');
      expect(nodes['node-b'].metadata.sessionId).toBeUndefined();
    });

    it('clear and stamp happen in a single setState call (no intermediate state where two nodes share sessionId)', () => {
      nodes['node-b'].metadata.sessionId = 'sess-X';

      bindSessionToNode('sess-X', 'node-a', getState, setState);

      expect(setState).toHaveBeenCalledTimes(1);
      const partial = setState.mock.calls[0][0];
      expect(partial.nodes['node-a'].metadata.sessionId).toBe('sess-X');
      expect(partial.nodes['node-b'].metadata.sessionId).toBeUndefined();
    });

    it('clears stale stamps from multiple nodes that all carried the same sessionId (legacy file recovery)', () => {
      nodes['node-b'].metadata.sessionId = 'sess-X';
      nodes['node-c'].metadata.sessionId = 'sess-X';

      bindSessionToNode('sess-X', 'node-a', getState, setState);

      expect(nodes['node-a'].metadata.sessionId).toBe('sess-X');
      expect(nodes['node-b'].metadata.sessionId).toBeUndefined();
      expect(nodes['node-c'].metadata.sessionId).toBeUndefined();
    });

    it('does not touch nodes holding a different sessionId', () => {
      nodes['node-b'].metadata.sessionId = 'sess-other';

      bindSessionToNode('sess-X', 'node-a', getState, setState);

      expect(nodes['node-a'].metadata.sessionId).toBe('sess-X');
      expect(nodes['node-b'].metadata.sessionId).toBe('sess-other');
    });
  });

  describe('idempotence', () => {
    it('binding to the same node twice leaves it as the sole holder — no flicker', () => {
      bindSessionToNode('sess-X', 'node-a', getState, setState);
      bindSessionToNode('sess-X', 'node-a', getState, setState);

      expect(nodes['node-a'].metadata.sessionId).toBe('sess-X');
      const otherHolders = Object.values(nodes).filter(
        (n) => n.id !== 'node-a' && n.metadata.sessionId === 'sess-X',
      );
      expect(otherHolders).toEqual([]);
    });
  });

  describe('groupId is left untouched on the cleared node', () => {
    it('rebinding clears only sessionId on the prior holder — groupId stays', () => {
      nodes['node-b'].metadata.sessionId = 'sess-X';
      (nodes['node-b'].metadata as Record<string, unknown>).groupId = 'group-1';

      bindSessionToNode('sess-X', 'node-a', getState, setState);

      expect(nodes['node-b'].metadata.sessionId).toBeUndefined();
      expect((nodes['node-b'].metadata as Record<string, unknown>).groupId).toBe('group-1');
    });
  });

  describe('boundary inputs', () => {
    it('empty sessionId string is rejected — no node gets stamped', () => {
      bindSessionToNode('', 'node-a', getState, setState);
      expect(nodes['node-a'].metadata.sessionId).toBeUndefined();
    });

    it('whitespace-only sessionId is rejected — no node gets stamped, no prior holder cleared', () => {
      nodes['node-b'].metadata.sessionId = 'sess-X';
      bindSessionToNode('   ', 'node-a', getState, setState);
      expect(nodes['node-a'].metadata.sessionId).toBeUndefined();
      expect(nodes['node-b'].metadata.sessionId).toBe('sess-X');
    });

    it('empty nodeId is rejected — no node gets stamped, no prior holder cleared', () => {
      nodes['node-b'].metadata.sessionId = 'sess-X';
      bindSessionToNode('sess-X', '', getState, setState);
      expect(nodes['node-b'].metadata.sessionId).toBe('sess-X');
    });
  });
});
