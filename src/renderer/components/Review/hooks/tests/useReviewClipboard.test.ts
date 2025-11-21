import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useReviewClipboard } from '../useReviewClipboard';
import { logger } from '../../../../services/logger';

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
  },
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
}));

describe('useReviewClipboard', () => {
  let mockOnClipboardContentDetected: ReturnType<typeof vi.fn>;
  let mockCleanup: ReturnType<typeof vi.fn>;
  let clipboardCallback: (content: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should initialize with null reviewedContent', () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    expect(result.current).toBeNull();
  });

  it('should register clipboard listener on mount', () => {
    renderHook(() => useReviewClipboard('node-1'));

    expect(mockOnClipboardContentDetected).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should set reviewedContent when valid markdown is detected', async () => {
    const { result } = renderHook(() => useReviewClipboard('node-1'));

    // Simulate clipboard content detection
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe('- Valid node');
    }, { container: document.body });

    expect(logger.info).toHaveBeenCalledWith(
      'Successfully parsed clipboard content as Arborescent markdown',
      'ReviewClipboard'
    );
  });

  it('should not set reviewedContent when markdown has multiple root nodes', async () => {
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

    expect(result.current).toBeNull();
  });

  it('should not set reviewedContent when markdown has no nodes', async () => {
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

    expect(result.current).toBeNull();
  });

  it('should not set reviewedContent when markdown parsing fails', async () => {
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

    expect(result.current).toBeNull();
  });

  it('should clear reviewedContent when reviewingNodeId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ reviewingNodeId }: { reviewingNodeId: string | null }) => useReviewClipboard(reviewingNodeId),
      { initialProps: { reviewingNodeId: 'node-1' as string | null } }
    );

    // Set some reviewed content first
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe('- Valid node');
    }, { container: document.body });

    // Clear review by setting reviewingNodeId to null
    act(() => {
      rerender({ reviewingNodeId: null });
    });

    await waitFor(() => {
      expect(result.current).toBeNull();
    }, { container: document.body });
  });

  it('should not clear reviewedContent when reviewingNodeId changes to another node', async () => {
    const { result, rerender } = renderHook(
      ({ reviewingNodeId }: { reviewingNodeId: string | null }) => useReviewClipboard(reviewingNodeId),
      { initialProps: { reviewingNodeId: 'node-1' as string | null } }
    );

    // Set some reviewed content first
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe('- Valid node');
    }, { container: document.body });

    // Change to another node (not null)
    act(() => {
      rerender({ reviewingNodeId: 'node-2' });
    });

    // Content should still be there
    expect(result.current).toBe('- Valid node');
  });

  it('should cleanup listener on unmount', () => {
    const { unmount } = renderHook(() => useReviewClipboard('node-1'));

    unmount();

    expect(mockCleanup).toHaveBeenCalled();
  });
});
