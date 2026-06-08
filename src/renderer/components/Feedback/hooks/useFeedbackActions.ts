import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { useReviewCollapseStore } from '../../../store/reviewCollapse/reviewCollapseStore';

export function useFeedbackActions() {
  const handleCancel = async (reviewedNodeId: string) => {
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (!activeFilePath) return;

    const store = storeManager.getStoreForFile(activeFilePath);
    await store.getState().actions.finishCancel(reviewedNodeId);
    useReviewCollapseStore.getState().clearForReview(reviewedNodeId);
  };

  const handleAccept = async (reviewedNodeId: string) => {
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (!activeFilePath) return;

    const store = storeManager.getStoreForFile(activeFilePath);
    await store.getState().actions.finishAccept(reviewedNodeId);
    useReviewCollapseStore.getState().clearForReview(reviewedNodeId);
  };

  return {
    handleCancel,
    handleAccept,
  };
}
