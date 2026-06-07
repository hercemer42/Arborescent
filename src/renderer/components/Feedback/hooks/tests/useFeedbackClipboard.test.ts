import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const filesState = { activeFilePath: '/a.arbo' as string | null };
vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: (selector: (s: typeof filesState) => unknown) => selector(filesState),
}));

const feedbackPresent = { value: false };
vi.mock('../../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    subscribeToVersion: () => () => {},
    hasFeedbackForNode: () => feedbackPresent.value,
    getStoreForNode: () => entry.store,
  },
}));

const processIncomingFeedbackContent = vi.fn().mockResolvedValue({ success: true, nodeCount: 1 });
const review = { nodeId: 'node-1' as string | null };
const entry = {
  filePath: '/a.arbo',
  store: {
    getState: () => ({
      reviews: review.nodeId
        ? { [review.nodeId]: { source: 'browser' as const, terminalId: null } }
        : {},
      actions: { processIncomingFeedbackContent },
    }),
  },
};
vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getAllStoreEntries: () => (review.nodeId ? [entry] : []),
    getAllStores: () => [entry.store],
  },
}));

const addToast = vi.fn();
vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast }) },
}));

vi.mock('../../../../utils/zoomPath', () => ({
  resolveToSourceFilePath: (path: string | null) => path,
}));

import { useFeedbackClipboard } from '../useFeedbackClipboard';

describe('useFeedbackClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addToast.mockClear();
    processIncomingFeedbackContent.mockResolvedValue({ success: true, nodeCount: 1 });
    filesState.activeFilePath = '/a.arbo';
    feedbackPresent.value = false;
    review.nodeId = 'node-1';
    (window.electron.onClipboardContentDetected as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
  });

  it('starts the clipboard monitor when a browser review is active and no proposition is captured yet', () => {
    renderHook(() => useFeedbackClipboard('node-1'));
    expect(window.electron.startClipboardMonitor).toHaveBeenCalled();
  });

  it('does not start the monitor when there is no active browser review', () => {
    review.nodeId = null;
    renderHook(() => useFeedbackClipboard(null));
    expect(window.electron.startClipboardMonitor).not.toHaveBeenCalled();
  });

  it('does not re-start the monitor once a proposition has been captured', () => {
    feedbackPresent.value = true;
    renderHook(() => useFeedbackClipboard('node-1'));
    expect(window.electron.startClipboardMonitor).not.toHaveBeenCalled();
  });

  it('routes detected clipboard content to the reviewed node of the active browser review', async () => {
    let detected: ((content: string) => void) | undefined;
    (window.electron.onClipboardContentDetected as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (content: string) => void) => {
        detected = cb;
        return vi.fn();
      },
    );

    renderHook(() => useFeedbackClipboard('node-1'));

    expect(detected).toBeDefined();
    detected!('# [ ] proposed change');
    await Promise.resolve();

    expect(processIncomingFeedbackContent).toHaveBeenCalledWith(
      '# [ ] proposed change',
      'clipboard',
      'node-1',
    );
  });

  it('shows an error toast when the pasted content cannot be parsed', async () => {
    processIncomingFeedbackContent.mockResolvedValue({
      success: false,
      reason: 'Content has no `#` heading',
    });

    let detected: ((content: string) => void) | undefined;
    (window.electron.onClipboardContentDetected as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (content: string) => void) => {
        detected = cb;
        return vi.fn();
      },
    );

    renderHook(() => useFeedbackClipboard('node-1'));

    expect(detected).toBeDefined();
    detected!('not a valid response');
    await Promise.resolve();
    await Promise.resolve();

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Content has no `#` heading'),
      'error',
    );
    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('try again'),
      'error',
    );
  });
});
