import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFeedbackContent,
  parseFeedbackContentWithReason,
  initializeFeedbackStore,
  findCollaboratingNode,
  extractFeedbackContent,
} from '../feedbackService';
import { TreeNode } from '../../../../shared/types';

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/markdown', () => ({
  parseMarkdown: vi.fn(),
}));

vi.mock('../../../utils/nodeHelpers', () => ({
  wrapNodesWithHiddenRoot: vi.fn(),
}));

const { mockFeedbackTreeStore } = vi.hoisted(() => ({
  mockFeedbackTreeStore: {
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    getStoreForFile: vi.fn(),
    clearFile: vi.fn(),
  },
}));

vi.mock('../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: mockFeedbackTreeStore,
}));

describe('feedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFeedbackContent', () => {
    it('should return null for invalid markdown', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new Error('Invalid markdown');
      });

      const result = parseFeedbackContent('invalid content');
      expect(result).toBeNull();
    });

    it('should return null when no root nodes', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockReturnValue({ rootNodes: [], allNodes: {} });

      const result = parseFeedbackContent('# No valid nodes');
      expect(result).toBeNull();
    });

    it('should return null when multiple root nodes', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [{ id: 'node1', content: '', children: [], metadata: {} }, { id: 'node2', content: '', children: [], metadata: {} }],
        allNodes: {},
      });

      const result = parseFeedbackContent('# Node 1\n# Node 2');
      expect(result).toBeNull();
    });

    it('should return parsed content when exactly one root node', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      const mockNodes = {
        'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
      };
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [{ id: 'node1', content: 'Test', children: [], metadata: {} }],
        allNodes: mockNodes,
      });

      const result = parseFeedbackContent('# Test');
      expect(result).toEqual({
        nodes: mockNodes,
        rootNodeId: 'node1',
        rootNodeIds: ['node1'],
        nodeCount: 1,
      });
    });

    describe('with decomposition enabled', () => {
      it('should accept content with multiple root nodes', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const mockNodes = {
          'node1': { id: 'node1', content: 'Story 1', children: [], metadata: {} },
          'node2': { id: 'node2', content: 'Story 2', children: [], metadata: {} },
          'node3': { id: 'node3', content: 'Story 3', children: [], metadata: {} },
        };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [
            { id: 'node1', content: 'Story 1', children: [], metadata: {} },
            { id: 'node2', content: 'Story 2', children: [], metadata: {} },
            { id: 'node3', content: 'Story 3', children: [], metadata: {} },
          ],
          allNodes: mockNodes,
        });

        const result = parseFeedbackContent('# Story 1\n# Story 2\n# Story 3', true);
        expect(result).not.toBeNull();
        expect(result!.rootNodeIds).toEqual(['node1', 'node2', 'node3']);
        expect(result!.nodeCount).toBe(3);
      });

      it('should accept content with a single root node', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const mockNodes = {
          'node1': { id: 'node1', content: 'Single', children: [], metadata: {} },
        };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [{ id: 'node1', content: 'Single', children: [], metadata: {} }],
          allNodes: mockNodes,
        });

        const result = parseFeedbackContent('# Single', true);
        expect(result).not.toBeNull();
        expect(result!.rootNodeIds).toEqual(['node1']);
      });

      it('should reject content with zero root nodes', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        vi.mocked(parseMarkdown).mockReturnValue({ rootNodes: [], allNodes: {} });

        const result = parseFeedbackContent('no headings', true);
        expect(result).toBeNull();
      });

      it('should return rootNodeIds in document order', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [
            { id: 'first', content: 'First', children: [], metadata: {} },
            { id: 'second', content: 'Second', children: [], metadata: {} },
          ],
          allNodes: {
            'first': { id: 'first', content: 'First', children: [], metadata: {} },
            'second': { id: 'second', content: 'Second', children: [], metadata: {} },
          },
        });

        const result = parseFeedbackContent('# First\n# Second', true);
        expect(result!.rootNodeIds[0]).toBe('first');
        expect(result!.rootNodeIds[1]).toBe('second');
      });
    });

    describe('execute mode output compatibility', () => {
      it('parses single-root markdown with items marked [x]', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const mockNodes = {
          'node1': { id: 'node1', content: '[x] Completed task', children: ['node2'], metadata: {} },
          'node2': { id: 'node2', content: '[ ] Pending task', children: [], metadata: {} },
        };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [mockNodes['node1']],
          allNodes: mockNodes,
        });

        const result = parseFeedbackContent('# [x] Completed task\n## [ ] Pending task');
        expect(result).not.toBeNull();
        expect(result!.nodeCount).toBe(2);
      });

      it('parses single-root markdown with items marked [-]', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const mockNodes = {
          'node1': { id: 'node1', content: '[-] Failed task', children: [], metadata: {} },
        };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [mockNodes['node1']],
          allNodes: mockNodes,
        });

        const result = parseFeedbackContent('# [-] Failed task');
        expect(result).not.toBeNull();
      });

      it('parses single-root markdown with mixed [ ], [x], and [-] markers', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const mockNodes = {
          'node1': { id: 'node1', content: '[ ] Root task', children: ['node2', 'node3', 'node4'], metadata: {} },
          'node2': { id: 'node2', content: '[x] Done', children: [], metadata: {} },
          'node3': { id: 'node3', content: '[-] Failed', children: [], metadata: {} },
          'node4': { id: 'node4', content: '[ ] Pending', children: [], metadata: {} },
        };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [mockNodes['node1']],
          allNodes: mockNodes,
        });

        const result = parseFeedbackContent('# [ ] Root task\n## [x] Done\n## [-] Failed\n## [ ] Pending');
        expect(result).not.toBeNull();
        expect(result!.nodeCount).toBe(4);
      });

      it('parses execute mode output with trailing issues child node', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const mockNodes = {
          'node1': { id: 'node1', content: '[ ] My task', children: ['node2', 'node3'], metadata: {} },
          'node2': { id: 'node2', content: '[x] Step one', children: [], metadata: {} },
          'node3': { id: 'node3', content: '[ ] Issues', children: ['node4'], metadata: {} },
          'node4': { id: 'node4', content: 'Could not find file', children: [], metadata: {} },
        };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [mockNodes['node1']],
          allNodes: mockNodes,
        });

        const result = parseFeedbackContent('# [ ] My task\n## [x] Step one\n## [ ] Issues\n### Could not find file');
        expect(result).not.toBeNull();
        expect(result!.nodeCount).toBe(4);
      });
    });

    describe('blob-shaped submission rejection (data-loss defence)', () => {
      it('rejects single-root output whose content embeds further heading markers — the canonical bug shape', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const blobContent = 'Root\n## [ ] Child\n### [ ] Grandchild';
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [{ id: 'blob', content: blobContent, children: [], metadata: {} }],
          allNodes: { 'blob': { id: 'blob', content: blobContent, children: [], metadata: {} } },
        });

        const result = parseFeedbackContent('# [ ] Root\n## [ ] Child\n### [ ] Grandchild');
        expect(result).toBeNull();
      });

      it('rejects single-root output whose content embeds three or more checkbox markers but no real heading break', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const blobContent = 'Top [ ] child one [x] child two [ ] child three [-] child four';
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [{ id: 'blob', content: blobContent, children: [], metadata: {} }],
          allNodes: { 'blob': { id: 'blob', content: blobContent, children: [], metadata: {} } },
        });

        const result = parseFeedbackContent('# [ ] Top [ ] child one [x] child two [ ] child three [-] child four');
        expect(result).toBeNull();
      });

      it('accepts a single-root title with two incidental checkbox markers in prose (false-positive guard)', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const benignContent = 'Pick [x] one or [ ] the other';
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [{ id: 'ok', content: benignContent, children: [], metadata: {} }],
          allNodes: { 'ok': { id: 'ok', content: benignContent, children: [], metadata: {} } },
        });

        const result = parseFeedbackContent('# [ ] Pick [x] one or [ ] the other');
        expect(result).not.toBeNull();
        expect(result!.rootNodeId).toBe('ok');
      });

      it('rejects the captured-evidence shape where the root prefix is doubled and the subtree is duplicated', async () => {
        const { parseMarkdown } = await vi.importActual<typeof import('../../../utils/markdown')>('../../../utils/markdown');
        vi.mocked((await import('../../../utils/markdown')).parseMarkdown).mockImplementation(parseMarkdown);

        const payload = [
          '# [x] # [x] Remove the 10-minute step timeout indicator',
          '## [x] worktree',
          '### [x] vscode://file//worktree/path',
          '## [x] Product spec',
          '### [x] Context',
          '## [x] worktree',
          '### [x] vscode://file//worktree/path',
          '## [x] Product spec',
          '### [x] Context',
        ].join('\n');

        const result = parseFeedbackContent(payload, true);
        expect(result).toBeNull();
      });

      it('rejects single-root output whose content embeds literal backslash-n sequences', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const blobContent = 'Root\\n## [ ] Child\\n### [ ] Grandchild';
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [{ id: 'blob', content: blobContent, children: [], metadata: {} }],
          allNodes: { 'blob': { id: 'blob', content: blobContent, children: [], metadata: {} } },
        });

        const result = parseFeedbackContent('# [ ] Root\\n## [ ] Child\\n### [ ] Grandchild');
        expect(result).toBeNull();
      });

      it('accepts a legitimate short single-root update with no embedded markers (regression guard)', async () => {
        const { parseMarkdown } = await import('../../../utils/markdown');
        const benign = { id: 'ok', content: 'Rename this task', children: [], metadata: {} };
        vi.mocked(parseMarkdown).mockReturnValue({
          rootNodes: [benign],
          allNodes: { 'ok': benign },
        });

        const result = parseFeedbackContent('# [ ] Rename this task');
        expect(result).not.toBeNull();
        expect(result!.rootNodeId).toBe('ok');
      });

      it('also applies the blob guard under decomposition mode (multi-root path) when a root carries a blob payload');

      it('emits a structured warning identifying the failure as a blob-shaped submission, distinct from the no-headings rejection');

      it('rejects single-root content whose length exceeds the blob threshold even without embedded markers');
    });
  });

  describe('parseFeedbackContentWithReason', () => {
    it('returns ok:true with the parsed content when input is valid', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      const mockNodes = { 'node1': { id: 'node1', content: 'Test', children: [], metadata: {} } };
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [{ id: 'node1', content: 'Test', children: [], metadata: {} }],
        allNodes: mockNodes,
      });

      const result = parseFeedbackContentWithReason('# Test');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.content.rootNodeId).toBe('node1');
      }
    });

    it('returns ok:false with a markdown-parse reason when parseMarkdown throws', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new Error('Invalid markdown');
      });

      const result = parseFeedbackContentWithReason('invalid');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/markdown|parse/i);
    });

    it('returns ok:false with a no-heading reason when there are no root nodes', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockReturnValue({ rootNodes: [], allNodes: {} });

      const result = parseFeedbackContentWithReason('no headings');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/#|heading|root/i);
    });

    it('returns ok:false with a blob-shape reason when output looks like a packed blob', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      const blobContent = 'Root\n## [ ] Child';
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [{ id: 'blob', content: blobContent, children: [], metadata: {} }],
        allNodes: { 'blob': { id: 'blob', content: blobContent, children: [], metadata: {} } },
      });

      const result = parseFeedbackContentWithReason('# [ ] Root\n## [ ] Child');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/blob/i);
    });

    it('returns ok:false with a root-count reason naming the actual and expected counts (so the assistant can self-correct on retry — the original bug)', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [
          { id: 'n1', content: 'A', children: [], metadata: {} },
          { id: 'n2', content: 'B', children: [], metadata: {} },
        ],
        allNodes: {},
      });

      const result = parseFeedbackContentWithReason('# A\n# B', false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/2/);
        expect(result.reason).toMatch(/1|exactly one|single/i);
      }
    });
  });

  describe('initializeFeedbackStore', () => {
    it('should wrap nodes with hidden root and initialize store', async () => {
      const { wrapNodesWithHiddenRoot } = await import('../../../utils/nodeHelpers');
      vi.mocked(wrapNodesWithHiddenRoot).mockReturnValue({
        nodes: {
          'hidden-root': { id: 'hidden-root', content: '', children: ['node1'], metadata: {} },
          'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
        },
        rootNodeId: 'hidden-root',
      });

      const parsedContent = {
        nodes: { 'node1': { id: 'node1', content: 'Test', children: [], metadata: {} } },
        rootNodeId: 'node1',
        rootNodeIds: ['node1'],
        nodeCount: 1,
      };

      initializeFeedbackStore('/test/file.arbo', parsedContent);

      expect(wrapNodesWithHiddenRoot).toHaveBeenCalledWith(
        parsedContent.nodes,
        ['node1'],
        'feedback-root'
      );
      expect(mockFeedbackTreeStore.initialize).toHaveBeenCalledWith(
        '/test/file.arbo',
        {
          'hidden-root': { id: 'hidden-root', content: '', children: ['node1'], metadata: {} },
          'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
        },
        'hidden-root'
      );
    });

    it('injects a removed-node placeholder for prior children that disappear from the proposed subtree', async () => {
      const { wrapNodesWithHiddenRoot } = await import('../../../utils/nodeHelpers');
      vi.mocked(wrapNodesWithHiddenRoot).mockReturnValue({
        nodes: {
          'hidden-root': { id: 'hidden-root', content: '', children: ['new-parent'], metadata: {} },
          'new-parent': { id: 'new-parent', content: 'Parent', children: ['kept'], metadata: {} },
          'kept': { id: 'kept', content: 'Kept child', children: [], metadata: {} },
        },
        rootNodeId: 'hidden-root',
      });

      const parsedContent = {
        nodes: {
          'new-parent': { id: 'new-parent', content: 'Parent', children: ['kept'], metadata: {} },
          'kept': { id: 'kept', content: 'Kept child', children: [], metadata: {} },
        },
        rootNodeId: 'new-parent',
        rootNodeIds: ['new-parent'],
        nodeCount: 2,
      };

      const priorNodes: Record<string, TreeNode> = {
        'collab': { id: 'collab', content: 'Parent', children: ['prior-kept', 'prior-removed'], metadata: {} },
        'prior-kept': { id: 'prior-kept', content: 'Kept child', children: [], metadata: {} },
        'prior-removed': { id: 'prior-removed', content: 'Removed child', children: [], metadata: {} },
      };

      initializeFeedbackStore('/test/file.arbo', parsedContent, false, {
        collaboratingNodeId: 'collab',
        priorNodes,
        decomposition: false,
      });

      const callArgs = mockFeedbackTreeStore.initialize.mock.calls[0];
      const passedNodes = callArgs[1] as Record<string, TreeNode>;

      const placeholderId = 'feedback-removed-prior-removed';
      expect(passedNodes[placeholderId]).toBeDefined();
      expect(passedNodes[placeholderId].metadata.feedbackBaselineKind).toBe('removed');
      expect(passedNodes[placeholderId].content).toBe('Removed child');
      expect(passedNodes['new-parent'].children).toContain(placeholderId);
      expect(passedNodes['new-parent'].children).toContain('kept');
      expect(passedNodes['kept'].metadata.feedbackBaselineKind).toBe('unchanged');
    });

    describe('compare bug — prior subtree snapshot lifecycle', () => {
      it('classifies a mix of unchanged and modified children correctly when parent content matches', async () => {
        const { wrapNodesWithHiddenRoot } = await import('../../../utils/nodeHelpers');
        vi.mocked(wrapNodesWithHiddenRoot).mockReturnValue({
          nodes: {
            'hidden-root': { id: 'hidden-root', content: '', children: ['new-parent'], metadata: {} },
            'new-parent': { id: 'new-parent', content: 'Parent', children: ['new-a', 'new-b', 'new-c'], metadata: {} },
            'new-a': { id: 'new-a', content: 'kept-a', children: [], metadata: {} },
            'new-b': { id: 'new-b', content: 'edited-b', children: [], metadata: {} },
            'new-c': { id: 'new-c', content: 'kept-c', children: [], metadata: {} },
          },
          rootNodeId: 'hidden-root',
        });

        const parsedContent = {
          nodes: {
            'new-parent': { id: 'new-parent', content: 'Parent', children: ['new-a', 'new-b', 'new-c'], metadata: {} },
            'new-a': { id: 'new-a', content: 'kept-a', children: [], metadata: {} },
            'new-b': { id: 'new-b', content: 'edited-b', children: [], metadata: {} },
            'new-c': { id: 'new-c', content: 'kept-c', children: [], metadata: {} },
          },
          rootNodeId: 'new-parent',
          rootNodeIds: ['new-parent'],
          nodeCount: 4,
        };

        const priorNodes: Record<string, TreeNode> = {
          'collab': { id: 'collab', content: 'Parent', children: ['prior-a', 'prior-b', 'prior-c'], metadata: {} },
          'prior-a': { id: 'prior-a', content: 'kept-a', children: [], metadata: {} },
          'prior-b': { id: 'prior-b', content: 'kept-b', children: [], metadata: {} },
          'prior-c': { id: 'prior-c', content: 'kept-c', children: [], metadata: {} },
        };

        initializeFeedbackStore('/test/file.arbo', parsedContent, false, {
          collaboratingNodeId: 'collab',
          priorNodes,
          decomposition: false,
        });

        const callArgs = mockFeedbackTreeStore.initialize.mock.calls[0];
        const passedNodes = callArgs[1] as Record<string, TreeNode>;

        expect(passedNodes['new-a'].metadata.feedbackBaselineKind).toBe('unchanged');
        expect(passedNodes['new-b'].metadata.feedbackBaselineKind).toBe('modified');
        expect(passedNodes['new-c'].metadata.feedbackBaselineKind).toBe('unchanged');
        expect(passedNodes['new-parent'].metadata.feedbackBaselineKind).toBe('unchanged');
      });

      it.todo('produces stable classifications when initializeFeedbackStore is called twice in a row with the same priorNodes reference');
      it.todo('is unaffected by callers mutating priorNodes children arrays after initializeFeedbackStore returns');
      it.todo('is unaffected by callers replacing nodes inside priorNodes (immutable update style) between snapshot capture and reconcile');
      it.todo('snapshots only the collaborating subtree — unrelated workspace nodes in priorNodes do not affect classification');
      it.todo('does not depend on identity of TreeNode references — equivalent priorNodes maps yield identical classifications');
      it.todo('does not silently fall back to all-added when priorRootId resolves to a node with stale children pointers');
    });

    it('does not inject placeholders in decomposition mode', async () => {
      const { wrapNodesWithHiddenRoot } = await import('../../../utils/nodeHelpers');
      vi.mocked(wrapNodesWithHiddenRoot).mockReturnValue({
        nodes: {
          'hidden-root': { id: 'hidden-root', content: '', children: ['new-root'], metadata: {} },
          'new-root': { id: 'new-root', content: 'Root', children: [], metadata: {} },
        },
        rootNodeId: 'hidden-root',
      });

      const parsedContent = {
        nodes: {
          'new-root': { id: 'new-root', content: 'Root', children: [], metadata: {} },
        },
        rootNodeId: 'new-root',
        rootNodeIds: ['new-root'],
        nodeCount: 1,
      };

      const priorNodes: Record<string, TreeNode> = {
        'collab': { id: 'collab', content: 'Root', children: ['prior-removed'], metadata: {} },
        'prior-removed': { id: 'prior-removed', content: 'Will be discarded', children: [], metadata: {} },
      };

      initializeFeedbackStore('/test/file.arbo', parsedContent, false, {
        collaboratingNodeId: 'collab',
        priorNodes,
        decomposition: true,
      });

      const callArgs = mockFeedbackTreeStore.initialize.mock.calls[0];
      const passedNodes = callArgs[1] as Record<string, TreeNode>;
      const hasPlaceholder = Object.keys(passedNodes).some((id) => id.startsWith('feedback-removed-'));
      expect(hasPlaceholder).toBe(false);
    });
  });

  describe('findCollaboratingNode', () => {
    it('should return null when no nodes have feedbackTempFile', () => {
      const nodes: Record<string, TreeNode> = {
        'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
        'node2': { id: 'node2', content: 'Test 2', children: [], metadata: {} },
      };

      const result = findCollaboratingNode(nodes);
      expect(result).toBeNull();
    });

    it('should return node with feedbackTempFile metadata', () => {
      const nodes: Record<string, TreeNode> = {
        'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
        'node2': { id: 'node2', content: 'Test 2', children: [], metadata: { feedbackTempFile: '/tmp/feedback.arbo' } },
      };

      const result = findCollaboratingNode(nodes);
      expect(result).toEqual(['node2', nodes['node2']]);
    });
  });

  describe('extractFeedbackContent', () => {
    it('should return null when no feedback store', () => {
      mockFeedbackTreeStore.getStoreForFile.mockReturnValue(null);

      const result = extractFeedbackContent('/test/file.arbo');
      expect(result).toBeNull();
    });

    it('should return null when feedback store is empty', () => {
      mockFeedbackTreeStore.getStoreForFile.mockReturnValue({
        getState: () => ({
          nodes: { 'feedback-root': { id: 'feedback-root', children: [], content: '', metadata: {} } },
          rootNodeId: 'feedback-root',
        }),
      });

      const result = extractFeedbackContent('/test/file.arbo');
      expect(result).toBeNull();
    });

    it('should extract content nodes excluding hidden root', () => {
      mockFeedbackTreeStore.getStoreForFile.mockReturnValue({
        getState: () => ({
          nodes: {
            'feedback-root': { id: 'feedback-root', children: ['content-root'], content: '', metadata: {} },
            'content-root': { id: 'content-root', children: ['child1'], content: 'Content', metadata: {} },
            'child1': { id: 'child1', children: [], content: 'Child', metadata: {} },
          },
          rootNodeId: 'feedback-root',
        }),
      });

      const result = extractFeedbackContent('/test/file.arbo');
      expect(result).toEqual({
        rootNodeId: 'content-root',
        rootNodeIds: ['content-root'],
        nodes: {
          'content-root': { id: 'content-root', children: ['child1'], content: 'Content', metadata: {} },
          'child1': { id: 'child1', children: [], content: 'Child', metadata: {} },
        },
      });
    });

    it('strips removed-node placeholders from extracted nodes and from parent children arrays', () => {
      mockFeedbackTreeStore.getStoreForFile.mockReturnValue({
        getState: () => ({
          nodes: {
            'feedback-root': { id: 'feedback-root', children: ['content-root'], content: '', metadata: {} },
            'content-root': {
              id: 'content-root',
              children: ['feedback-removed-prior', 'kept'],
              content: 'Content',
              metadata: {},
            },
            'feedback-removed-prior': {
              id: 'feedback-removed-prior',
              children: [],
              content: 'Was here',
              metadata: { feedbackBaselineKind: 'removed' },
            },
            'kept': { id: 'kept', children: [], content: 'Kept', metadata: {} },
          },
          rootNodeId: 'feedback-root',
        }),
      });

      const result = extractFeedbackContent('/test/file.arbo');
      expect(result).not.toBeNull();
      expect(result!.nodes['feedback-removed-prior']).toBeUndefined();
      expect(result!.nodes['content-root'].children).toEqual(['kept']);
      expect(result!.nodes['kept']).toBeDefined();
    });

    it('should extract multiple root nodes when hidden root has multiple children', () => {
      mockFeedbackTreeStore.getStoreForFile.mockReturnValue({
        getState: () => ({
          nodes: {
            'feedback-root': { id: 'feedback-root', children: ['story1', 'story2', 'story3'], content: '', metadata: {} },
            'story1': { id: 'story1', children: [], content: 'Story 1', metadata: {} },
            'story2': { id: 'story2', children: ['detail1'], content: 'Story 2', metadata: {} },
            'detail1': { id: 'detail1', children: [], content: 'Detail', metadata: {} },
            'story3': { id: 'story3', children: [], content: 'Story 3', metadata: {} },
          },
          rootNodeId: 'feedback-root',
        }),
      });

      const result = extractFeedbackContent('/test/file.arbo');
      expect(result).not.toBeNull();
      expect(result!.rootNodeIds).toEqual(['story1', 'story2', 'story3']);
      expect(result!.nodes).not.toHaveProperty('feedback-root');
      expect(Object.keys(result!.nodes)).toHaveLength(4);
    });
  });
});
