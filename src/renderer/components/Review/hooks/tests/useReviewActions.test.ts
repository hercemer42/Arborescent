import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReviewActions } from '../useReviewActions';
import { logger } from '../../../../services/logger';

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCancelReview = vi.fn();
const mockAcceptReview = vi.fn();

vi.mock('../../../../store/tree/useStore', () => ({
  useStore: vi.fn((selector) => {
    const mockState = {
      actions: {
        cancelReview: mockCancelReview,
        acceptReview: mockAcceptReview,
      },
    };
    return selector(mockState);
  }),
}));

vi.mock('../../../../utils/markdownParser', () => ({
  parseMarkdown: vi.fn((content: string) => {
    if (content.includes('- Valid node')) {
      return [{
        id: 'new-node-1',
        content: 'Valid node',
        children: ['child-1'],
        metadata: { plugins: {} },
      }];
    }
    if (content.includes('Multiple')) {
      return [
        { id: 'node-1', content: 'Node 1', children: [], metadata: { plugins: {} } },
        { id: 'node-2', content: 'Node 2', children: [], metadata: { plugins: {} } },
      ];
    }
    if (content.includes('Empty')) {
      return [];
    }
    throw new Error('Invalid markdown');
  }),
  flattenNodes: vi.fn((nodes) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flattened: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flatten = (node: any) => {
      flattened[node.id] = node;
      if (node.children) {
        node.children.forEach((childId: string) => {
          const child = { id: childId, content: 'Child', children: [], metadata: { plugins: {} } };
          flatten(child);
        });
      }
    };
    nodes.forEach(flatten);
    return flattened;
  }),
}));

describe('useReviewActions', () => {
  let mockStopClipboardMonitor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStopClipboardMonitor = vi.fn().mockResolvedValue(undefined);

    global.window = {
      electron: {
        stopClipboardMonitor: mockStopClipboardMonitor,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('handleCancel', () => {
    it('should stop monitoring and cancel review', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleCancel();
      });

      expect(mockStopClipboardMonitor).toHaveBeenCalled();
      expect(mockCancelReview).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Review cancelled', 'ReviewActions');
    });

    it('should handle errors when cancelling', async () => {
      const error = new Error('Stop monitor failed');
      mockStopClipboardMonitor.mockRejectedValue(error);

      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleCancel();
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cancel review',
        error,
        'ReviewActions'
      );
    });
  });

  describe('handleAccept', () => {
    it('should parse markdown, accept review, and stop monitoring', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('- Valid node', 'old-node-id');
      });

      expect(mockAcceptReview).toHaveBeenCalledWith(
        'new-node-1',
        expect.objectContaining({
          'new-node-1': expect.any(Object),
        })
      );
      expect(mockStopClipboardMonitor).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Review accepted and node replaced', 'ReviewActions');
    });

    it('should not accept if reviewedContent is null', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept(null, 'node-id');
      });

      expect(mockAcceptReview).not.toHaveBeenCalled();
      expect(mockStopClipboardMonitor).not.toHaveBeenCalled();
    });

    it('should not accept if reviewingNodeId is null', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('- Valid node', null);
      });

      expect(mockAcceptReview).not.toHaveBeenCalled();
      expect(mockStopClipboardMonitor).not.toHaveBeenCalled();
    });

    it('should handle empty parse result', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('Empty content', 'node-id');
      });

      expect(mockAcceptReview).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'No nodes parsed from markdown',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should handle multiple root nodes', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('Multiple roots', 'node-id');
      });

      expect(mockAcceptReview).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Expected 1 root node, got 2',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should handle parsing errors', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('Invalid markdown', 'node-id');
      });

      expect(mockAcceptReview).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to accept review',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should log number of parsed nodes', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('- Valid node', 'old-node-id');
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Parsed'),
        'ReviewActions'
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('total nodes from markdown'),
        'ReviewActions'
      );
    });

    it('should handle stop monitor errors gracefully', async () => {
      const error = new Error('Stop monitor failed');
      mockStopClipboardMonitor.mockRejectedValue(error);

      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept('- Valid node', 'old-node-id');
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to accept review',
        error,
        'ReviewActions'
      );
    });
  });
});
