import { useTreeMenu } from './useTreeMenu';
import { useTreeKeyboard } from './useTreeKeyboard';

export function useTree() {
  useTreeMenu();
  useTreeKeyboard();
}
