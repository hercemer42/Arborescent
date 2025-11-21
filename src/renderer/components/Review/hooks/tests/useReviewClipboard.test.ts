import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useReviewClipboard } from '../useReviewClipboard';
import { logger } from '../../../../services/logger';

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUpdateReviewMetadata = vi.fn();

vi.mock('../../../../store/tree/useStore', () => ({
  useStore: vi.fn((selector) => {
    const mockState = {
      actions: {
        updateReviewMetadata: mockUpdateReviewMetadata,
      },
    };
    return selector(mockState);
  }),
}));

vi.mock('../../../../utils/reviewTempFiles', () => ({
  saveReviewContent: vi.fn().mockResolvedValue({ filePath: '/temp/review-test.txt', contentHash: 'hash123' }),
}));

const { mockReviewTreeInitialize, mockReviewTreeClearFile, mockReviewTreeGetStoreForFile } = vi.hoisted(() => ({
  mockReviewTreeInitialize: vi.fn(),
  mockReviewTreeClearFile: vi.fn(),
  mockReviewTreeGetStoreForFile: vi.fn(),
}));

vi.mock('../../../../store/review/reviewTreeStore', () => ({
  reviewTreeStore: {
    initialize: mockReviewTreeInitialize,
    clearFile: mockReviewTreeClearFile,
    getStoreForFile: mockReviewTreeGetStoreForFile,
  },
}));

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn((selector) => {
    const mockState = {
      activeFilePath: '/test/file.arbo',
    };
    return selector(mockState);
  }),
}));

vi.mock('../../../../utils/markdownParser', () => ({
  parseMarkdown: vi.fn((content: string) => {
    // Mock implementation: return valid parse for specific content
    if (content.includes('- Valid node')) {
      return [{
        id: 'node-1',
        content: 'Valid node',
        children: [],
        metadata: { plugins: {} },
      }];
    }
    if (content.includes('- Node 1\n- Node 2')) {
      // Multiple root nodes
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
    const result: Record<string, any> = {};
    nodes.forEach((node: { id: string }) => {
      result[node.id] = node;
    });
    return result;
  }),
}));

describe('useReviewClipboard', () => {
  let mockOnClipboardContentDetected: ReturnType<typeof vi.fn>;
  let mockCleanup: ReturnType<typeof vi.fn>;
  let clipboardCallback: (content: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReviewMetadata.mockClear();
    mockReviewTreeInitialize.mockClear();
    mockReviewTreeClearFile.mockClear();
    mockReviewTreeGetStoreForFile.mockClear();
    mockCleanup = vi.fn();
    mockOnClipboardContentDetected = vi.fn((callback) => {
      clipboardCallback = callback;
      return mockCleanup;
    });

    global.window = {
      electron: {
        onClipboardContentDetected: mockOnClipboardContentDetected,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('should initialize with false hasReviewContent', () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    expect(result.current).toBe(false);
  });

  it('should register clipboard listener on mount', () => {
    renderHook(() => useReviewClipboard('node-1'));

    expect(mockOnClipboardContentDetected).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should set hasReviewContent to true when valid markdown is detected', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    // Simulate clipboard content detection
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockReviewTreeInitialize).toHaveBeenCalledWith(
      '/test/file.arbo',
      { 'node-1': expect.any(Object) },
      'node-1'
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully parsed clipboard content as Arborescent markdown',
      'ReviewClipboard'
    );
  });

  it('should not set hasReviewContent when markdown has multiple root nodes', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    act(() => {
      clipboardCallback('- Node 1\n- Node 2');
    });

    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        'Clipboard content has 2 root nodes, expected 1',
        'ReviewClipboard'
      );
    }, { container: document.body });

    expect(result.current).toBe(false);
    expect(mockReviewTreeInitialize).not.toHaveBeenCalled();
  });

  it('should not set hasReviewContent when markdown has no nodes', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    act(() => {
      clipboardCallback('Empty content');
    });

    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        'Clipboard content does not contain valid Arborescent markdown (no nodes parsed)',
        'ReviewClipboard'
      );
    }, { container: document.body });

    expect(result.current).toBe(false);
    expect(mockReviewTreeInitialize).not.toHaveBeenCalled();
  });

  it('should not set hasReviewContent when markdown parsing fails', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    act(() => {
      clipboardCallback('Invalid markdown content');
    });

    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        'Clipboard content is not valid Arborescent markdown',
        'ReviewClipboard'
      );
    }, { container: document.body });

    expect(result.current).toBe(false);
    expect(mockReviewTreeInitialize).not.toHaveBeenCalled();
  });

  it('should clear review store when reviewingNodeId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ reviewingNodeId }: { reviewingNodeId: string | null }) => useReviewClipboard(reviewingNodeId),
      { initialProps: { reviewingNodeId: 'node-1' as string | null } }
    );

    // Set some reviewed content first
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockReviewTreeInitialize).toHaveBeenCalled();

    // Clear review by setting reviewingNodeId to null
    act(() => {
      rerender({ reviewingNodeId: null });
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    }, { container: document.body });

    expect(mockReviewTreeClearFile).toHaveBeenCalledWith('/test/file.arbo');
  });

  it('should not clear hasReviewContent when reviewingNodeId changes to another node', async () => {
    const { result, rerender } = renderHook(
      ({ reviewingNodeId }: { reviewingNodeId: string | null }) => useReviewClipboard(reviewingNodeId),
      { initialProps: { reviewingNodeId: 'node-1' as string | null } }
    );

    // Set some reviewed content first
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    // Change to another node (not null)
    act(() => {
      rerender({ reviewingNodeId: 'node-2' });
    });

    // Content should still be there
    expect(result.current).toBe(true);
  });

  it('should cleanup listener on unmount', () => {
    const { unmount } = renderHook(() => useReviewClipboard('node-1'));

    unmount();

    expect(mockCleanup).toHaveBeenCalled();
  });
});
