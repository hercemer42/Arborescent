import { useTreeFileOperations } from './useTreeFileOperations';
import { useTreeMenu } from './useTreeMenu';
import { useTreeKeyboard } from './useTreeKeyboard';

export function useTree() {
  const { handleLoad, handleSave, handleSaveAs } = useTreeFileOperations();

  useTreeMenu({ handleLoad, handleSave, handleSaveAs });
  useTreeKeyboard();
}
