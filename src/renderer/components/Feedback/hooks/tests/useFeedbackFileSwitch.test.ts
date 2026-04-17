import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFeedbackClipboard } from '../useFeedbackClipboard';

// ---- Hoisted shared state ----
const {
  feedbackStoreImpl,
  mockFeedbackTreeClearFile,
  mockProcessIncomingFeedbackForA,
  mockHandleAutonomousFeedbackForA,
  mockFindNodeForA,
  mockGetAllStores,
  mockGetAllStoreEntries,
  fileAStore,
  fileBStore,
} = vi.hoisted(() => {
  const versionListeners = new Set<() => void>();
  const notifyListeners = () => versionListeners.forEach(l => l());
  const perFileContent: Record<string, boolean> = {};

  const clearFile = vi.fn((filePath: string) => {
    perFileContent[filePath] = false;
    notifyListeners();
  });

  const store = {
    clearFile,
    hasFeedback: (filePath: string) => Boolean(perFileContent[filePath]),
    subscribeToVersion: (listener: () => void) => {
      versionListeners.add(listener);
      return () => versionListeners.delete(listener);
    },
    _setHasContent: (filePath: string, value: boolean) => {
      perFileContent[filePath] = value;
      notifyListeners();
    },
    _reset: () => {
      for (const key of Object.keys(perFileContent)) {
        delete perFileContent[key];
      }
    },
  };

  const mockProcessIncomingFeedbackForA = vi.fn();
  const mockHandleAutonomousFeedbackForA = vi.fn();
  const mockFindNodeForA = vi.fn().mockReturnValue(null);

  const fileAStore = {
    getState: () => ({
      collaboratingNodeId: 'node-a-1',
      actions: {
        processIncomingFeedbackContent: mockProcessIncomingFeedbackForA,
        findNodeIdByFeedbackFilePath: mockFindNodeForA,
        handleAutonomousFeedback: mockHandleAutonomousFeedbackForA,
      },
    }),
  };

  const fileBStore = {
    getState: () => ({
      collaboratingNodeId: null,
      actions: {
        processIncomingFeedbackContent: vi.fn(),
        findNodeIdByFeedbackFilePath: vi.fn().mockReturnValue(null),
        handleAutonomousFeedback: vi.fn(),
      },
    }),
  };

  const mockGetAllStores = vi.fn(() => [fileAStore, fileBStore]);
  const mockGetAllStoreEntries = vi.fn(() => [
    { filePath: '/file-a.arbo', store: fileAStore },
    { filePath: '/file-b.arbo', store: fileBStore },
  ]);

  return {
    feedbackStoreImpl: store,
    mockFeedbackTreeClearFile: clearFile,
    mockProcessIncomingFeedbackForA,
    mockHandleAutonomousFeedbackForA,
    mockFindNodeForA,
    mockGetAllStores,
    mockGetAllStoreEntries,
    fileAStore,
    fileBStore,
  };
});

vi.mock('../../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: feedbackStoreImpl,
}));

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getAllStores: mockGetAllStores,
    getAllStoreEntries: mockGetAllStoreEntries,
  },
}));

let mockActiveFilePath = '/file-a.arbo';
vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn((selector: (s: { activeFilePath: string }) => unknown) =>
    selector({ activeFilePath: mockActiveFilePath })
  ),
}));

const mockAddToast = vi.fn();
vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

// ---- Electron mock builder ----
function makeElectron() {
  let clipboardCallback: ((content: string) => void) | null = null;
  let fileCallback: ((filePath: string, content: string) => void) | null = null;
  const cleanup = vi.fn();

  const electron = {
    onClipboardContentDetected: vi.fn((cb: (content: string) => void) => {
      clipboardCallback = cb;
      return cleanup;
    }),
    onFeedbackFileContentDetected: vi.fn((cb: (filePath: string, content: string) => void) => {
      fileCallback = cb;
      return cleanup;
    }),
    startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
    stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
  };

  return {
    electron,
    triggerClipboard: (content: string) => clipboardCallback?.(content),
    triggerFile: (filePath: string, content: string) => fileCallback?.(filePath, content),
  };
}

describe('useFeedbackClipboard — file switch integrity', () => {
  let mock: ReturnType<typeof makeElectron>;

  beforeEach(() => {
    vi.clearAllMocks();
    feedbackStoreImpl._reset();
    mockActiveFilePath = '/file-a.arbo';
    mock = makeElectron();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.window = { electron: mock.electron } as any;
    mockProcessIncomingFeedbackForA.mockResolvedValue({ success: true, nodeCount: 1 });
    mockFindNodeForA.mockReturnValue(null);
    mockGetAllStores.mockImplementation(() => [fileAStore, fileBStore]);
    mockGetAllStoreEntries.mockImplementation(() => [
      { filePath: '/file-a.arbo', store: fileAStore },
      { filePath: '/file-b.arbo', store: fileBStore },
    ]);
  });

  describe('clipboard monitor is not stopped on file switch', () => {
    it('does not stop the clipboard monitor when switching to a file with no active session', () => {
      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: 'node-a-1' as string | null } }
      );

      vi.clearAllMocks();

      // Simulate switching to File B — active file changes, no session in the new file
      mockActiveFilePath = '/file-b.arbo';
      rerender({ id: null });

      expect(mock.electron.stopClipboardMonitor).not.toHaveBeenCalled();
    });

    it('does not start the clipboard monitor when switching files during an active session', () => {
      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: 'node-a-1' as string | null } }
      );

      vi.clearAllMocks();

      mockActiveFilePath = '/file-b.arbo';
      rerender({ id: null });

      expect(mock.electron.startClipboardMonitor).not.toHaveBeenCalled();
    });
  });

  describe('feedback routing survives file switch', () => {
    it('routes clipboard feedback to the correct store after switching to another file', async () => {
      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: 'node-a-1' as string | null } }
      );

      // Switch to File B — File A session remains alive
      mockActiveFilePath = '/file-b.arbo';
      rerender({ id: null });

      act(() => {
        mock.triggerClipboard('- Response for File A session');
      });

      await waitFor(() => {
        expect(mockProcessIncomingFeedbackForA).toHaveBeenCalledWith(
          '- Response for File A session',
          'clipboard',
          false,
          true
        );
      }, { container: document.body });
    });

    it('routes file-watcher feedback to the correct store after switching files', async () => {
      mockFindNodeForA.mockReturnValue('node-a-1');

      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: 'node-a-1' as string | null } }
      );

      mockActiveFilePath = '/file-b.arbo';
      rerender({ id: null });

      act(() => {
        mock.triggerFile('/tmp/feedback-node-a-1.md', '- Result for File A');
      });

      expect(mockHandleAutonomousFeedbackForA).toHaveBeenCalledWith('node-a-1', '- Result for File A');
    });
  });

  describe('feedback content is not cleared on file switch', () => {
    it('does not clear the target file feedback store when switching to it', () => {
      // File B has pending unaccepted feedback from a previous iteration
      feedbackStoreImpl._setHasContent('/file-b.arbo', true);

      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: null as string | null } }
      );

      vi.clearAllMocks();

      // Switch to File B — its pending feedback must survive the transition
      mockActiveFilePath = '/file-b.arbo';
      rerender({ id: null });

      expect(mockFeedbackTreeClearFile).not.toHaveBeenCalledWith('/file-b.arbo');
    });

    it('does not clear feedback for a file with no active session just because it becomes active', () => {
      feedbackStoreImpl._setHasContent('/file-b.arbo', true);

      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: 'node-a-1' as string | null } }
      );

      vi.clearAllMocks();

      mockActiveFilePath = '/file-b.arbo';
      rerender({ id: null });

      expect(mockFeedbackTreeClearFile).not.toHaveBeenCalledWith('/file-b.arbo');
    });
  });

  describe('toast notification when session completes in a non-active file', () => {
    it('shows a toast when file-watcher feedback arrives for a file the user is not viewing', async () => {
      mockFindNodeForA.mockReturnValue('node-a-1');

      // User is on File B while File A has an active session
      mockActiveFilePath = '/file-b.arbo';
      renderHook(() => useFeedbackClipboard(null));

      act(() => {
        mock.triggerFile('/tmp/feedback-node-a-1.md', '- Result');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalled();
      }, { container: document.body });
    });

    it('does not show a toast when feedback arrives for the file the user is currently viewing', async () => {
      mockFindNodeForA.mockReturnValue('node-a-1');

      // User is on File A — the session file
      mockActiveFilePath = '/file-a.arbo';
      renderHook(() => useFeedbackClipboard('node-a-1'));

      act(() => {
        mock.triggerFile('/tmp/feedback-node-a-1.md', '- Result');
      });

      await waitFor(() => {
        expect(mockHandleAutonomousFeedbackForA).toHaveBeenCalled();
      }, { container: document.body });

      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  describe('explicit session end still stops the clipboard monitor', () => {
    it('stops the clipboard monitor when the session ends on the current file', () => {
      // Simulates finishCancel / finishAccept: the store action sets collaboratingNodeId to null
      // before the hook re-renders, so all stores appear inactive at cleanup time
      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useFeedbackClipboard(id),
        { initialProps: { id: 'node-a-1' as string | null } }
      );

      vi.clearAllMocks();

      // The store action (finishCancel) already cleared collaboratingNodeId in File A's store
      mockGetAllStores.mockReturnValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { getState: () => ({ collaboratingNodeId: null, actions: {} }) } as any,
      ]);

      // activeFilePath is unchanged — this is session end, not file switch
      rerender({ id: null });

      expect(mock.electron.stopClipboardMonitor).toHaveBeenCalled();
    });

    it('starts the clipboard monitor when a new session begins', () => {
      renderHook(() => useFeedbackClipboard('node-a-1'));
      expect(mock.electron.startClipboardMonitor).toHaveBeenCalled();
    });

    it('does not start the clipboard monitor when feedback content already exists', () => {
      feedbackStoreImpl._setHasContent('/file-a.arbo', true);
      renderHook(() => useFeedbackClipboard('node-a-1'));
      expect(mock.electron.startClipboardMonitor).not.toHaveBeenCalled();
    });
  });
});
