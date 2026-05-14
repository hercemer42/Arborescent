import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitNodeCommand } from '../SplitNodeCommand';
import { TreeNode } from '../../../../../shared/types';
import { AncestorRegistry } from '../../../../utils/ancestry';

describe('SplitNodeCommand — session inheritance after split', () => {
  let nodes: Record<string, TreeNode>;
  let rootNodeId: string;
  let ancestorRegistry: AncestorRegistry;
  let getState: ReturnType<typeof vi.fn>;
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rootNodeId = 'root';
    nodes = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['source'],
        metadata: {},
      },
      source: {
        id: 'source',
        content: 'User story',
        children: [],
        metadata: { status: 'pending', sessionId: 'sess-original' },
      },
    };

    ancestorRegistry = {
      root: [],
      source: ['root'],
    };

    getState = vi.fn(() => ({ nodes, rootNodeId, ancestorRegistry }));
    setState = vi.fn((partial) => {
      if (partial.nodes) nodes = partial.nodes;
      if (partial.ancestorRegistry) ancestorRegistry = partial.ancestorRegistry;
    });
    triggerAutosave = vi.fn();
  });

  describe('sibling split (createAsChild = false)', () => {
    it('new sibling inherits sessionId from the source node', () => {
      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2'].metadata.sessionId).toBe('sess-original');
    });

    it('source node retains its sessionId after the split', () => {
      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['source'].metadata.sessionId).toBe('sess-original');
    });

    it('both split descendants share the same sessionId so either can resolve to the same terminal', () => {
      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2'].metadata.sessionId).toBe(
        stateUpdate.nodes['source'].metadata.sessionId,
      );
    });
  });

  describe('child split (createAsChild = true)', () => {
    it('new child inherits sessionId from the parent source', () => {
      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
        true,
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2'].metadata.sessionId).toBe('sess-original');
    });
  });

  describe('no-regression: source without a session', () => {
    it('new node has no sessionId when source has none', () => {
      nodes['source'].metadata = { status: 'pending' };

      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2'].metadata.sessionId).toBeUndefined();
    });
  });

  describe('recursive splits (split of an already-split PR)', () => {
    it('second split propagates the inherited sessionId to the third descendant', () => {
      const first = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );
      first.execute();

      const second = new SplitNodeCommand(
        'pr2',
        'pr3',
        'story',
        'sto',
        'ry',
        3,
        getState,
        setState,
        triggerAutosave,
      );
      second.execute();

      const lastCall = setState.mock.calls[setState.mock.calls.length - 1][0];
      expect(lastCall.nodes['pr3'].metadata.sessionId).toBe('sess-original');
    });
  });

  describe('brokenChain handling on the new descendant', () => {
    it('inherits sessionId without inheriting brokenChain when source has both', () => {
      nodes['source'].metadata = {
        status: 'pending',
        sessionId: 'sess-original',
        brokenChain: true,
      };

      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2'].metadata.sessionId).toBe('sess-original');
      expect(stateUpdate.nodes['pr2'].metadata.brokenChain).toBeUndefined();
    });
  });

  describe('undo restores the pre-split ownership state', () => {
    it('removes the new node entirely on undo', () => {
      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();
      setState.mockClear();

      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2']).toBeUndefined();
    });

    it('leaves the source node sessionId unchanged after undo', () => {
      const cmd = new SplitNodeCommand(
        'source',
        'pr2',
        'User story',
        'User ',
        'story',
        5,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();
      setState.mockClear();

      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['source'].metadata.sessionId).toBe('sess-original');
    });
  });
});
