import { RefObject } from 'react';
import { useTreeContainer, useKeyboardServices } from '../../../hooks';
import type { TreeStore } from '../../../store/tree/treeStore';

export function useWorkspaceKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  store: TreeStore | null
): void {
  useTreeContainer(containerRef, store);
  useKeyboardServices(containerRef, { includeUIService: true });
}
