import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReviewMap } from '../../../store/tree/reviews';

const useFeedbackClipboardMock = vi.fn();
vi.mock('../hooks/useFeedbackClipboard', () => ({
  useFeedbackClipboard: (id: string | null) => useFeedbackClipboardMock(id),
}));

const filesState = { activeFilePath: '/a.arbo' as string | null };
vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: (selector: (state: typeof filesState) => unknown) => selector(filesState),
}));

const browserReview: ReviewMap = { 'node-1': { source: 'browser', terminalId: null } };
const reviews = { value: browserReview as ReviewMap };
vi.mock('../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: () => ({
      subscribe: () => () => {},
      getState: () => ({ reviews: reviews.value }),
    }),
  },
}));

import { ClipboardReviewMonitor } from '../ClipboardReviewMonitor';

describe('ClipboardReviewMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filesState.activeFilePath = '/a.arbo';
    reviews.value = { 'node-1': { source: 'browser', terminalId: null } };
  });
  afterEach(cleanup);

  it("runs the clipboard monitor for the active file's collaborating node", () => {
    render(<ClipboardReviewMonitor />);
    expect(useFeedbackClipboardMock).toHaveBeenCalledWith('node-1');
  });

  it('passes null when no collaboration is active on the file', () => {
    reviews.value = {};
    render(<ClipboardReviewMonitor />);
    expect(useFeedbackClipboardMock).toHaveBeenCalledWith(null);
  });

  it('passes null when no file is open', () => {
    filesState.activeFilePath = null;
    render(<ClipboardReviewMonitor />);
    expect(useFeedbackClipboardMock).toHaveBeenCalledWith(null);
  });
});
