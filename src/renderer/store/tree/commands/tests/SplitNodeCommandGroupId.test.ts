import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitNodeCommand } from '../SplitNodeCommand';
import { TreeNode } from '../../../../../shared/types';
import { AncestorRegistry } from '../../../../utils/ancestry';

function readGroupId(node: TreeNode | undefined): string | undefined {
  return node?.metadata.groupId as string | undefined;
}

describe('SplitNodeCommand — groupId stamping (split is decomposition)', () => {
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
        metadata: { status: 'pending', sessionId: 'sess-source' },
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

  describe('groupId stamping on the split-produced node', () => {
    it('the new split node carries a fresh groupId (split is a decomposition)', () => {
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
      expect(readGroupId(stateUpdate.nodes['pr2'])).toBeDefined();
      expect(typeof readGroupId(stateUpdate.nodes['pr2'])).toBe('string');
    });

    it('the source node carries the same fresh groupId so the two halves are siblings in the lineage', () => {
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
      const sourceGroup = readGroupId(stateUpdate.nodes['source']);
      const newGroup = readGroupId(stateUpdate.nodes['pr2']);
      expect(sourceGroup).toBeDefined();
      expect(sourceGroup).toBe(newGroup);
    });

    it('re-splitting a node already in a group stamps a fresh different groupId on both halves', () => {
      nodes['source'].metadata = { status: 'pending', groupId: 'group-prior' };

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
      const sourceGroup = readGroupId(stateUpdate.nodes['source']);
      const newGroup = readGroupId(stateUpdate.nodes['pr2']);
      expect(sourceGroup).toBe(newGroup);
      expect(sourceGroup).not.toBe('group-prior');
    });
  });

  describe('sessionId is no longer blindly copied across a split', () => {
    it('does not copy sessionId from source onto the new split node by default', () => {
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

    it('at most one of the two halves carries a sessionId — never both', () => {
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
      const sourceHasSession = typeof stateUpdate.nodes['source'].metadata.sessionId === 'string';
      const newHasSession = typeof stateUpdate.nodes['pr2'].metadata.sessionId === 'string';
      expect(sourceHasSession && newHasSession).toBe(false);
    });
  });

  describe('child-split variant (createAsChild = true)', () => {
    it('child split also stamps a fresh groupId on both source and new child', () => {
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
      const sourceGroup = readGroupId(stateUpdate.nodes['source']);
      const childGroup = readGroupId(stateUpdate.nodes['pr2']);
      expect(sourceGroup).toBeDefined();
      expect(sourceGroup).toBe(childGroup);
    });

    it('child split does not copy sessionId from parent source onto the new child', () => {
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
      expect(stateUpdate.nodes['pr2'].metadata.sessionId).toBeUndefined();
    });
  });

  describe('undo restores the pre-split groupId state', () => {
    it('removing the split node on undo also removes the groupId stamp from the source if it was created fresh', () => {
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
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['pr2']).toBeUndefined();
      expect(readGroupId(stateUpdate.nodes['source'])).toBeUndefined();
    });

    it('undo preserves a pre-existing groupId on the source if one was already there', () => {
      nodes['source'].metadata = { status: 'pending', groupId: 'pre-existing-group' };

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
      expect(readGroupId(stateUpdate.nodes['source'])).toBe('pre-existing-group');
    });
  });
});
