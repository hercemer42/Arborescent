import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const useFeedbackClipboardMock = vi.fn();
vi.mock('../hooks/useFeedbackClipboard', () => ({
  useFeedbackClipboard: (id: string | null) => useFeedbackClipboardMock(id),
}));

const filesState = { activeFilePath: '/a.arbo' as string | null };
vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: (selector: (state: typeof filesState) => unknown) => selector(filesState),
}));

const collaborating = { value: 'node-1' as string | null };
vi.mock('../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: () => ({
      subscribe: () => () => {},
      getState: () => ({ collaboratingNodeId: collaborating.value }),
    }),
  },
}));

import { ClipboardReviewMonitor } from '../ClipboardReviewMonitor';

describe('ClipboardReviewMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filesState.activeFilePath = '/a.arbo';
    collaborating.value = 'node-1';
  });
  afterEach(cleanup);

  it("runs the clipboard monitor for the active file's collaborating node", () => {
    render(<ClipboardReviewMonitor />);
    expect(useFeedbackClipboardMock).toHaveBeenCalledWith('node-1');
  });

  it('passes null when no collaboration is active on the file', () => {
    collaborating.value = null;
    render(<ClipboardReviewMonitor />);
    expect(useFeedbackClipboardMock).toHaveBeenCalledWith(null);
  });

  it('passes null when no file is open', () => {
    filesState.activeFilePath = null;
    render(<ClipboardReviewMonitor />);
    expect(useFeedbackClipboardMock).toHaveBeenCalledWith(null);
  });
});
