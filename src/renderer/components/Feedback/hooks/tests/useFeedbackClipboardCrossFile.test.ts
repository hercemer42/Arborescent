import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeedbackClipboard } from '../useFeedbackClipboard';

const mockProcessIncomingFeedbackContent = vi.fn();
const mockShowFeedback = vi.fn();
const mockShowFeedbackForFile = vi.fn();

let activeFilePathMock = '/files/active.arbo';

interface FakeStoreEntry {
  filePath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: { getState: () => any };
}

function makeCollaboratingStore(filePath: string): FakeStoreEntry {
  return {
    filePath,
    store: {
      getState: () => ({
        collaboratingNodeId: 'collaborating-node' as string | null,
        nodes: {},
        currentFilePath: filePath,
        actions: {
          processIncomingFeedbackContent: mockProcessIncomingFeedbackContent,
          findNodeIdByFeedbackFilePath: () => null,
          handleAutonomousFeedback: vi.fn(),
        },
      }),
    },
  };
}

const storeEntriesRef: { current: FakeStoreEntry[] } = {
  current: [],
};

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn((filePath: string) =>
      storeEntriesRef.current.find((e) => e.filePath === filePath)?.store,
    ),
    getAllStores: vi.fn(() => storeEntriesRef.current.map((e) => e.store)),
    getAllStoreEntries: vi.fn(() => storeEntriesRef.current),
  },
}));

vi.mock('../../../../services/feedback/feedbackTempFileService', () => ({
  loadFeedbackContent: vi.fn().mockResolvedValue(null),
}));

const { mockFeedbackTreeStore } = vi.hoisted(() => {
  let hasContent = false;
  const listeners = new Set<() => void>();
  const store = {
    clearFile: vi.fn(() => {
      hasContent = false;
      listeners.forEach((l) => l());
    }),
    getStoreForFile: () => null,
    hasFeedback: () => hasContent,
    subscribeToVersion: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    _setHasContent: (value: boolean) => {
      hasContent = value;
      listeners.forEach((l) => l());
    },
  };
  return { mockFeedbackTreeStore: store };
});

vi.mock('../../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: mockFeedbackTreeStore,
}));

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn((selector: (s: { activeFilePath: string }) => unknown) =>
    selector({ activeFilePath: activeFilePathMock }),
  ),
}));

vi.mock('../../../../store/panel/panelStore', () => ({
  usePanelStore: {
    getState: () => ({
      showFeedback: mockShowFeedback,
      showFeedbackForFile: mockShowFeedbackForFile,
    }),
  },
}));

const mockAddToast = vi.fn();
vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

describe('useFeedbackClipboard — cross-file feedback', () => {
  let fileCallback: (filePath: string, content: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedbackTreeStore._setHasContent(false);
    activeFilePathMock = '/files/active.arbo';
    storeEntriesRef.current = [];

    mockProcessIncomingFeedbackContent.mockImplementation(async () => {
      mockFeedbackTreeStore._setHasContent(true);
      return { success: true, nodeCount: 1 };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electron = {
      onClipboardContentDetected: vi.fn(() => vi.fn()),
      onFeedbackFileContentDetected: vi.fn((cb: (filePath: string, content: string) => void) => {
        fileCallback = cb;
        return vi.fn();
      }),
      startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
      stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('same-file feedback (happy path)', () => {
    it('processes feedback content and shows the panel when the active file owns the collaboration', async () => {
      storeEntriesRef.current = [makeCollaboratingStore('/files/active.arbo')];

      renderHook(() => useFeedbackClipboard('collaborating-node'));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await waitFor(() => expect(mockProcessIncomingFeedbackContent).toHaveBeenCalled());
      expect(mockAddToast).not.toHaveBeenCalledWith(
        expect.stringMatching(/another file|in .*\.arbo/i),
        expect.anything(),
      );
    });
  });

  describe('cross-file feedback', () => {
    it('shows a toast when feedback arrives for a file other than the active one', async () => {
      storeEntriesRef.current = [makeCollaboratingStore('/files/other.arbo')];

      renderHook(() => useFeedbackClipboard(null));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/info|success/),
      );
    });

    it('does not open the feedback panel in the currently-active (non-owning) file', async () => {
      storeEntriesRef.current = [makeCollaboratingStore('/files/other.arbo')];

      renderHook(() => useFeedbackClipboard(null));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
      expect(mockShowFeedback).not.toHaveBeenCalled();
    });

    it('toast message identifies the owning file by name', async () => {
      storeEntriesRef.current = [makeCollaboratingStore('/files/project-alpha.arbo')];

      renderHook(() => useFeedbackClipboard(null));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
      const firstArg = mockAddToast.mock.calls[0][0] as string;
      expect(firstArg).toMatch(/project-alpha/);
    });

    it('still persists the incoming feedback so the panel shows content when the user switches to the owning file', async () => {
      storeEntriesRef.current = [makeCollaboratingStore('/files/other.arbo')];

      renderHook(() => useFeedbackClipboard(null));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await waitFor(() => expect(mockProcessIncomingFeedbackContent).toHaveBeenCalled());
    });
  });

  describe('multiple stores', () => {
    it('matches the owning file by locating the store with a non-null collaboratingNodeId', async () => {
      const idle = {
        filePath: '/files/active.arbo',
        store: {
          getState: () => ({
            collaboratingNodeId: null,
            nodes: {},
            currentFilePath: '/files/active.arbo',
            actions: {
              processIncomingFeedbackContent: vi.fn(),
              findNodeIdByFeedbackFilePath: () => null,
              handleAutonomousFeedback: vi.fn(),
            },
          }),
        },
      };
      const owner = makeCollaboratingStore('/files/other.arbo');
      storeEntriesRef.current = [idle, owner];

      renderHook(() => useFeedbackClipboard(null));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await waitFor(() => expect(mockProcessIncomingFeedbackContent).toHaveBeenCalled());
      expect(mockAddToast).toHaveBeenCalled();
    });

    it('two cross-file feedbacks for different files produce two toasts each naming its file');

    it('two feedbacks for the same cross file do not produce a duplicate toast for the same unresolved pending state');
  });

  describe('zoom tab of owning file', () => {
    it('treats a zoom tab of file X as being in file X — no cross-file toast');
  });

  describe('no-collaboration fallback', () => {
    it('ignores the feedback file event entirely when no store has a collaborating node', async () => {
      storeEntriesRef.current = [
        {
          filePath: '/files/active.arbo',
          store: {
            getState: () => ({
              collaboratingNodeId: null,
              nodes: {},
              currentFilePath: '/files/active.arbo',
              actions: {
                processIncomingFeedbackContent: mockProcessIncomingFeedbackContent,
                findNodeIdByFeedbackFilePath: () => null,
                handleAutonomousFeedback: vi.fn(),
              },
            }),
          },
        },
      ];

      renderHook(() => useFeedbackClipboard(null));
      fileCallback('/tmp/unknown-feedback.md', '# feedback');

      await new Promise((r) => setTimeout(r, 0));
      expect(mockProcessIncomingFeedbackContent).not.toHaveBeenCalled();
      expect(mockShowFeedback).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('does not open an empty feedback panel in the current file even if processIncomingFeedbackContent fails');

    it('when the owning file is not in any open tab, the toast still fires and content is stored for later');

    it('user is actively interacting with the owning file when feedback arrives — uses existing in-panel flow, no cross-file toast');
  });
});
