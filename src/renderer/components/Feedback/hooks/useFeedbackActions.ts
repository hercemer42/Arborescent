import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

export function useFeedbackActions() {
  const handleCancel = async (reviewedNodeId: string) => {
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (!activeFilePath) return;

    const store = storeManager.getStoreForFile(activeFilePath);
    await store.getState().actions.finishCancel(reviewedNodeId);
  };

  const handleAccept = async (reviewedNodeId: string) => {
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (!activeFilePath) return;

    const store = storeManager.getStoreForFile(activeFilePath);
    await store.getState().actions.finishAccept(reviewedNodeId);
  };

  return {
    handleCancel,
    handleAccept,
  };
}
