import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseReviewContent,
  initializeReviewStore,
  findReviewingNode,
  extractReviewContent,
} from '../reviewService';
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

const { mockReviewTreeStore } = vi.hoisted(() => ({
  mockReviewTreeStore: {
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    getStoreForFile: vi.fn(),
    clearFile: vi.fn(),
  },
}));

vi.mock('../../../store/review/reviewTreeStore', () => ({
  reviewTreeStore: mockReviewTreeStore,
}));

describe('reviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseReviewContent', () => {
    it('should return null for invalid markdown', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new Error('Invalid markdown');
      });

      const result = parseReviewContent('invalid content');
      expect(result).toBeNull();
    });

    it('should return null when no root nodes', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockReturnValue({ rootNodes: [], allNodes: {} });

      const result = parseReviewContent('# No valid nodes');
      expect(result).toBeNull();
    });

    it('should return null when multiple root nodes', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [{ id: 'node1' }, { id: 'node2' }],
        allNodes: {},
      });

      const result = parseReviewContent('# Node 1\n# Node 2');
      expect(result).toBeNull();
    });

    it('should return parsed content when exactly one root node', async () => {
      const { parseMarkdown } = await import('../../../utils/markdown');
      const mockNodes = {
        'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
      };
      vi.mocked(parseMarkdown).mockReturnValue({
        rootNodes: [{ id: 'node1' }],
        allNodes: mockNodes,
      });

      const result = parseReviewContent('# Test');
      expect(result).toEqual({
        nodes: mockNodes,
        rootNodeId: 'node1',
        nodeCount: 1,
      });
    });
  });

  describe('initializeReviewStore', () => {
    it('should wrap nodes with hidden root and initialize store', async () => {
      const { wrapNodesWithHiddenRoot } = await import('../../../utils/nodeHelpers');
      vi.mocked(wrapNodesWithHiddenRoot).mockReturnValue({
        nodes: { 'hidden-root': {}, 'node1': {} },
        rootNodeId: 'hidden-root',
      });

      const parsedContent = {
        nodes: { 'node1': { id: 'node1', content: 'Test', children: [], metadata: {} } },
        rootNodeId: 'node1',
        nodeCount: 1,
      };

      initializeReviewStore('/test/file.arbo', parsedContent);

      expect(wrapNodesWithHiddenRoot).toHaveBeenCalledWith(
        parsedContent.nodes,
        'node1',
        'review-root'
      );
      expect(mockReviewTreeStore.initialize).toHaveBeenCalledWith(
        '/test/file.arbo',
        { 'hidden-root': {}, 'node1': {} },
        'hidden-root'
      );
    });
  });

  describe('findReviewingNode', () => {
    it('should return null when no nodes have reviewTempFile', () => {
      const nodes: Record<string, TreeNode> = {
        'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
        'node2': { id: 'node2', content: 'Test 2', children: [], metadata: {} },
      };

      const result = findReviewingNode(nodes);
      expect(result).toBeNull();
    });

    it('should return node with reviewTempFile metadata', () => {
      const nodes: Record<string, TreeNode> = {
        'node1': { id: 'node1', content: 'Test', children: [], metadata: {} },
        'node2': { id: 'node2', content: 'Test 2', children: [], metadata: { reviewTempFile: '/tmp/review.arbo' } },
      };

      const result = findReviewingNode(nodes);
      expect(result).toEqual(['node2', nodes['node2']]);
    });
  });

  describe('extractReviewContent', () => {
    it('should return null when no review store', () => {
      mockReviewTreeStore.getStoreForFile.mockReturnValue(null);

      const result = extractReviewContent('/test/file.arbo');
      expect(result).toBeNull();
    });

    it('should return null when review store is empty', () => {
      mockReviewTreeStore.getStoreForFile.mockReturnValue({
        getState: () => ({
          nodes: { 'review-root': { id: 'review-root', children: [], content: '', metadata: {} } },
          rootNodeId: 'review-root',
        }),
      });

      const result = extractReviewContent('/test/file.arbo');
      expect(result).toBeNull();
    });

    it('should extract content nodes excluding hidden root', () => {
      mockReviewTreeStore.getStoreForFile.mockReturnValue({
        getState: () => ({
          nodes: {
            'review-root': { id: 'review-root', children: ['content-root'], content: '', metadata: {} },
            'content-root': { id: 'content-root', children: ['child1'], content: 'Content', metadata: {} },
            'child1': { id: 'child1', children: [], content: 'Child', metadata: {} },
          },
          rootNodeId: 'review-root',
        }),
      });

      const result = extractReviewContent('/test/file.arbo');
      expect(result).toEqual({
        rootNodeId: 'content-root',
        nodes: {
          'content-root': { id: 'content-root', children: ['child1'], content: 'Content', metadata: {} },
          'child1': { id: 'child1', children: [], content: 'Child', metadata: {} },
        },
      });
    });
  });
});
