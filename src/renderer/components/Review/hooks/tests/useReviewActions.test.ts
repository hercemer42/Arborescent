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
const mockHidePanel = vi.fn();

const mockNodes = {
  'node-id': {
    id: 'node-id',
    content: 'Test',
    children: [],
    metadata: {
      plugins: {},
      reviewTempFile: '/temp/review-node-id.txt',
      reviewContentHash: 'hash123',
    },
  },
  'old-node-id': {
    id: 'old-node-id',
    content: 'Old',
    children: [],
    metadata: {
      plugins: {},
      reviewTempFile: '/temp/review-old-node-id.txt',
      reviewContentHash: 'hash456',
    },
  },
};

const mockStore = {
  actions: {
    cancelReview: mockCancelReview,
    acceptReview: mockAcceptReview,
  },
  reviewingNodeId: 'node-id',
  nodes: mockNodes,
};

vi.mock('../../../../store/tree/useStore', () => ({
  useStore: Object.assign(
    vi.fn((selector) => {
      return selector ? selector(mockStore) : mockStore;
    }),
    {
      getState: vi.fn(() => mockStore),
    }
  ),
}));

vi.mock('../../../../store/panel/panelStore', () => ({
  usePanelStore: vi.fn((selector) => {
    const mockState = {
      hidePanel: mockHidePanel,
    };
    return selector(mockState);
  }),
}));

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: vi.fn(() => ({
      activeFilePath: '/test/file.arbo',
    })),
  },
}));

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(() => ({
      getState: vi.fn(() => mockStore),
    })),
  },
}));

vi.mock('../../../../utils/reviewTempFiles', () => ({
  deleteReviewTempFile: vi.fn().mockResolvedValue(undefined),
}));

const { mockReviewNodes, mockReviewStore, mockReviewTreeStore } = vi.hoisted(() => {
  const nodes = {
    'review-root': {
      id: 'review-root',
      content: 'Review Root',
      children: ['review-child-1'],
      metadata: { plugins: {} },
    },
    'review-child-1': {
      id: 'review-child-1',
      content: 'Review Child',
      children: [],
      metadata: { plugins: {} },
    },
  };

  const store = {
    getState: vi.fn(() => ({
      nodes,
      rootNodeId: 'review-root',
    })),
  };

  const treeStore = {
    getStoreForFile: vi.fn(() => store),
    clearFile: vi.fn(),
  };

  return {
    mockReviewNodes: nodes,
    mockReviewStore: store,
    mockReviewTreeStore: treeStore,
  };
});

vi.mock('../../../../store/review/reviewTreeStore', () => ({
  reviewTreeStore: mockReviewTreeStore,
}));

describe('useReviewActions', () => {
  let mockStopClipboardMonitor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewTreeStore.getStoreForFile.mockReturnValue(mockReviewStore);
    mockReviewTreeStore.clearFile.mockClear();
    mockReviewStore.getState.mockReturnValue({
      nodes: mockReviewNodes,
      rootNodeId: 'review-root',
    });
    mockStopClipboardMonitor = vi.fn().mockResolvedValue(undefined);

    global.window = {
      electron: {
        stopClipboardMonitor: mockStopClipboardMonitor,
      },
      dispatchEvent: vi.fn(),
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
    it('should get nodes from review store, accept review, clear store, and stop monitoring', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept();
      });

      expect(mockReviewTreeStore.getStoreForFile).toHaveBeenCalledWith('/test/file.arbo');
      expect(mockAcceptReview).toHaveBeenCalledWith(
        'review-root',
        mockReviewNodes
      );
      expect(mockReviewTreeStore.clearFile).toHaveBeenCalledWith('/test/file.arbo');
      expect(mockStopClipboardMonitor).toHaveBeenCalled();
      expect(mockHidePanel).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Accepting review with 2 nodes',
        'ReviewActions'
      );
      expect(logger.info).toHaveBeenCalledWith('Review accepted and node replaced', 'ReviewActions');
    });

    it('should not accept if review store is not available', async () => {
      mockReviewTreeStore.getStoreForFile.mockReturnValueOnce(null as never);

      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept();
      });

      expect(mockAcceptReview).not.toHaveBeenCalled();
      expect(mockStopClipboardMonitor).not.toHaveBeenCalled();
      expect(mockReviewTreeStore.clearFile).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'No review store available',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should handle errors during accept gracefully', async () => {
      const error = new Error('Accept failed');
      mockAcceptReview.mockImplementationOnce(() => {
        throw error;
      });

      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept();
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to accept review',
        error,
        'ReviewActions'
      );
    });

    it('should dispatch review-accepted event', async () => {
      const { result } = renderHook(() => useReviewActions());

      await act(async () => {
        await result.current.handleAccept();
      });

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'review-accepted',
        })
      );
    });
  });
});
