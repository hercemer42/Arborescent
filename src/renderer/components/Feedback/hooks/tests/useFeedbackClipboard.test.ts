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
    getAllStoreEntries: vi.fn(() => [{ filePath: '/test/file.arbo', store: mockStore }]),
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

const mockAddToast = vi.fn();
vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
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
    mockAddToast.mockClear();
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
      false,
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
      false,
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

  it('does not clear the feedback store when collaboratingNodeId becomes null', async () => {
    // Feedback store cleanup is handled by finishCancel/finishAccept via cleanupFeedback, not this hook
    const { result, rerender } = renderHook(
      ({ collaboratingNodeId }: { collaboratingNodeId: string | null }) => useFeedbackClipboard(collaboratingNodeId),
      { initialProps: { collaboratingNodeId: 'node-1' as string | null } }
    );

    act(() => {
      clipboardCallback('- Valid node');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    }, { container: document.body });

    act(() => {
      rerender({ collaboratingNodeId: null });
    });

    expect(mockFeedbackTreeClearFile).not.toHaveBeenCalled();
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

  it('should not call action when no session is active in any store', async () => {
    mockCollaboratingNodeId.value = null; // No active session in any open file
    renderHook(() => useFeedbackClipboard(null));

    await act(async () => {
      clipboardCallback('- Valid node');
    });

    expect(mockProcessIncomingFeedbackContent).not.toHaveBeenCalled();
  });

  it('should process feedback even when active tab differs from collaborating store (panel show suppressed)', async () => {
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
      false,
      true
    );
  });

  it('should route autonomous file feedback to correct store regardless of active tab', async () => {
    const mockHandleAutonomousFeedback = vi.fn();
    const mockFindNode = vi.fn().mockReturnValue('node-1');

    const alternateStore = {
      getState: () => ({
        collaboratingNodeId: 'node-1',
        actions: {
          findNodeIdByFeedbackFilePath: mockFindNode,
          handleAutonomousFeedback: mockHandleAutonomousFeedback,
        },
      }),
    };

    const { storeManager } = await import('../../../../store/storeManager');
    vi.mocked(storeManager.getAllStores).mockReturnValue([alternateStore as any]); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(storeManager.getAllStoreEntries).mockReturnValue([
      { filePath: '/test/file.arbo', store: alternateStore as any }, // eslint-disable-line @typescript-eslint/no-explicit-any
    ]);

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
