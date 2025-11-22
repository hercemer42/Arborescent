import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useReviewClipboard } from '../useReviewClipboard';

const mockProcessIncomingReviewContent = vi.fn();

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(() => ({
      getState: () => ({
        nodes: {
          'node-1': { id: 'node-1', content: '', children: [], metadata: {} },
          'node-2': { id: 'node-2', content: '', children: [], metadata: {} },
        },
        actions: {
          processIncomingReviewContent: mockProcessIncomingReviewContent,
        },
      }),
    })),
  },
}));

vi.mock('../../../../services/review/reviewTempFileService', () => ({
  loadReviewContent: vi.fn().mockResolvedValue(null),
}));

const { mockReviewTreeClearFile } = vi.hoisted(() => ({
  mockReviewTreeClearFile: vi.fn(),
}));

vi.mock('../../../../store/review/reviewTreeStore', () => ({
  reviewTreeStore: {
    clearFile: mockReviewTreeClearFile,
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


describe('useReviewClipboard', () => {
  let mockOnClipboardContentDetected: ReturnType<typeof vi.fn>;
  let mockOnReviewFileContentDetected: ReturnType<typeof vi.fn>;
  let mockCleanup: ReturnType<typeof vi.fn>;
  let clipboardCallback: (content: string) => void;
  let fileCallback: (content: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessIncomingReviewContent.mockClear();
    mockReviewTreeClearFile.mockClear();
    mockCleanup = vi.fn();
    mockOnClipboardContentDetected = vi.fn((callback) => {
      clipboardCallback = callback;
      return mockCleanup;
    });
    mockOnReviewFileContentDetected = vi.fn((callback) => {
      fileCallback = callback;
      return mockCleanup;
    });

    // Default: processIncomingReviewContent returns success
    mockProcessIncomingReviewContent.mockResolvedValue({ success: true, nodeCount: 1 });

    global.window = {
      electron: {
        onClipboardContentDetected: mockOnClipboardContentDetected,
        onReviewFileContentDetected: mockOnReviewFileContentDetected,
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

  it('should call store action when clipboard content is detected', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockProcessIncomingReviewContent).toHaveBeenCalledWith(
      '- Valid node',
      'clipboard',
      false
    );
  });

  it('should call store action when file content is detected', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    act(() => {
      fileCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockProcessIncomingReviewContent).toHaveBeenCalledWith(
      '- Valid node',
      'file',
      false
    );
  });

  it('should not set hasReviewContent when action fails', async () => {
    mockProcessIncomingReviewContent.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useReviewClipboard('node-1'));

    act(() => {
      clipboardCallback('Invalid content');
    });

    await waitFor(() => {
      expect(mockProcessIncomingReviewContent).toHaveBeenCalled();
    }, { container: document.body });

    expect(result.current).toBe(false);
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

  it('should not call action when no reviewingNodeId', async () => {
    renderHook(() => useReviewClipboard(null));

    act(() => {
      clipboardCallback('- Valid node');
    });

    // Give time for any async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockProcessIncomingReviewContent).not.toHaveBeenCalled();
  });
});
