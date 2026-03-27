import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFeedbackClipboard } from '../useFeedbackClipboard';

const mockProcessIncomingFeedbackContent = vi.fn();

const mockCollaboratingNodeId = { value: null as string | null };

const mockStore = {
  getState: () => ({
    collaboratingNodeId: mockCollaboratingNodeId.value,
    nodes: {
      'node-1': { id: 'node-1', content: '', children: [], metadata: {} },
      'node-2': { id: 'node-2', content: '', children: [], metadata: {} },
    },
    actions: {
      processIncomingFeedbackContent: mockProcessIncomingFeedbackContent,
      findNodeIdByFeedbackFilePath: () => null,
      handleAutonomousFeedback: vi.fn(),
    },
  }),
};

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(() => mockStore),
    getAllStores: vi.fn(() => [mockStore]),
  },
}));

vi.mock('../../../../services/feedback/feedbackTempFileService', () => ({
  loadFeedbackContent: vi.fn().mockResolvedValue(null),
}));

const { mockFeedbackTreeClearFile, mockFeedbackTreeStore } = vi.hoisted(() => {
  let hasContent = false;
  const versionListeners = new Set<() => void>();

  const notifyListeners = () => versionListeners.forEach(l => l());

  const clearFile = vi.fn(() => {
    hasContent = false;
    notifyListeners();
  });

  const store = {
    clearFile,
    getStoreForFile: () => null,
    hasFeedback: () => hasContent,
    subscribeToVersion: (listener: () => void) => {
      versionListeners.add(listener);
      return () => versionListeners.delete(listener);
    },
    _setHasContent: (value: boolean) => {
      hasContent = value;
      notifyListeners();
    },
  };

  return {
    mockFeedbackTreeClearFile: clearFile,
    mockFeedbackTreeStore: store,
  };
});

vi.mock('../../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: mockFeedbackTreeStore,
}));

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn((selector) => {
    const mockState = {
      activeFilePath: '/test/file.arbo',
    };
    return selector(mockState);
  }),
}));


describe('useFeedbackClipboard', () => {
  let mockOnClipboardContentDetected: ReturnType<typeof vi.fn>;
  let mockOnFeedbackFileContentDetected: ReturnType<typeof vi.fn>;
  let mockCleanup: ReturnType<typeof vi.fn>;
  let clipboardCallback: (content: string) => void;
  let fileCallback: (filePath: string, content: string) => void;

  beforeEach(() => {
    mockProcessIncomingFeedbackContent.mockClear();
    mockFeedbackTreeClearFile.mockClear();
    mockFeedbackTreeStore._setHasContent(false);
    mockCollaboratingNodeId.value = 'node-1';
    mockCleanup = vi.fn();
    mockOnClipboardContentDetected = vi.fn((callback) => {
      clipboardCallback = callback;
      return mockCleanup;
    });
    mockOnFeedbackFileContentDetected = vi.fn((callback) => {
      fileCallback = callback;
      return mockCleanup;
    });

    // Default: processIncomingFeedbackContent returns success and populates the store
    mockProcessIncomingFeedbackContent.mockImplementation(async () => {
      mockFeedbackTreeStore._setHasContent(true);
      return { success: true, nodeCount: 1 };
    });

    global.window = {
      electron: {
        onClipboardContentDetected: mockOnClipboardContentDetected,
        onFeedbackFileContentDetected: mockOnFeedbackFileContentDetected,
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('should initialize with false hasFeedbackContent', () => {
    const { result } = renderHook(() => useFeedbackClipboard('node-1'));

    expect(result.current).toBe(false);
  });

  it('should register clipboard listener on mount', () => {
    renderHook(() => useFeedbackClipboard('node-1'));

    expect(mockOnClipboardContentDetected).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should call store action when clipboard content is detected', async () => {
    const { result } = renderHook(() => useFeedbackClipboard('node-1'));

    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockProcessIncomingFeedbackContent).toHaveBeenCalledWith(
      '- Valid node',
      'clipboard',
      false
    );
  });

  it('should call store action when file content is detected', async () => {
    const { result } = renderHook(() => useFeedbackClipboard('node-1'));

    act(() => {
      fileCallback('/tmp/feedback-response-node-1.md', '- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockProcessIncomingFeedbackContent).toHaveBeenCalledWith(
      '- Valid node',
      'file',
      false
    );
  });

  it('should not set hasFeedbackContent when action fails', async () => {
    mockProcessIncomingFeedbackContent.mockImplementation(async () => ({ success: false }));

    const { result } = renderHook(() => useFeedbackClipboard('node-1'));

    act(() => {
      clipboardCallback('Invalid content');
    });

    await waitFor(() => {
      expect(mockProcessIncomingFeedbackContent).toHaveBeenCalled();
    }, { container: document.body });

    expect(result.current).toBe(false);
  });

  it('should clear feedback store when collaboratingNodeId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ collaboratingNodeId }: { collaboratingNodeId: string | null }) => useFeedbackClipboard(collaboratingNodeId),
      { initialProps: { collaboratingNodeId: 'node-1' as string | null } }
    );

    // Set some feedback content first
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    // Clear collaboration by setting collaboratingNodeId to null
    act(() => {
      rerender({ collaboratingNodeId: null });
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    }, { container: document.body });

    expect(mockFeedbackTreeClearFile).toHaveBeenCalledWith('/test/file.arbo');
  });

  it('should not clear hasFeedbackContent when collaboratingNodeId changes to another node', async () => {
    const { result, rerender } = renderHook(
      ({ collaboratingNodeId }: { collaboratingNodeId: string | null }) => useFeedbackClipboard(collaboratingNodeId),
      { initialProps: { collaboratingNodeId: 'node-1' as string | null } }
    );

    // Set some feedback content first
    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    // Change to another node (not null)
    act(() => {
      rerender({ collaboratingNodeId: 'node-2' });
    });

    // Content should still be there
    expect(result.current).toBe(true);
  });

  it('should cleanup listener on unmount', () => {
    const { unmount } = renderHook(() => useFeedbackClipboard('node-1'));

    unmount();

    expect(mockCleanup).toHaveBeenCalled();
  });

  it('should not call action when no collaboratingNodeId', async () => {
    renderHook(() => useFeedbackClipboard(null));

    act(() => {
      clipboardCallback('- Valid node');
    });

    // Give time for any async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockProcessIncomingFeedbackContent).not.toHaveBeenCalled();
  });

  it('should process feedback even when active tab differs from collaborating store', async () => {
    const { useFilesStore } = await import('../../../../store/files/filesStore');
    vi.mocked(useFilesStore).mockImplementation((selector) =>
      selector({ activeFilePath: '/other/file.arbo' } as ReturnType<typeof useFilesStore.getState>)
    );

    const { result } = renderHook(() => useFeedbackClipboard('node-1'));

    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    expect(mockProcessIncomingFeedbackContent).toHaveBeenCalledWith(
      '- Valid node',
      'clipboard',
      false
    );
  });

  it('should route autonomous file feedback to correct store regardless of active tab', async () => {
    const mockHandleAutonomousFeedback = vi.fn();
    const mockFindNode = vi.fn().mockReturnValue('node-1');

    const { storeManager } = await import('../../../../store/storeManager');
    vi.mocked(storeManager.getAllStores).mockReturnValue([{
      getState: () => ({
        collaboratingNodeId: 'node-1',
        actions: {
          findNodeIdByFeedbackFilePath: mockFindNode,
          handleAutonomousFeedback: mockHandleAutonomousFeedback,
        },
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any]);

    const { useFilesStore } = await import('../../../../store/files/filesStore');
    vi.mocked(useFilesStore).mockImplementation((selector) =>
      selector({ activeFilePath: '/other/file.arbo' } as ReturnType<typeof useFilesStore.getState>)
    );

    renderHook(() => useFeedbackClipboard('node-1'));

    act(() => {
      fileCallback('/tmp/feedback-response-node-1.md', '# Updated');
    });

    expect(mockHandleAutonomousFeedback).toHaveBeenCalledWith('node-1', '# Updated');
  });
});
