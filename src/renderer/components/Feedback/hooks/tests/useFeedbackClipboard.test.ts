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
    hasFeedback: () => feedbackPresent.value,
  },
}));

const processIncomingFeedbackContent = vi.fn().mockResolvedValue(undefined);
const collab = { nodeId: 'node-1' as string | null };
const entry = {
  filePath: '/a.arbo',
  store: { getState: () => ({ collaboratingNodeId: collab.nodeId, actions: { processIncomingFeedbackContent } }) },
};
vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getAllStoreEntries: () => (collab.nodeId ? [entry] : []),
    getAllStores: () => [entry.store],
  },
}));

vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('../../../../utils/zoomPath', () => ({
  resolveToSourceFilePath: (path: string | null) => path,
}));

import { useFeedbackClipboard } from '../useFeedbackClipboard';

describe('useFeedbackClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filesState.activeFilePath = '/a.arbo';
    feedbackPresent.value = false;
    collab.nodeId = 'node-1';
    (window.electron.onClipboardContentDetected as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
  });

  it('starts the clipboard monitor when a collaboration is active and no proposition is captured yet', () => {
    renderHook(() => useFeedbackClipboard('node-1'));
    expect(window.electron.startClipboardMonitor).toHaveBeenCalled();
  });

  it('does not start the monitor when there is no active collaboration', () => {
    renderHook(() => useFeedbackClipboard(null));
    expect(window.electron.startClipboardMonitor).not.toHaveBeenCalled();
  });

  it('does not re-start the monitor once a proposition has been captured', () => {
    feedbackPresent.value = true;
    renderHook(() => useFeedbackClipboard('node-1'));
    expect(window.electron.startClipboardMonitor).not.toHaveBeenCalled();
  });

  it('routes detected clipboard content into the active collaboration', async () => {
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

    expect(processIncomingFeedbackContent).toHaveBeenCalledWith('# [ ] proposed change', 'clipboard', false);
  });
});
