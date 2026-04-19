import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { storeManager } from '../../../store/storeManager';
import { useToastStore } from '../../../store/toast/toastStore';
import { logger } from '../../../services/logger';
import { resolveToSourceFilePath } from '../../../utils/zoomPath';
import type { ContentSource } from '../../../store/tree/actions/sendActions';

function findActiveCollaboratingEntry() {
  return storeManager
    .getAllStoreEntries()
    .find((entry) => entry.store.getState().collaboratingNodeId !== null);
}

function displayNameFor(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export function useFeedbackClipboard(collaboratingNodeId: string | null) {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const hasFeedbackContent = useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    () => activeFilePath ? feedbackTreeStore.hasFeedback(activeFilePath) : false,
  );

  const handleIncomingFeedback = useCallback(async (content: string, source: ContentSource, skipSave: boolean = false) => {
    const entry = findActiveCollaboratingEntry();
    if (!entry) return;

    const ownerFilePath = entry.filePath;
    const isOwnerActive = ownerFilePath === resolveToSourceFilePath(activeFilePath);

    await entry.store.getState().actions.processIncomingFeedbackContent(content, source, skipSave, !isOwnerActive);

    if (!isOwnerActive) {
      useToastStore.getState().addToast(
        `Feedback ready in ${displayNameFor(ownerFilePath)}`,
        'info',
      );
    }
  }, [activeFilePath]);

  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      void handleIncomingFeedback(content, 'clipboard');
    });

    return cleanup;
  }, [handleIncomingFeedback]);

  useEffect(() => {
    const cleanup = window.electron.onFeedbackFileContentDetected((filePath: string, content: string) => {
      const storeEntries = storeManager.getAllStoreEntries();
      logger.debug(
        `Feedback file event received: path=${filePath} stores=${storeEntries.length}`,
        'FeedbackFileEvent',
      );

      for (const { filePath: storePath, store } of storeEntries) {
        const nodeId = store.getState().actions.findNodeIdByFeedbackFilePath?.(filePath);
        if (nodeId) {
          logger.debug(
            `Autonomous match: node=${nodeId} store=${storePath}`,
            'FeedbackFileEvent',
          );
          store.getState().actions.handleAutonomousFeedback?.(nodeId, content);
          if (storePath !== resolveToSourceFilePath(activeFilePath)) {
            useToastStore.getState().addToast(
              `A session completed in ${displayNameFor(storePath)}`,
              'info',
            );
          }
          return;
        }
      }

      logger.warn(
        `No autonomous collaboration matched for file ${filePath} — falling through to manual panel flow`,
        'FeedbackFileEvent',
      );
      void handleIncomingFeedback(content, 'file');
    });

    return cleanup;
  }, [handleIncomingFeedback, activeFilePath]);

  useEffect(() => {
    if (collaboratingNodeId && !hasFeedbackContent) {
      void window.electron.startClipboardMonitor();
    }

    return () => {
      // Switching files should not interrupt a session in another file.
      const anySessionActive = storeManager.getAllStores().some(
        s => s.getState().collaboratingNodeId !== null
      );
      if (!anySessionActive) {
        void window.electron.stopClipboardMonitor();
      }
    };
  }, [collaboratingNodeId, hasFeedbackContent]);

  return hasFeedbackContent;
}
