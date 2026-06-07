import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import { getBrowserReviewNodeId, hasBrowserReview } from '../../../store/tree/reviews';
import { useToastStore } from '../../../store/toast/toastStore';
import { resolveToSourceFilePath } from '../../../utils/zoomPath';
import type { ContentSource } from '../../../store/tree/actions/sendActions';

// The clipboard monitor is session-less, so it only ever serves the (exclusive) browser review.
// Find the file holding it and the reviewed node its captured content belongs to.
function findBrowserReviewEntry() {
  for (const entry of storeManager.getAllStoreEntries()) {
    const reviewedNodeId = getBrowserReviewNodeId(entry.store.getState().reviews);
    if (reviewedNodeId) return { ...entry, reviewedNodeId };
  }
  return null;
}

function displayNameFor(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export function useFeedbackClipboard(browserReviewNodeId: string | null) {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const hasFeedbackContent = useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    () => (browserReviewNodeId ? feedbackTreeStore.hasFeedbackForNode(browserReviewNodeId) : false),
  );

  const handleClipboardFeedback = useCallback(async (content: string, source: ContentSource) => {
    const entry = findBrowserReviewEntry();
    if (!entry) return;

    const ownerFilePath = entry.filePath;
    const isOwnerActive = ownerFilePath === resolveToSourceFilePath(activeFilePath);

    const result = await entry.store.getState().actions.processIncomingFeedbackContent(content, source, entry.reviewedNodeId);

    // The clipboard is the only review channel with no return path to carry a parse failure
    // back (the MCP path threads result.reason into its reply), so the renderer must surface it.
    if (!result.success) {
      const reason = result.reason ? `: ${result.reason}` : '';
      useToastStore.getState().addToast(
        `Couldn't read the pasted response${reason} — copy the model's full response and try again.`,
        'error',
      );
      return;
    }

    if (!isOwnerActive) {
      useToastStore.getState().addToast(
        `Feedback ready in ${displayNameFor(ownerFilePath)}`,
        'info',
      );
    }
  }, [activeFilePath]);

  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      void handleClipboardFeedback(content, 'clipboard');
    });

    return cleanup;
  }, [handleClipboardFeedback]);

  useEffect(() => {
    if (browserReviewNodeId && !hasFeedbackContent) {
      void window.electron.startClipboardMonitor();
    }

    return () => {
      // Switching files should not interrupt a browser review awaiting content in another file.
      const anyBrowserReview = storeManager.getAllStores().some((s) => hasBrowserReview(s.getState().reviews));
      if (!anyBrowserReview) {
        void window.electron.stopClipboardMonitor();
      }
    };
  }, [browserReviewNodeId, hasFeedbackContent]);

  return hasFeedbackContent;
}
