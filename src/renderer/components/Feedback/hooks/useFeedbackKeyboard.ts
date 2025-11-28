import { RefObject } from 'react';
import { useTreeContainer, useKeyboardServices } from '../../../hooks';
import type { TreeStore } from '../../../store/tree/treeStore';

export function useFeedbackKeyboard(
  containerRef: RefObject<HTMLDivElement | null>,
  store: TreeStore | null
): void {
  useTreeContainer(containerRef, store);
  // UI service (cut/copy/paste) is handled globally by useWorkspaceKeyboard
  useKeyboardServices(containerRef);
}
