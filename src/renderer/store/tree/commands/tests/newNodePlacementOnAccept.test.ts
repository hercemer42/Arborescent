import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcceptFeedbackCommand } from '../AcceptFeedbackCommand';
import { parseMarkdown } from '../../../../utils/markdown';
import { wrapNodesWithHiddenRoot } from '../../../../utils/nodeConstruction';
import { TreeNode } from '../../../../../shared/types';

function createNode(id: string, content: string, children: string[] = [], metadata: Record<string, unknown> = {}): TreeNode {
  return { id, content, children, metadata };
}

interface HarnessState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  blueprintModeEnabled: boolean;
}

function buildHarness(): {
  state: HarnessState;
  getState: () => HarnessState;
  setState: (partial: Partial<HarnessState>) => void;
  triggerAutosave: () => void;
} {
  const state: HarnessState = {
    nodes: {
      'root': createNode('root', 'Root', ['parent']),
      'parent': createNode('parent', 'Parent', ['collab-node', 'sibling']),
      'collab-node': createNode('collab-node', 'Collab root', ['orig-child-a', 'orig-child-b']),
      'orig-child-a': createNode('orig-child-a', 'Original A', []),
      'orig-child-b': createNode('orig-child-b', 'Original B', []),
      'sibling': createNode('sibling', 'Sibling', []),
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      'root': [],
      'parent': ['root'],
      'collab-node': ['root', 'parent'],
      'orig-child-a': ['root', 'parent', 'collab-node'],
      'orig-child-b': ['root', 'parent', 'collab-node'],
      'sibling': ['root', 'parent'],
    },
    blueprintModeEnabled: false,
  };

  const getState = vi.fn(() => state);
  const setState = vi.fn((partial: Partial<HarnessState>) => {
    Object.assign(state, partial);
  });
  const triggerAutosave = vi.fn();

  return { state, getState, setState, triggerAutosave };
}

describe('New node placement on accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('AcceptFeedbackCommand — single-root deep placement', () => {
    it('preserves a new grandchild under the correct existing-but-remapped parent when the feedback adds one level below an untouched branch', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const newNodes: Record<string, TreeNode> = {
        'fb-root': createNode('fb-root', 'Collab root', ['fb-a', 'fb-b']),
        'fb-a': createNode('fb-a', 'Original A', []),
        'fb-b': createNode('fb-b', 'Original B', ['fb-b-new']),
        'fb-b-new': createNode('fb-b-new', 'New grandchild under B', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'fb-root', newNodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const resultRoot = state.nodes['collab-node'];
      expect(resultRoot.children).toHaveLength(2);

      const remappedBId = resultRoot.children[1];
      const remappedB = state.nodes[remappedBId];
      expect(remappedB.content).toBe('Original B');
      expect(remappedB.children).toHaveLength(1);

      const grandchildId = remappedB.children[0];
      const grandchild = state.nodes[grandchildId];
      expect(grandchild.content).toBe('New grandchild under B');
    });

    it('places a new node under the original replacement root (not the tree root) when feedback keeps the collaborator root and adds one new child', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const newNodes: Record<string, TreeNode> = {
        'fb-root': createNode('fb-root', 'Collab root', ['fb-a', 'fb-b', 'fb-new']),
        'fb-a': createNode('fb-a', 'Original A', []),
        'fb-b': createNode('fb-b', 'Original B', []),
        'fb-new': createNode('fb-new', 'A newly added child', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'fb-root', newNodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const resultRoot = state.nodes['collab-node'];
      expect(resultRoot.children).toHaveLength(3);

      const lastChildId = resultRoot.children[2];
      expect(state.nodes[lastChildId].content).toBe('A newly added child');

      const treeRoot = state.nodes['root'];
      for (const childId of treeRoot.children) {
        expect(state.nodes[childId]?.content).not.toBe('A newly added child');
      }
    });

    it('places a new node at depth 3 under the correct intermediate parent when feedback nests it several levels deep', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const newNodes: Record<string, TreeNode> = {
        'fb-root': createNode('fb-root', 'Collab root', ['fb-a']),
        'fb-a': createNode('fb-a', 'Original A', ['fb-a-child']),
        'fb-a-child': createNode('fb-a-child', 'New depth-2 child', ['fb-a-grandchild']),
        'fb-a-grandchild': createNode('fb-a-grandchild', 'New depth-3 grandchild', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'fb-root', newNodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const resultRoot = state.nodes['collab-node'];
      const aId = resultRoot.children[0];
      const aChildId = state.nodes[aId].children[0];
      const aGrandchildId = state.nodes[aChildId].children[0];

      expect(state.nodes[aId].content).toBe('Original A');
      expect(state.nodes[aChildId].content).toBe('New depth-2 child');
      expect(state.nodes[aGrandchildId].content).toBe('New depth-3 grandchild');
    });

    it('does NOT promote a new node to the collaborator root children when its parent chain is intact in the feedback markdown');
  });

  describe('AcceptFeedbackCommand — multi-root deep placement', () => {
    it('places new nodes nested under one of several sibling roots under that sibling, not spliced at the collaborator parent', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const newNodes: Record<string, TreeNode> = {
        'story1': createNode('story1', 'Story 1', ['story1-new']),
        'story1-new': createNode('story1-new', 'Child under story 1', []),
        'story2': createNode('story2', 'Story 2', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', ['story1', 'story2'], newNodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const parentChildren = state.nodes['parent'].children;
      const newIds = parentChildren.filter((id) => id !== 'sibling');
      expect(newIds).toHaveLength(2);

      const firstStoryId = newIds[0];
      const firstStory = state.nodes[firstStoryId];
      expect(firstStory.content).toBe('Story 1');
      expect(firstStory.children).toHaveLength(1);

      const nestedChildId = firstStory.children[0];
      expect(state.nodes[nestedChildId].content).toBe('Child under story 1');
    });

    it('preserves splice order into parent.children when one multi-root contains a freshly-added subtree', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const newNodes: Record<string, TreeNode> = {
        'first': createNode('first', 'First', []),
        'second': createNode('second', 'Second', ['second-sub']),
        'second-sub': createNode('second-sub', 'New sub under Second', []),
        'third': createNode('third', 'Third', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', ['first', 'second', 'third'], newNodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const parentChildren = state.nodes['parent'].children;
      const newIds = parentChildren.filter((id) => id !== 'sibling');

      expect(state.nodes[newIds[0]].content).toBe('First');
      expect(state.nodes[newIds[1]].content).toBe('Second');
      expect(state.nodes[newIds[2]].content).toBe('Third');
      expect(state.nodes[newIds[1]].children).toHaveLength(1);
    });
  });

  describe('parseMarkdown — heading-depth invariants', () => {
    it('attaches a new heading two levels below its predecessor (# → ###) to the nearest ancestor at the right level', () => {
      const markdown = '# ☐ Root\n### ☐ Deep-jump';
      const { rootNodes, allNodes } = parseMarkdown(markdown);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].content).toBe('Root');
      expect(rootNodes[0].children).toHaveLength(1);

      const deepId = rootNodes[0].children[0];
      expect(allNodes[deepId].content).toBe('Deep-jump');
    });

    it('re-attaches consecutive same-level headings after a deeper one to the nearest ancestor at the right level', () => {
      const markdown = '# ☐ Root\n## ☐ Child A\n### ☐ Grandchild A1\n## ☐ Child B';
      const { rootNodes, allNodes } = parseMarkdown(markdown);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].children).toHaveLength(2);

      const childAId = rootNodes[0].children[0];
      const childBId = rootNodes[0].children[1];
      expect(allNodes[childAId].content).toBe('Child A');
      expect(allNodes[childBId].content).toBe('Child B');
      expect(allNodes[childAId].children).toHaveLength(1);
      expect(allNodes[childBId].children).toHaveLength(0);
    });

    it('does not shift new nodes to root when blank lines separate headings', () => {
      const markdown = '# ☐ Root\n\n## ☐ Child A\n\n### ☐ Grandchild\n\n## ☐ Child B';
      const { rootNodes, allNodes } = parseMarkdown(markdown);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].children).toHaveLength(2);

      const childAId = rootNodes[0].children[0];
      const childBId = rootNodes[0].children[1];
      expect(allNodes[childAId].content).toBe('Child A');
      expect(allNodes[childBId].content).toBe('Child B');
      expect(allNodes[childAId].children).toHaveLength(1);
    });

    it('places a sibling heading inserted after a deeper subtree at the right level, not as a descendant of the deeper branch', () => {
      const markdown = [
        '# ☐ Root',
        '## ☐ Child A',
        '### ☐ Grandchild A1',
        '#### ☐ Great-grandchild',
        '## ☐ New sibling of A',
      ].join('\n');
      const { rootNodes, allNodes } = parseMarkdown(markdown);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].children).toHaveLength(2);

      const siblingId = rootNodes[0].children[1];
      expect(allNodes[siblingId].content).toBe('New sibling of A');
      expect(allNodes[siblingId].children).toHaveLength(0);
    });
  });

  describe('End-to-end — parseMarkdown into AcceptFeedbackCommand', () => {
    function runFromMarkdown(markdown: string) {
      const { rootNodes, allNodes } = parseMarkdown(markdown);
      const rootIds = rootNodes.map(n => n.id);
      const { nodes, rootNodeId } = wrapNodesWithHiddenRoot(allNodes, rootIds, 'hidden-root');
      const hiddenRoot = nodes[rootNodeId];
      const extractedRootIds = hiddenRoot.children;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { 'hidden-root': _hidden, ...contentNodes } = nodes;
      return { rootNodeId: extractedRootIds[0], rootNodeIds: extractedRootIds, nodes: contentNodes };
    }

    it('places a new grandchild under the correct intermediate parent when the full pipeline runs on realistic markdown', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const markdown = [
        '# ☐ Collab root',
        '## ☐ Original A',
        '## ☐ Original B',
        '### ☐ Freshly added grandchild under B',
      ].join('\n');

      const { rootNodeId, nodes } = runFromMarkdown(markdown);

      const command = new AcceptFeedbackCommand(
        'collab-node', rootNodeId, nodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const resultRoot = state.nodes['collab-node'];
      expect(resultRoot.children).toHaveLength(2);

      const bId = resultRoot.children[1];
      const b = state.nodes[bId];
      expect(b.content).toBe('Original B');
      expect(b.children).toHaveLength(1);

      const grandchildId = b.children[0];
      expect(state.nodes[grandchildId].content).toBe('Freshly added grandchild under B');
    });

    it('does not promote a deeply-nested new node to be the first child of the collaborator root', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const markdown = [
        '# ☐ Collab root',
        '## ☐ Original A',
        '## ☐ Original B',
        '### ☐ Original grandchild B1',
        '#### ☐ Deeply nested new node',
      ].join('\n');

      const { rootNodeId, nodes } = runFromMarkdown(markdown);

      const command = new AcceptFeedbackCommand(
        'collab-node', rootNodeId, nodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const resultRoot = state.nodes['collab-node'];

      const firstChildId = resultRoot.children[0];
      expect(state.nodes[firstChildId].content).not.toBe('Deeply nested new node');

      const bId = resultRoot.children[1];
      const b1Id = state.nodes[bId].children[0];
      const deepId = state.nodes[b1Id].children[0];
      expect(state.nodes[deepId].content).toBe('Deeply nested new node');
    });
  });

  describe('Edge cases', () => {
    it('treats single-root feedback with zero new nodes as a no-op for placement (regression guard)', () => {
      const { state, getState, setState, triggerAutosave } = buildHarness();

      const newNodes: Record<string, TreeNode> = {
        'fb-root': createNode('fb-root', 'Collab root', ['fb-a', 'fb-b']),
        'fb-a': createNode('fb-a', 'Original A', []),
        'fb-b': createNode('fb-b', 'Original B', []),
      };

      const command = new AcceptFeedbackCommand(
        'collab-node', 'fb-root', newNodes,
        getState, setState, triggerAutosave,
      );
      command.execute();

      const resultRoot = state.nodes['collab-node'];
      expect(resultRoot.children).toHaveLength(2);
      expect(state.nodes[resultRoot.children[0]].content).toBe('Original A');
      expect(state.nodes[resultRoot.children[1]].content).toBe('Original B');

      const parent = state.nodes['parent'];
      expect(parent.children).toEqual(['collab-node', 'sibling']);
    });

    it('handles feedback containing only a new node (no existing tree content echoed back)');

    it('does not interleave placements when concurrent accept calls run on the same file');
  });
});
