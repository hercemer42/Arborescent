import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

/**
 * Hook providing accept and cancel actions for the review workflow.
 * These simply delegate to store actions which contain all the business logic.
 */
export function useReviewActions() {
  const handleCancel = async () => {
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (!activeFilePath) return;

    const store = storeManager.getStoreForFile(activeFilePath);
    await store.getState().actions.finishCancel();
  };

  const handleAccept = async () => {
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (!activeFilePath) return;

    const store = storeManager.getStoreForFile(activeFilePath);
    await store.getState().actions.finishAccept();
  };

  return {
    handleCancel,
    handleAccept,
  };
}
