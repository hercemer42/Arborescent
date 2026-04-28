import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFeedbackClipboard } from '../useFeedbackClipboard';

// These tests pin the strict file-path routing behavior we want:
// when a feedback file event arrives, it MUST be routed to the store
// that registered that filePath — never to some other store that
// happens to have `collaboratingNodeId !== null`. The existing
// fall-through to `findActiveCollaboratingEntry` is the bug.

interface FakeStoreEntry {
  filePath: string;
  collaboratingNodeId: string | null;
  processIncomingFeedbackContent: ReturnType<typeof vi.fn>;
  findCollaborationByFeedbackFilePath: ReturnType<typeof vi.fn>;
  handleAutonomousFeedback: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: { getState: () => any };
}

function makeStore(
  filePath: string,
  opts: {
    collaboratingNodeId?: string | null;
    registeredFeedbackPath?: string | null;
    nodeIdForRegisteredPath?: string;
    kind?: 'manual' | 'autonomous';
  } = {},
): FakeStoreEntry {
  const collaboratingNodeId = opts.collaboratingNodeId ?? null;
  const registered = opts.registeredFeedbackPath ?? null;
  const nodeIdForPath = opts.nodeIdForRegisteredPath ?? 'registered-node';
  const kind = opts.kind ?? 'autonomous';

  const processIncomingFeedbackContent = vi.fn().mockImplementation(async () => ({
    success: true,
    nodeCount: 1,
  }));
  const handleAutonomousFeedback = vi.fn();
  const findCollaborationByFeedbackFilePath = vi.fn((incoming: string) =>
    registered && incoming === registered ? { nodeId: nodeIdForPath, kind } : null,
  );

  return {
    filePath,
    collaboratingNodeId,
    processIncomingFeedbackContent,
    findCollaborationByFeedbackFilePath,
    handleAutonomousFeedback,
    store: {
      getState: () => ({
        collaboratingNodeId,
        nodes: {},
        currentFilePath: filePath,
        actions: {
          processIncomingFeedbackContent,
          findCollaborationByFeedbackFilePath,
          handleAutonomousFeedback,
        },
      }),
    },
  };
}

const storeEntriesRef: { current: FakeStoreEntry[] } = { current: [] };
let activeFilePathMock = '/files/active.arbo';

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn((filePath: string) =>
      storeEntriesRef.current.find((e) => e.filePath === filePath)?.store,
    ),
    getAllStores: vi.fn(() => storeEntriesRef.current.map((e) => e.store)),
    getAllStoreEntries: vi.fn(() =>
      storeEntriesRef.current.map((e) => ({ filePath: e.filePath, store: e.store })),
    ),
  },
}));

vi.mock('../../../../services/feedback/feedbackTempFileService', () => ({
  loadFeedbackContent: vi.fn().mockResolvedValue(null),
}));

const { mockFeedbackTreeStore } = vi.hoisted(() => {
  let hasContent = false;
  const listeners = new Set<() => void>();
  return {
    mockFeedbackTreeStore: {
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
    },
  };
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
      showFeedback: vi.fn(),
      showFeedbackForFile: vi.fn(),
    }),
  },
}));

const mockAddToast = vi.fn();
vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

describe('useFeedbackClipboard — strict file-path routing', () => {
  let fileCallback: (filePath: string, content: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    storeEntriesRef.current = [];
    activeFilePathMock = '/files/active.arbo';
    mockFeedbackTreeStore._setHasContent(false);

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

  describe('file event routes strictly by registered feedback path', () => {
    it('routes to the store that registered the incoming feedback path', async () => {
      const owner = makeStore('/files/owner.arbo', {
        collaboratingNodeId: 'node-owner',
        registeredFeedbackPath: '/tmp/feedback-response-node-owner.md',
        nodeIdForRegisteredPath: 'node-owner',
      });
      const other = makeStore('/files/other.arbo', {
        collaboratingNodeId: 'node-other',
        registeredFeedbackPath: '/tmp/feedback-response-node-other.md',
        nodeIdForRegisteredPath: 'node-other',
      });
      storeEntriesRef.current = [other, owner];

      renderHook(() => useFeedbackClipboard(null));
      act(() => fileCallback('/tmp/feedback-response-node-owner.md', '# updated'));

      await waitFor(() => expect(owner.handleAutonomousFeedback).toHaveBeenCalled());
      expect(owner.handleAutonomousFeedback).toHaveBeenCalledWith('node-owner', '# updated');
      expect(other.handleAutonomousFeedback).not.toHaveBeenCalled();
      expect(other.processIncomingFeedbackContent).not.toHaveBeenCalled();
    });

    it('does not route to any store when the filePath is not registered anywhere', async () => {
      const a = makeStore('/files/a.arbo', {
        collaboratingNodeId: 'node-a',
        registeredFeedbackPath: '/tmp/feedback-response-node-a.md',
        nodeIdForRegisteredPath: 'node-a',
      });
      const b = makeStore('/files/b.arbo', {
        collaboratingNodeId: 'node-b',
        registeredFeedbackPath: '/tmp/feedback-response-node-b.md',
        nodeIdForRegisteredPath: 'node-b',
      });
      storeEntriesRef.current = [a, b];

      renderHook(() => useFeedbackClipboard(null));
      act(() => fileCallback('/tmp/feedback-response-for-a-stale-node.md', '# orphaned'));

      await new Promise((r) => setTimeout(r, 10));

      expect(a.handleAutonomousFeedback).not.toHaveBeenCalled();
      expect(b.handleAutonomousFeedback).not.toHaveBeenCalled();
      expect(a.processIncomingFeedbackContent).not.toHaveBeenCalled();
      expect(b.processIncomingFeedbackContent).not.toHaveBeenCalled();
    });

    it('ignores the focused file when the feedback belongs to an unfocused file', async () => {
      activeFilePathMock = '/files/focused.arbo';

      const focused = makeStore('/files/focused.arbo', {
        collaboratingNodeId: 'node-focused',
        registeredFeedbackPath: '/tmp/feedback-response-node-focused.md',
        nodeIdForRegisteredPath: 'node-focused',
      });
      const unfocused = makeStore('/files/unfocused.arbo', {
        collaboratingNodeId: 'node-unfocused',
        registeredFeedbackPath: '/tmp/feedback-response-node-unfocused.md',
        nodeIdForRegisteredPath: 'node-unfocused',
      });
      storeEntriesRef.current = [focused, unfocused];

      renderHook(() => useFeedbackClipboard('node-focused'));
      act(() => fileCallback('/tmp/feedback-response-node-unfocused.md', '# from unfocused'));

      await waitFor(() => expect(unfocused.handleAutonomousFeedback).toHaveBeenCalled());
      expect(focused.handleAutonomousFeedback).not.toHaveBeenCalled();
      expect(focused.processIncomingFeedbackContent).not.toHaveBeenCalled();
    });
  });

  describe('no silent fall-through to findActiveCollaboratingEntry', () => {
    it('does not route unknown-path feedback to the first collaborating store', async () => {
      const manualInA = makeStore('/files/a.arbo', {
        collaboratingNodeId: 'node-manual-a',
        registeredFeedbackPath: '/tmp/feedback-response-node-manual-a.md',
        nodeIdForRegisteredPath: 'node-manual-a',
      });
      storeEntriesRef.current = [manualInA];

      renderHook(() => useFeedbackClipboard(null));
      act(() => fileCallback('/tmp/feedback-from-nowhere.md', '# rogue'));

      await new Promise((r) => setTimeout(r, 10));

      expect(manualInA.processIncomingFeedbackContent).not.toHaveBeenCalled();
      expect(manualInA.handleAutonomousFeedback).not.toHaveBeenCalled();
    });
  });

  describe('two concurrent collaborations in two files', () => {
    it('an autonomous completion in file A does not write into a manual collab in file B', async () => {
      const autonomousA = makeStore('/files/a.arbo', {
        collaboratingNodeId: 'node-auto-a',
        registeredFeedbackPath: '/tmp/feedback-response-node-auto-a.md',
        nodeIdForRegisteredPath: 'node-auto-a',
        kind: 'autonomous',
      });
      const manualB = makeStore('/files/b.arbo', {
        collaboratingNodeId: 'node-manual-b',
        registeredFeedbackPath: '/tmp/feedback-response-node-manual-b.md',
        nodeIdForRegisteredPath: 'node-manual-b',
        kind: 'manual',
      });
      storeEntriesRef.current = [manualB, autonomousA];

      renderHook(() => useFeedbackClipboard('node-manual-b'));
      act(() => fileCallback('/tmp/feedback-response-node-auto-a.md', '# auto-a result'));

      await waitFor(() => expect(autonomousA.handleAutonomousFeedback).toHaveBeenCalled());
      expect(autonomousA.handleAutonomousFeedback).toHaveBeenCalledWith('node-auto-a', '# auto-a result');
      expect(manualB.processIncomingFeedbackContent).not.toHaveBeenCalled();
      expect(manualB.handleAutonomousFeedback).not.toHaveBeenCalled();
    });

    it('a manual completion in file A does not trigger processing in file B', async () => {
      const manualA = makeStore('/files/a.arbo', {
        collaboratingNodeId: 'node-manual-a',
        registeredFeedbackPath: '/tmp/feedback-response-node-manual-a.md',
        nodeIdForRegisteredPath: 'node-manual-a',
        kind: 'manual',
      });
      const manualB = makeStore('/files/b.arbo', {
        collaboratingNodeId: 'node-manual-b',
        registeredFeedbackPath: '/tmp/feedback-response-node-manual-b.md',
        nodeIdForRegisteredPath: 'node-manual-b',
        kind: 'manual',
      });
      storeEntriesRef.current = [manualA, manualB];

      renderHook(() => useFeedbackClipboard('node-manual-b'));
      act(() => fileCallback('/tmp/feedback-response-node-manual-a.md', '# a result'));

      await waitFor(() => expect(manualA.processIncomingFeedbackContent).toHaveBeenCalled());
      expect(manualA.processIncomingFeedbackContent).toHaveBeenCalledWith('# a result', 'file', false);
      expect(manualB.handleAutonomousFeedback).not.toHaveBeenCalled();
      expect(manualB.processIncomingFeedbackContent).not.toHaveBeenCalled();
    });
  });

  describe('deregistration on accept/cancel', () => {
    it('drops a late file event after the owning collaboration has been accepted or cancelled', async () => {
      const owner = makeStore('/files/owner.arbo', {
        collaboratingNodeId: null,
        registeredFeedbackPath: null,
      });
      storeEntriesRef.current = [owner];

      renderHook(() => useFeedbackClipboard(null));
      act(() => fileCallback('/tmp/feedback-response-node-owner.md', '# late'));

      await new Promise((r) => setTimeout(r, 10));

      expect(owner.handleAutonomousFeedback).not.toHaveBeenCalled();
      expect(owner.processIncomingFeedbackContent).not.toHaveBeenCalled();
    });
  });
});
