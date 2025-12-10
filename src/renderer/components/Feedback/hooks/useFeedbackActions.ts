import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

export function useFeedbackActions() {
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
